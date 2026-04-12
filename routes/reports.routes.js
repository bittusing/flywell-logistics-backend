const express = require('express');
const router = express.Router();
const reportsController = require('../controllers/reports.controller');
const { protect } = require('../middleware/auth.middleware');
const { isAdmin } = require('../middleware/admin.middleware');

// All routes require authentication and admin role
router.use(protect);
router.use(isAdmin);

/**
 * @route   GET /api/admin/reports/:reportType
 * @desc    Generate report by type
 * @access  Admin only
 */
router.get('/:reportType', reportsController.getReport.bind(reportsController));

/**
 * Individual report endpoints (alternative to unified endpoint)
 */
router.get('/orders/generate', reportsController.generateOrdersReport.bind(reportsController));
router.get('/revenue/generate', reportsController.generateRevenueReport.bind(reportsController));
router.get('/users/generate', reportsController.generateUsersReport.bind(reportsController));
router.get('/support/generate', reportsController.generateSupportReport.bind(reportsController));
router.get('/performance/generate', reportsController.generatePerformanceReport.bind(reportsController));
router.get('/analytics/generate', reportsController.generateAnalyticsReport.bind(reportsController));

module.exports = router;
