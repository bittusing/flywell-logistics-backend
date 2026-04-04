const crypto = require('crypto');
const orderService = require('../services/order.service');
const { successResponse } = require('../utils/responseHandler');
const AppError = require('../utils/AppError');

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

  /**
   * NimbusPost shipment updates.
   * Docs: HMAC SHA256 of raw JSON body, base64 in header X-Hmac-SHA256, secret from dashboard.
   * Must respond 200 within 5s or Nimbus marks delivery failed.
   */
  async handleNimbusWebhook(req, res, next) {
    const started = Date.now();
    try {
      const payload =
        req.body && typeof req.body === 'object' && !Array.isArray(req.body)
          ? req.body
          : {};

      console.log('[NimbusWebhook] POST received', {
        awb: payload.awb_number,
        status: payload.status,
        event_time: payload.event_time,
        hasSignature: !!(req.headers['x-hmac-sha256'] || req.headers['X-Hmac-SHA256']),
        rawBodyBytes: req.rawBodyBuffer?.length ?? 0
      });

      const secret = process.env.NIMBUSPOST_WEBHOOK_SECRET;
      const signatureHeader =
        req.headers['x-hmac-sha256'] ||
        req.headers['X-Hmac-SHA256'] ||
        req.headers['X-HMAC-SHA256'];

      if (signatureHeader && secret) {
        if (!req.rawBodyBuffer || !Buffer.isBuffer(req.rawBodyBuffer)) {
          console.error(
            '[NimbusWebhook] HMAC present but rawBodyBuffer missing — express.json verify may not run for this path'
          );
          return res.status(500).json({
            success: false,
            message: 'Server cannot verify webhook signature'
          });
        }

        const expected = crypto
          .createHmac('sha256', secret)
          .update(req.rawBodyBuffer)
          .digest('base64');

        const sig = String(signatureHeader).trim();
        const a = Buffer.from(expected, 'utf8');
        const b = Buffer.from(sig, 'utf8');
        const valid =
          a.length === b.length && crypto.timingSafeEqual(a, b);

        if (!valid) {
          console.warn('[NimbusWebhook] Invalid X-Hmac-SHA256 signature');
          return res.status(401).json({
            success: false,
            message: 'Invalid webhook signature'
          });
        }
        console.log('[NimbusWebhook] HMAC signature OK');
      } else if (signatureHeader && !secret) {
        console.warn(
          '[NimbusWebhook] X-Hmac-SHA256 present but NIMBUSPOST_WEBHOOK_SECRET not set in env — cannot verify'
        );
      } else if (secret && !signatureHeader) {
        console.warn(
          '[NimbusWebhook] NIMBUSPOST_WEBHOOK_SECRET set but no X-Hmac-SHA256 header (Nimbus dashboard secret may be blank — webhooks still processed)'
        );
      }

      try {
        await orderService.updateOrderFromNimbusWebhook(payload);
        console.log('[NimbusWebhook] Order updated', {
          ms: Date.now() - started,
          awb: payload.awb_number
        });
      } catch (err) {
        if (err instanceof AppError && err.statusCode === 404) {
          console.warn('[NimbusWebhook] No local order for payload — 200 OK to satisfy Nimbus retry policy', {
            awb: payload.awb_number,
            message: err.message
          });
          return res.status(200).json({ received: true, ignored: true });
        }
        throw err;
      }

      return res.status(200).json({ received: true });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new WebhookController();
