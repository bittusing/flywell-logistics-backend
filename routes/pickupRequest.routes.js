const express = require('express');
const router = express.Router();
const pickupRequestController = require('../controllers/pickupRequest.controller');
const { protect } = require('../middleware/auth.middleware');

// All routes require authentication
router.use(protect);

/**
 * @route   POST /api/pickup-requests
 * @desc    Create pickup request
 * @access  Private
 */
router.post('/', pickupRequestController.createPickupRequest.bind(pickupRequestController));

/**
 * @route   GET /api/pickup-requests
 * @desc    Get user pickup requests with filters
 * @access  Private
 */
router.get('/', pickupRequestController.getUserPickupRequests.bind(pickupRequestController));

/**
 * @route   GET /api/pickup-requests/locations
 * @desc    Get available pickup locations
 * @access  Private
 */
router.get('/locations', pickupRequestController.getPickupLocations.bind(pickupRequestController));

/**
 * @route   GET /api/pickup-requests/available-orders
 * @desc    Get available orders for pickup
 * @access  Private
 */
router.get('/available-orders', pickupRequestController.getAvailableOrders.bind(pickupRequestController));

/**
 * @route   GET /api/pickup-requests/:id
 * @desc    Get pickup request by ID
 * @access  Private
 */
router.get('/:id', pickupRequestController.getPickupRequestById.bind(pickupRequestController));

module.exports = router;
