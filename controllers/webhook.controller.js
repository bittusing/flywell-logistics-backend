const orderService = require('../services/order.service');
const { successResponse } = require('../utils/responseHandler');
const { ORDER_STATUS } = require('../config/constants');

/**
 * Webhook Controller - Handles webhook events from third-party services
 */
class WebhookController {
  /**
   * Handle order status update from delivery partner
   * @route POST /api/webhooks/order-status
   */
  async handleOrderStatusUpdate(req, res, next) {
    try {
      const { orderId, awb, status, trackingData, partner } = req.body;

      if (!orderId && !awb) {
        return res.status(400).json({
          success: false,
          message: 'Order ID or AWB is required'
        });
      }

      // Update order status
      const updatedOrder = await orderService.updateOrderStatus(
        orderId,
        awb,
        status,
        trackingData,
        partner
      );

      return successResponse(
        res,
        { order: updatedOrder },
        'Order status updated successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Handle Razorpay payment webhooks
   * @route POST /api/webhooks/razorpay
   */
  async handleRazorpayWebhook(req, res, next) {
    try {
      // Razorpay webhook handling can be added here
      // For now, just acknowledge receipt
      return res.status(200).json({ received: true });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new WebhookController();
