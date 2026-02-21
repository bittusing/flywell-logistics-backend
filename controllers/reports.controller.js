const reportsService = require('../services/reports.service');
const { successResponse } = require('../utils/responseHandler');
const AppError = require('../utils/AppError');

/**
 * Reports Controller - Handles report generation requests
 */
class ReportsController {
  /**
   * Generate Orders Report
   */
  async generateOrdersReport(req, res, next) {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        throw new AppError('Start date and end date are required', 400);
      }

      const csvData = await reportsService.generateOrdersReport(startDate, endDate);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=orders-report-${Date.now()}.csv`);
      
      return res.send(csvData);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Generate Revenue Report
   */
  async generateRevenueReport(req, res, next) {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        throw new AppError('Start date and end date are required', 400);
      }

      const csvData = await reportsService.generateRevenueReport(startDate, endDate);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=revenue-report-${Date.now()}.csv`);
      
      return res.send(csvData);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Generate Users Report
   */
  async generateUsersReport(req, res, next) {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        throw new AppError('Start date and end date are required', 400);
      }

      const csvData = await reportsService.generateUsersReport(startDate, endDate);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=users-report-${Date.now()}.csv`);
      
      return res.send(csvData);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Generate Support Tickets Report
   */
  async generateSupportReport(req, res, next) {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        throw new AppError('Start date and end date are required', 400);
      }

      const csvData = await reportsService.generateSupportReport(startDate, endDate);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=support-report-${Date.now()}.csv`);
      
      return res.send(csvData);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Generate Performance Report
   */
  async generatePerformanceReport(req, res, next) {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        throw new AppError('Start date and end date are required', 400);
      }

      const csvData = await reportsService.generatePerformanceReport(startDate, endDate);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=performance-report-${Date.now()}.csv`);
      
      return res.send(csvData);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Generate Analytics Report
   */
  async generateAnalyticsReport(req, res, next) {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        throw new AppError('Start date and end date are required', 400);
      }

      const csvData = await reportsService.generateAnalyticsReport(startDate, endDate);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=analytics-report-${Date.now()}.csv`);
      
      return res.send(csvData);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get report by type (unified endpoint)
   */
  async getReport(req, res, next) {
    try {
      const { reportType } = req.params;
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        throw new AppError('Start date and end date are required', 400);
      }

      let csvData;

      switch (reportType) {
        case 'orders':
          csvData = await reportsService.generateOrdersReport(startDate, endDate);
          break;
        case 'revenue':
          csvData = await reportsService.generateRevenueReport(startDate, endDate);
          break;
        case 'users':
          csvData = await reportsService.generateUsersReport(startDate, endDate);
          break;
        case 'support':
          csvData = await reportsService.generateSupportReport(startDate, endDate);
          break;
        case 'performance':
          csvData = await reportsService.generatePerformanceReport(startDate, endDate);
          break;
        case 'analytics':
          csvData = await reportsService.generateAnalyticsReport(startDate, endDate);
          break;
        default:
          throw new AppError('Invalid report type', 400);
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${reportType}-report-${Date.now()}.csv`);
      
      return res.send(csvData);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ReportsController();
