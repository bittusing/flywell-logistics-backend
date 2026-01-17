const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const { protect } = require('../middleware/auth.middleware');

// All routes require authentication
router.use(protect);

/**
 * @route   GET /api/dashboard/stats
 * @desc    Get dashboard statistics
 * @access  Private
 */
router.get('/stats', dashboardController.getStats);

/**
 * @route   GET /api/dashboard/upcoming-pickups
 * @desc    Get upcoming pickups
 * @access  Private
 */
router.get('/upcoming-pickups', dashboardController.getUpcomingPickups);

/**
 * @route   GET /api/dashboard/performance
 * @desc    Get performance graph data
 * @access  Private
 */
router.get('/performance', dashboardController.getPerformanceData);

module.exports = router;
