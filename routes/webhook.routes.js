const express = require('express');
const webhookController = require('../controllers/webhook.controller');

const router = express.Router();

/**
 * @route   POST /api/webhooks/order-status
 * @desc    Receive order status update from third-party delivery partner
 * @access  Public (should be secured with signature verification)
 */
router.post(
  '/order-status',
  webhookController.handleOrderStatusUpdate.bind(webhookController)
);

/**
 * @route   POST /api/webhooks/razorpay
 * @desc    Receive Razorpay payment webhooks
 * @access  Public (should be secured with signature verification)
 */
router.post(
  '/razorpay',
  webhookController.handleRazorpayWebhook.bind(webhookController)
);

/**
 * @route   POST /api/webhooks/nimbuspost
 * @desc    NimbusPost order/shipment status updates
 * @access  Public — protect with NIMBUSPOST_WEBHOOK_SECRET (header X-Nimbus-Secret or ?secret=)
 */
router.post(
  '/nimbuspost',
  webhookController.handleNimbusWebhook.bind(webhookController)
);

module.exports = router;
