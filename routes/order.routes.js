const express = require('express');
const orderController = require('../controllers/order.controller');
const { createOrderValidation, calculateRateValidation } = require('../validators/order.validator');
const validate = require('../middleware/validate.middleware');
const { protect } = require('../middleware/auth.middleware');
const { requireKYC } = require('../middleware/kyc.middleware');

const router = express.Router();

// All order routes require authentication
router.use(protect);

/**
 * @route   POST /api/orders/calculate-rate
 * @desc    Calculate shipping rate
 * @access  Private
 */
router.post(
  '/calculate-rate',
  calculateRateValidation,
  validate,
  orderController.calculateRate.bind(orderController)
);

/**
 * @route   POST /api/orders
 * @desc    Create delivery order (requires KYC)
 * @access  Private
 */
router.post(
  '/',
  requireKYC,
  createOrderValidation,
  validate,
  orderController.createOrder.bind(orderController)
);

/**
 * @route   GET /api/orders
 * @desc    Get user orders
 * @access  Private
 */
router.get(
  '/',
  orderController.getUserOrders.bind(orderController)
);

/**
 * @route   POST /api/orders/:id/nimbus/pickup
 * @desc    Raise Nimbus pickup (ship.nimbuspost.com, NP-API-KEY)
 * @access  Private
 */
router.post(
  '/:id/nimbus/pickup',
  orderController.requestNimbusPickup.bind(orderController)
);

/**
 * @route   POST /api/orders/:id/nimbus/label
 * @desc    Download Nimbus shipping label PDF
 * @access  Private
 */
router.post(
  '/:id/nimbus/label',
  orderController.downloadNimbusLabel.bind(orderController)
);

/**
 * @route   POST /api/orders/:id/nimbus/cancel
 * @desc    Cancel shipment on Nimbus (api v1 /shipments/cancel, AWB)
 * @access  Private
 */
router.post(
  '/:id/nimbus/cancel',
  orderController.cancelNimbusShipment.bind(orderController)
);

/**
 * @route   GET /api/orders/:id
 * @desc    Get order by ID
 * @access  Private
 */
router.get(
  '/:id',
  orderController.getOrderById.bind(orderController)
);

/**
 * @route   GET /api/orders/:id/track
 * @desc    Track order
 * @access  Private
 */
router.get(
  '/:id/track',
  orderController.trackOrder.bind(orderController)
);

module.exports = router;
