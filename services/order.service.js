const Order = require('../models/Order.model');
const walletService = require('./wallet.service');
const thirdPartyAPIService = require('./thirdPartyAPI.service');
const AppError = require('../utils/AppError');
const { ORDER_STATUS, DELIVERY_PARTNERS } = require('../config/constants');

/**
 * Order Service - Handles delivery order creation and management
 */
class OrderService {
  /**
   * Calculate shipping rate
   * @param {Object} orderData - Order data for rate calculation
   * @returns {Object} Rate information
   */
  async calculateRate(orderData) {
    const {
      deliveryPartner,
      pickupDetails,
      deliveryDetails,
      packageDetails,
      paymentType = 'prepaid'
    } = orderData;

    if (!Object.values(DELIVERY_PARTNERS).includes(deliveryPartner)) {
      throw new AppError('Invalid delivery partner', 400);
    }

    const rateData = {
      from: {
        pincode: pickupDetails.pincode,
        city: pickupDetails.city,
        state: pickupDetails.state
      },
      to: {
        pincode: deliveryDetails.pincode,
        city: deliveryDetails.city,
        state: deliveryDetails.state
      },
      weight: packageDetails.weight,
      dimensions: packageDetails.dimensions,
      declaredValue: packageDetails.declaredValue || 0,
      paymentType
    };

    try {
      const rateResponse = await thirdPartyAPIService.calculateRate(deliveryPartner, rateData);

      const baseRate = rateResponse.baseRate || rateResponse.rate || rateResponse.amount || 0;
      const additionalCharges = rateResponse.additionalCharges || 0;
      const gst = rateResponse.gst || 0;
      const dph = rateResponse.dph || 0;
      const totalAmount =
        rateResponse.totalAmount != null
          ? rateResponse.totalAmount
          : baseRate + additionalCharges + gst + dph;

      return {
        baseRate,
        additionalCharges,
        gst,
        dph,
        totalAmount,
        currency: rateResponse.currency || 'INR',
        partner: deliveryPartner,
        estimatedDelivery: rateResponse.estimatedDelivery || null,
        serviceType: rateResponse.serviceType || 'standard',
        courierOptions: rateResponse.courierOptions || [],
        courierId: rateResponse.courierId,
        courierName: rateResponse.courierName,
        metadata: rateResponse.metadata || {}
      };
    } catch (error) {
      console.error('[OrderService.calculateRate] carrier failed', {
        partner: deliveryPartner,
        pickup: pickupDetails?.pincode,
        delivery: deliveryDetails?.pincode,
        message: error.message,
        statusCode: error.statusCode
      });
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        'Shipping rates could not be loaded at the moment. Please try again in a few minutes.',
        503
      );
    }
  }

  /**
   * Create delivery order
   * @param {String} userId - User ID
   * @param {Object} orderData - Order data
   * @returns {Object} Created order
   */
  async createOrder(userId, orderData) {
    const {
      pickupDetails,
      deliveryDetails,
      packageDetails,
      deliveryPartner,
      orderType = 'domestic',
      nimbusCourierId,
      paymentType = 'prepaid',
      products = []
    } = orderData;

    if (
      orderType === 'domestic' &&
      deliveryPartner === DELIVERY_PARTNERS.NIMBUSPOST &&
      (!nimbusCourierId || String(nimbusCourierId).trim() === '')
    ) {
      throw new AppError(
        'Select a courier option after calculating shipping rate (nimbusCourierId is required).',
        400
      );
    }

    let pricing;
    let nimbusMeta = {};

    if (
      orderType === 'domestic' &&
      deliveryPartner === DELIVERY_PARTNERS.NIMBUSPOST &&
      nimbusCourierId
    ) {
      const rateData = {
        from: {
          pincode: pickupDetails.pincode,
          city: pickupDetails.city,
          state: pickupDetails.state
        },
        to: {
          pincode: deliveryDetails.pincode,
          city: deliveryDetails.city,
          state: deliveryDetails.state
        },
        weight: packageDetails.weight,
        dimensions: packageDetails.dimensions,
        declaredValue: packageDetails.declaredValue || 0,
        paymentType
      };

      const fullRate = await thirdPartyAPIService.calculateRate(
        DELIVERY_PARTNERS.NIMBUSPOST,
        rateData
      );
      const options = fullRate.courierOptions || [];
      const selected = options.find((c) => String(c.id) === String(nimbusCourierId));

      if (!selected) {
        throw new AppError(
          'Invalid courier selection. Please calculate rate again and pick a listed courier.',
          400
        );
      }

      pricing = {
        baseRate: selected.freightCharges,
        additionalCharges: selected.codCharges || 0,
        totalAmount: selected.totalCharges,
        currency: 'INR',
        gst: 0,
        dph: 0
      };

      nimbusMeta = {
        nimbusCourierId: String(selected.id),
        courierName: selected.name,
        paymentType,
        chargeableWeight: selected.chargeableWeight,
        minWeight: selected.minWeight
      };
    } else {
      pricing = await this.calculateRate({
        deliveryPartner,
        pickupDetails,
        deliveryDetails,
        packageDetails,
        paymentType
      });
    }

    // Check wallet balance
    const walletBalance = await walletService.getBalance(userId);
    if (walletBalance.balance < pricing.totalAmount) {
      throw new AppError(
        `Insufficient wallet balance. Required: ₹${pricing.totalAmount}, Available: ₹${walletBalance.balance}`,
        400
      );
    }

    // Generate unique order number
    const timestamp = Date.now();
    const randomSuffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const orderCount = await Order.countDocuments();
    const sequential = String(orderCount + 1).padStart(4, '0');
    const orderNumber = `ORD${timestamp}${randomSuffix}${sequential}`;

    const order = await Order.create({
      user: userId,
      orderNumber: orderNumber,
      orderType,
      pickupDetails,
      deliveryDetails,
      packageDetails,
      deliveryPartner,
      pricing: {
        baseRate: pricing.baseRate,
        additionalCharges: pricing.additionalCharges,
        totalAmount: pricing.totalAmount,
        currency: pricing.currency
      },
      products: products,
      status: ORDER_STATUS.PENDING,
      payment: {
        status: 'pending',
        method: 'wallet'
      },
      metadata: Object.keys(nimbusMeta).length ? nimbusMeta : {}
    });

    // Deduct amount from wallet
    try {
      const walletTransaction = await walletService.deductMoney(
        userId,
        pricing.totalAmount,
        `Payment for ${orderType} order ${order.orderNumber}`,
        order._id,
        null,
        {
          orderNumber: order.orderNumber,
          deliveryPartner: deliveryPartner,
          orderType: orderType
        }
      );

      // Update order payment status
      order.payment.status = 'completed';
      order.payment.paidAt = new Date();
      order.payment.transactionId = walletTransaction.transaction._id?.toString();
      await order.save();

      // Create shipment with third-party (async, don't wait)
      this._createShipmentWithPartner(order).catch(err => {
        console.error('Error creating shipment with partner:', err);
      });

      return {
        order: {
          id: order._id,
          orderNumber: order.orderNumber,
          status: order.status,
          pricing: order.pricing,
          payment: order.payment,
          createdAt: order.createdAt,
          orderType: order.orderType
        },
        wallet: {
          balance: walletTransaction.wallet.balance
        }
      };
    } catch (error) {
      // If wallet deduction fails, cancel order
      await Order.findByIdAndDelete(order._id);
      throw error;
    }
  }

  /**
   * Create shipment with delivery partner (private method)
   * @param {Object} order - Order document
   */
  async _createShipmentWithPartner(order) {
    try {
      const shipmentData = {
        pickup: order.pickupDetails,
        delivery: order.deliveryDetails,
        package: order.packageDetails,
        orderId: order.orderNumber,
        orderType: order.orderType,
        courierId: order.metadata?.nimbusCourierId,
        shippingCharges: Math.round(order.pricing.baseRate || 0),
        codCharges: Math.round(order.pricing.additionalCharges || 0),
        discount: 0,
        paymentType: order.metadata?.paymentType || 'prepaid',
        products: order.products || [],
        paymentType: order.metadata?.paymentType || 'prepaid'
      };

      const shipment = await thirdPartyAPIService.createShipment(
        order.deliveryPartner,
        shipmentData
      );

      order.awb = shipment.awb || shipment.trackingNumber;
      order.trackingUrl = shipment.trackingUrl;
      order.status = ORDER_STATUS.CONFIRMED;
      order.metadata = {
        ...order.metadata,
        nimbusOrderId: shipment.orderId,
        nimbusShipmentId: shipment.shipmentId,
        nimbusCourierName: shipment.courierName,
        labelUrl: shipment.labelUrl
      };
      await order.save();

      return shipment;
    } catch (error) {
      console.error('Error creating shipment:', error);
      // Don't throw - order is already created and paid
      // Status will remain PENDING
    }
  }

  /**
   * Get order by ID or order number
   * @param {String} orderId - Order ID or order number
   * @param {String} userId - User ID (for authorization)
   * @returns {Object} Order details
   */
  async getOrderById(orderId, userId) {
    let order;

    // Check if orderId is a valid MongoDB ObjectId (24 hex characters)
    if (orderId.match(/^[0-9a-fA-F]{24}$/)) {
      // It's an ObjectId, use findById
      order = await Order.findById(orderId).populate('user', 'name email phone');
    } else {
      // It's likely an order number, search by orderNumber
      order = await Order.findOne({ orderNumber: orderId, user: userId })
        .populate('user', 'name email phone');
    }

    if (!order) {
      throw new AppError('Order not found', 404);
    }

    // Check if user owns this order
    if (order.user._id.toString() !== userId.toString()) {
      throw new AppError('Unauthorized access to order', 403);
    }

    return order;
  }

  /**
   * Get user orders
   * @param {String} userId - User ID
   * @param {Object} filters - Filter options
   * @returns {Array} Order list
   */
  async getUserOrders(userId, filters = {}) {
    const query = { user: userId };

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.deliveryPartner) {
      query.deliveryPartner = filters.deliveryPartner;
    }

    if (filters.type) {
      query.orderType = filters.type;
    } else if (filters.orderType) {
      query.orderType = filters.orderType;
    }

    // Search by order number or AWB
    if (filters.search) {
      query.$or = [
        { orderNumber: { $regex: filters.search, $options: 'i' } },
        { awb: { $regex: filters.search, $options: 'i' } }
      ];
    }

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .limit(filters.limit || 50)
      .skip(filters.skip || 0)
      .select('-metadata');

    return orders;
  }

  /**
   * Track order
   * @param {String} orderId - Order ID
   * @param {String} userId - User ID
   * @returns {Object} Tracking information
   */
  /**
   * Raise Nimbus pickup for an order (uses metadata.nimbusShipmentId).
   */
  async requestNimbusPickupForOrder(orderId, userId) {
    const order = await this.getOrderById(orderId, userId);
    if (order.deliveryPartner !== DELIVERY_PARTNERS.NIMBUSPOST) {
      throw new AppError('Pickup is only available for NimbusPost domestic orders', 400);
    }
    const sid = order.metadata?.nimbusShipmentId;
    if (sid == null || sid === '') {
      throw new AppError(
        'Nimbus shipment is not booked yet (missing shipment id). Wait for booking or check Nimbus panel.',
        400
      );
    }
    return thirdPartyAPIService.nimbusRequestPickup([sid]);
  }

  /**
   * Generate Nimbus shipping label PDF (or JSON) for an order.
   */
  async generateNimbusLabelForOrder(orderId, userId) {
    const order = await this.getOrderById(orderId, userId);
    if (order.deliveryPartner !== DELIVERY_PARTNERS.NIMBUSPOST) {
      throw new AppError('Shipping label is only available for NimbusPost orders', 400);
    }
    const sid = order.metadata?.nimbusShipmentId;
    if (sid == null || sid === '') {
      throw new AppError(
        'Nimbus shipment is not booked yet (missing shipment id).',
        400
      );
    }
    return thirdPartyAPIService.nimbusGenerateShippingLabels([sid]);
  }

  /**
   * Cancel shipment on Nimbus (POST /v1/shipments/cancel) using order AWB.
   */
  async cancelNimbusShipmentForOrder(orderId, userId) {
    const order = await this.getOrderById(orderId, userId);
    if (order.deliveryPartner !== DELIVERY_PARTNERS.NIMBUSPOST) {
      throw new AppError('Shipment cancel is only available for NimbusPost orders', 400);
    }
    if (!order.awb || String(order.awb).trim() === '') {
      throw new AppError(
        'AWB is required to cancel. Wait until Nimbus assigns an AWB or sync from panel.',
        400
      );
    }
    const result = await thirdPartyAPIService.nimbusCancelShipment(order.awb);
    order.status = ORDER_STATUS.CANCELLED;
    await order.save();
    return result;
  }

  async trackOrder(orderId, userId) {
    const order = await this.getOrderById(orderId, userId);

    if (!order.awb) {
      return {
        orderNumber: order.orderNumber,
        status: order.status,
        message: 'AWB not yet generated. Order is being processed.',
        tracking: null
      };
    }

    try {
      const tracking = await thirdPartyAPIService.trackShipment(
        order.deliveryPartner,
        order.awb
      );

      // Update order status based on tracking
      if (tracking.status) {
        order.status = tracking.status;
        await order.save();
      }

      return {
        orderNumber: order.orderNumber,
        awb: order.awb,
        status: order.status,
        tracking: tracking,
        trackingUrl: order.trackingUrl
      };
    } catch (error) {
      return {
        orderNumber: order.orderNumber,
        awb: order.awb,
        status: order.status,
        message: 'Unable to fetch tracking details',
        error: error.message
      };
    }
  }

  /**
   * Apply NimbusPost webhook payload (flexible field names).
   * Finds order by AWB, metadata.nimbusShipmentId, or metadata.nimbusOrderId.
   */
  async updateOrderFromNimbusWebhook(payload) {
    if (!payload || typeof payload !== 'object') {
      throw new AppError('Invalid webhook body', 400);
    }

    const awbVal =
      payload.awb_number ?? payload.awb ?? payload.awbNumber ?? payload.tracking_number;
    const shipmentId = payload.shipment_id ?? payload.shipmentId;
    const nimbusOrderId = payload.order_id ?? payload.orderId;

    let order = null;
    if (awbVal) {
      order = await Order.findOne({ awb: String(awbVal) });
    }
    if (!order && shipmentId != null) {
      const sid = shipmentId;
      order = await Order.findOne({
        $or: [
          { 'metadata.nimbusShipmentId': sid },
          { 'metadata.nimbusShipmentId': Number(sid) },
          { 'metadata.nimbusShipmentId': String(sid) }
        ]
      });
    }
    if (!order && nimbusOrderId != null) {
      const oid = nimbusOrderId;
      order = await Order.findOne({
        $or: [
          { 'metadata.nimbusOrderId': oid },
          { 'metadata.nimbusOrderId': Number(oid) },
          { 'metadata.nimbusOrderId': String(oid) }
        ]
      });
    }

    if (!order) {
      throw new AppError('Order not found for Nimbus webhook', 404);
    }

    const raw =
      payload.status ??
      payload.order_status ??
      payload.shipment_status ??
      payload.current_status ??
      '';
    const rawStr = raw !== undefined && raw !== null ? String(raw).trim() : '';

    let mapped = null;
    if (rawStr) {
      mapped = this._mapNimbusStatusToOrderStatus(rawStr.toLowerCase());
      if (!Object.values(ORDER_STATUS).includes(mapped)) {
        throw new AppError('Could not map webhook status', 400);
      }
    }

    const previousStatus = order.status;
    if (mapped) {
      order.status = mapped;
    }
    if (awbVal && !order.awb) {
      order.awb = String(awbVal);
    }
    if (payload.tracking_url) {
      order.trackingUrl = payload.tracking_url;
    }
    if (payload.label) {
      order.metadata = {
        ...order.metadata,
        labelUrl: payload.label
      };
    }

    const webhookMeta = {
      lastNimbusWebhookAt: new Date(),
      lastNimbusLocation: payload.location ?? order.metadata?.lastNimbusLocation,
      lastNimbusMessage: payload.message ?? order.metadata?.lastNimbusMessage,
      lastNimbusEventTime: payload.event_time ?? order.metadata?.lastNimbusEventTime,
      lastNimbusRtoAwb: payload.rto_awb ?? order.metadata?.lastNimbusRtoAwb
    };
    if (rawStr) {
      webhookMeta.lastNimbusStatus = rawStr;
    }

    order.metadata = {
      ...order.metadata,
      ...webhookMeta,
      statusHistory: [
        ...(order.metadata?.statusHistory || []),
        mapped
          ? {
              status: mapped,
              previousStatus,
              source: 'nimbuspost_webhook',
              at: new Date(),
              nimbusStatus: rawStr,
              location: payload.location,
              message: payload.message
            }
          : {
              previousStatus,
              source: 'nimbuspost_webhook',
              at: new Date(),
              nimbusStatus: rawStr || '(empty)',
              location: payload.location,
              message: payload.message,
              note: 'status unchanged — empty or unmapped from Nimbus'
            }
      ]
    };

    await order.save();
    return order;
  }

  _mapNimbusStatusToOrderStatus(s) {
    if (!s) return ORDER_STATUS.IN_TRANSIT;
    const t = s.trim();
    if (['booked', 'confirmed', 'processing', 'pending pickup'].includes(t)) {
      return ORDER_STATUS.CONFIRMED;
    }
    if (t.includes('pick') && t.includes('up')) return ORDER_STATUS.PICKED_UP;
    if (t === 'picked_up' || t === 'picked up') return ORDER_STATUS.PICKED_UP;
    if (t.includes('transit') || t === 'in-transit') return ORDER_STATUS.IN_TRANSIT;
    if (t.includes('out for delivery') || t.includes('ofd')) {
      return ORDER_STATUS.OUT_FOR_DELIVERY;
    }
    if (t.includes('delivered')) return ORDER_STATUS.DELIVERED;
    if (t.includes('cancel')) return ORDER_STATUS.CANCELLED;
    if (t.includes('rto')) return ORDER_STATUS.RTO;
    return ORDER_STATUS.IN_TRANSIT;
  }

  /**
   * Update order status (called by webhooks or manual update)
   * @param {String} orderId - Order ID (optional)
   * @param {String} awb - AWB number (optional)
   * @param {String} status - New status
   * @param {Object} trackingData - Additional tracking data
   * @param {String} partner - Delivery partner
   * @returns {Object} Updated order
   */
  async updateOrderStatus(orderId, awb, status, trackingData = {}, partner = null) {
    let order;

    // Find order by orderId or awb
    if (orderId) {
      order = await Order.findById(orderId);
    } else if (awb) {
      order = await Order.findOne({ awb });
    } else {
      throw new AppError('Order ID or AWB is required', 400);
    }

    if (!order) {
      throw new AppError('Order not found', 404);
    }

    // Validate status
    if (!Object.values(ORDER_STATUS).includes(status)) {
      throw new AppError('Invalid order status', 400);
    }

    // Update order status
    const previousStatus = order.status;
    order.status = status;

    // Update AWB if provided
    if (awb && !order.awb) {
      order.awb = awb;
    }

    // Update tracking URL if provided
    if (trackingData.trackingUrl) {
      order.trackingUrl = trackingData.trackingUrl;
    }

    // Store tracking data in metadata
    order.metadata = {
      ...order.metadata,
      statusHistory: [
        ...(order.metadata?.statusHistory || []),
        {
          status,
          previousStatus,
          updatedAt: new Date(),
          source: partner || 'system',
          trackingData
        }
      ],
      lastTrackingUpdate: new Date(),
      ...trackingData
    };

    await order.save();

    return order;
  }
}

module.exports = new OrderService();
