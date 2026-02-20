const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { protect } = require('../middleware/auth.middleware');
const { isAdmin } = require('../middleware/admin.middleware');

// Apply authentication and admin middleware to all routes
router.use(protect);
router.use(isAdmin);

// Dashboard & Analytics
router.get('/dashboard/stats', adminController.getDashboardStats);
router.get('/analytics/revenue', adminController.getRevenueAnalytics);
router.get('/analytics/orders', adminController.getOrderAnalytics);

// Users Management
router.get('/users', adminController.getAllUsers);
router.get('/users/:userId', adminController.getUserDetails);
router.put('/users/:userId/status', adminController.updateUserStatus);

// Orders Management
router.get('/orders', adminController.getAllOrders);
router.get('/orders/:orderId', adminController.getOrderDetails);

// Activities & Insights
router.get('/activities', adminController.getRecentActivities);
router.get('/customers/top', adminController.getTopCustomers);

// Payments
router.get('/payments', adminController.getPaymentTransactions);

module.exports = router;
