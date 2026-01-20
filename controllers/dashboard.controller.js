const dashboardService = require('../services/dashboard.service');
const { successResponse } = require('../utils/responseHandler');

/**
 * Dashboard Controller
 */
class DashboardController {
  /**
   * Get dashboard statistics
   */
  async getStats(req, res, next) {
    try {
      const userId = req.user._id;
      const { type = 'domestic' } = req.query;
      const stats = await dashboardService.getStats(userId, type);

      return successResponse(res, stats, 'Dashboard statistics retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get upcoming pickups
   */
  async getUpcomingPickups(req, res, next) {
    try {
      const userId = req.user._id;
      const { limit = 10, type = 'domestic' } = req.query;

      const pickups = await dashboardService.getUpcomingPickups(userId, parseInt(limit), type);

      return successResponse(res, { pickups }, 'Upcoming pickups retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get performance graph data
   */
  async getPerformanceData(req, res, next) {
    try {
      const userId = req.user._id;
      const { period = '14', type = 'domestic' } = req.query; // days

      const data = await dashboardService.getPerformanceData(userId, parseInt(period), type);

      return successResponse(res, { data }, 'Performance data retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new DashboardController();
