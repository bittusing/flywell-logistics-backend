const adminService = require('../services/admin.service');
const { successResponse, errorResponse } = require('../utils/responseHandler');

/**
 * Admin Controller - Handles admin panel operations
 */
class AdminController {
  /**
   * Get dashboard statistics
   * @route GET /api/admin/dashboard/stats
   */
  async getDashboardStats(req, res, next) {
    try {
      const stats = await adminService.getDashboardStats();
      return successResponse(res, stats, 'Dashboard statistics retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get revenue analytics
   * @route GET /api/admin/analytics/revenue
   */
  async getRevenueAnalytics(req, res, next) {
    try {
      const { period = '30days' } = req.query;
      const analytics = await adminService.getRevenueAnalytics(period);
      return successResponse(res, analytics, 'Revenue analytics retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get order analytics
   * @route GET /api/admin/analytics/orders
   */
  async getOrderAnalytics(req, res, next) {
    try {
      const { period = '30days' } = req.query;
      const analytics = await adminService.getOrderAnalytics(period);
      return successResponse(res, analytics, 'Order analytics retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all users with pagination
   * @route GET /api/admin/users
   */
  async getAllUsers(req, res, next) {
    try {
      const { page = 1, limit = 10, search = '', kycStatus = '' } = req.query;
      const result = await adminService.getAllUsers({
        page: parseInt(page),
        limit: parseInt(limit),
        search,
        kycStatus
      });
      return successResponse(res, result, 'Users retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user details
   * @route GET /api/admin/users/:userId
   */
  async getUserDetails(req, res, next) {
    try {
      const { userId } = req.params;
      const user = await adminService.getUserDetails(userId);
      return successResponse(res, user, 'User details retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update user status
   * @route PUT /api/admin/users/:userId/status
   */
  async updateUserStatus(req, res, next) {
    try {
      const { userId } = req.params;
      const { isActive } = req.body;
      const user = await adminService.updateUserStatus(userId, isActive);
      return successResponse(res, user, 'User status updated successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all orders with pagination
   * @route GET /api/admin/orders
   */
  async getAllOrders(req, res, next) {
    try {
      const { 
        page = 1, 
        limit = 10, 
        status = '', 
        search = '',
        startDate = '',
        endDate = ''
      } = req.query;
      
      const result = await adminService.getAllOrders({
        page: parseInt(page),
        limit: parseInt(limit),
        status,
        search,
        startDate,
        endDate
      });
      return successResponse(res, result, 'Orders retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get order details
   * @route GET /api/admin/orders/:orderId
   */
  async getOrderDetails(req, res, next) {
    try {
      const { orderId } = req.params;
      const order = await adminService.getOrderDetails(orderId);
      return successResponse(res, order, 'Order details retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get recent activities
   * @route GET /api/admin/activities
   */
  async getRecentActivities(req, res, next) {
    try {
      const { limit = 20 } = req.query;
      const activities = await adminService.getRecentActivities(parseInt(limit));
      return successResponse(res, activities, 'Recent activities retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get top customers
   * @route GET /api/admin/customers/top
   */
  async getTopCustomers(req, res, next) {
    try {
      const { limit = 10 } = req.query;
      const customers = await adminService.getTopCustomers(parseInt(limit));
      return successResponse(res, customers, 'Top customers retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get payment transactions
   * @route GET /api/admin/payments
   */
  async getPaymentTransactions(req, res, next) {
    try {
      const { page = 1, limit = 10, status = '' } = req.query;
      const result = await adminService.getPaymentTransactions({
        page: parseInt(page),
        limit: parseInt(limit),
        status
      });
      return successResponse(res, result, 'Payment transactions retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AdminController();
