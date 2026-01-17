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

module.exports = router;
