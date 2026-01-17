const express = require('express');
const orderController = require('../controllers/order.controller');
const { createOrderValidation, calculateRateValidation } = require('../validators/order.validator');
const validate = require('../middleware/validate.middleware');
const { protect } = require('../middleware/auth.middleware');

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
 * @desc    Create delivery order
 * @access  Private
 */
router.post(
  '/',
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
