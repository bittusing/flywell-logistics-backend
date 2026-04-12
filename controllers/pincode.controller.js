const pincodeService = require('../services/pincode.service');
const { successResponse, errorResponse } = require('../utils/responseHandler');

/**
 * Pincode Controller - Handles pincode serviceability operations
 */
class PincodeController {
  /**
   * Check pincode serviceability
   * @route POST /api/pincode/check
   */
  async checkServiceability(req, res, next) {
    try {
      const { pincode } = req.body;

      if (!pincode) {
        return errorResponse(res, 'Pincode is required', 400);
      }

      const result = await pincodeService.checkServiceability(pincode);

      return successResponse(
        res,
        result,
        result.message
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Upload pincodes CSV (Admin only)
   * @route POST /api/pincode/upload
   */
  async uploadPincodes(req, res, next) {
    try {
      if (!req.file) {
        return errorResponse(res, 'CSV file is required', 400);
      }

      const result = await pincodeService.uploadPincodes(req.file.path);

      return successResponse(
        res,
        result,
        result.message
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Export pincodes CSV
   * @route GET /api/pincode/export
   */
  async exportPincodes(req, res, next) {
    try {
      const csv = await pincodeService.exportPincodes();

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=pincodes.csv');
      res.send(csv);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all pincodes (Admin only)
   * @route GET /api/pincode/all
   */
  async getAllPincodes(req, res, next) {
    try {
      const { page = 1, limit = 50, search = '' } = req.query;

      const result = await pincodeService.getAllPincodes({
        page: parseInt(page),
        limit: parseInt(limit),
        search
      });

      return successResponse(
        res,
        result,
        'Pincodes retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get pincode statistics (Admin only)
   * @route GET /api/pincode/stats
   */
  async getStatistics(req, res, next) {
    try {
      const stats = await pincodeService.getStatistics();

      return successResponse(
        res,
        stats,
        'Statistics retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new PincodeController();
