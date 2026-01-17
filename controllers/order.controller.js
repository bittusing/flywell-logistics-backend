const orderService = require('../services/order.service');
const { successResponse } = require('../utils/responseHandler');

/**
 * Order Controller - Handles order-related requests
 */
class OrderController {
  /**
   * Calculate shipping rate
   * @route POST /api/orders/calculate-rate
   */
  async calculateRate(req, res, next) {
    try {
      const rateData = {
        deliveryPartner: req.body.deliveryPartner,
        pickupDetails: {
          pincode: req.body.pickupPincode,
          city: req.body.pickupCity || '',
          state: req.body.pickupState || ''
        },
        deliveryDetails: {
          pincode: req.body.deliveryPincode,
          city: req.body.deliveryCity || '',
          state: req.body.deliveryState || ''
        },
        packageDetails: {
          weight: req.body.weight,
          dimensions: {
            length: req.body.length || 0,
            width: req.body.width || 0,
            height: req.body.height || 0
          },
          declaredValue: req.body.declaredValue || 0
        }
      };

      const rate = await orderService.calculateRate(rateData);

      return successResponse(res, rate, 'Rate calculated successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create delivery order
   * @route POST /api/orders
   */
  async createOrder(req, res, next) {
    try {
      const userId = req.user._id;
      const orderData = req.body;

      const result = await orderService.createOrder(userId, orderData);

      return successResponse(
        res,
        result,
        'Order created successfully',
        201
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get order by ID
   * @route GET /api/orders/:id
   */
  async getOrderById(req, res, next) {
    try {
      const userId = req.user._id;
      const orderId = req.params.id;

      const order = await orderService.getOrderById(orderId, userId);

      return successResponse(res, { order }, 'Order retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user orders
   * @route GET /api/orders
   */
  async getUserOrders(req, res, next) {
    try {
      const userId = req.user._id;
      const filters = {
        status: req.query.status,
        deliveryPartner: req.query.deliveryPartner,
        limit: parseInt(req.query.limit) || 50,
        skip: parseInt(req.query.skip) || 0
      };

      const orders = await orderService.getUserOrders(userId, filters);

      return successResponse(res, { orders }, 'Orders retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Track order
   * @route GET /api/orders/:id/track
   */
  async trackOrder(req, res, next) {
    try {
      const userId = req.user._id;
      const orderId = req.params.id;

      const tracking = await orderService.trackOrder(orderId, userId);

      return successResponse(res, tracking, 'Tracking information retrieved');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new OrderController();
