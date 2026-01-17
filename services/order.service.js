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
    const { deliveryPartner, pickupDetails, deliveryDetails, packageDetails } = orderData;

    if (!Object.values(DELIVERY_PARTNERS).includes(deliveryPartner)) {
      throw new AppError('Invalid delivery partner', 400);
    }

    // Prepare rate calculation data
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
      declaredValue: packageDetails.declaredValue || 0
    };

    try {
      // Get rate from third-party API
      const rateResponse = await thirdPartyAPIService.calculateRate(deliveryPartner, rateData);

      // Calculate total amount
      const baseRate = rateResponse.rate || rateResponse.amount || 0;
      const additionalCharges = rateResponse.additionalCharges || 0;
      const totalAmount = baseRate + additionalCharges;

      return {
        baseRate,
        additionalCharges,
        totalAmount,
        currency: 'INR',
        partner: deliveryPartner,
        estimatedDelivery: rateResponse.estimatedDelivery || null,
        serviceType: rateResponse.serviceType || 'standard'
      };
    } catch (error) {
      // If third-party API fails, use fallback calculation
      console.warn('Third-party API failed, using fallback calculation:', error.message);
      
      // Simple fallback: ₹50 base + ₹10 per kg
      const baseRate = 50;
      const weightCharge = packageDetails.weight * 10;
      const totalAmount = baseRate + weightCharge;

      return {
        baseRate,
        additionalCharges: weightCharge,
        totalAmount,
        currency: 'INR',
        partner: deliveryPartner,
        estimatedDelivery: '3-5 business days',
        serviceType: 'standard',
        note: 'Fallback calculation used'
      };
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
      deliveryPartner
    } = orderData;

    // Calculate rate
    const pricing = await this.calculateRate({
      deliveryPartner,
      pickupDetails,
      deliveryDetails,
      packageDetails
    });

    // Check wallet balance
    const walletBalance = await walletService.getBalance(userId);
    if (walletBalance.balance < pricing.totalAmount) {
      throw new AppError(
        `Insufficient wallet balance. Required: ₹${pricing.totalAmount}, Available: ₹${walletBalance.balance}`,
        400
      );
    }

    // Create order
    const order = await Order.create({
      user: userId,
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
      status: ORDER_STATUS.PENDING,
      payment: {
        status: 'pending',
        method: 'wallet'
      }
    });

    // Deduct amount from wallet
    try {
      const walletTransaction = await walletService.deductMoney(
        userId,
        pricing.totalAmount,
        `Payment for order ${order.orderNumber}`,
        order._id,
        null,
        {
          orderNumber: order.orderNumber,
          deliveryPartner: deliveryPartner
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
          createdAt: order.createdAt
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
        orderId: order.orderNumber
      };

      const shipment = await thirdPartyAPIService.createShipment(
        order.deliveryPartner,
        shipmentData
      );

      // Update order with AWB and tracking
      order.awb = shipment.awb || shipment.trackingNumber;
      order.trackingUrl = shipment.trackingUrl;
      order.status = ORDER_STATUS.CONFIRMED;
      await order.save();

      return shipment;
    } catch (error) {
      console.error('Error creating shipment:', error);
      // Don't throw - order is already created and paid
      // Status will remain PENDING
    }
  }

  /**
   * Get order by ID
   * @param {String} orderId - Order ID
   * @param {String} userId - User ID (for authorization)
   * @returns {Object} Order details
   */
  async getOrderById(orderId, userId) {
    const order = await Order.findById(orderId).populate('user', 'name email phone');

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
}

module.exports = new OrderService();
