const kycService = require('../services/kyc.service');
const { successResponse, errorResponse } = require('../utils/responseHandler');

/**
 * KYC Controller - Handles HTTP request/response for KYC verification
 */
class KYCController {
  /**
   * Submit KYC documents
   * @route POST /api/kyc/submit
   */
  async submitKYC(req, res, next) {
    try {
      const userId = req.user._id;
      const kycData = req.body;

      const result = await kycService.submitKYC(userId, kycData);

      return successResponse(
        res,
        result,
        'KYC documents submitted successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get KYC status
   * @route GET /api/kyc/status
   */
  async getKYCStatus(req, res, next) {
    try {
      const userId = req.user._id;
      const result = await kycService.getKYCStatus(userId);

      return successResponse(
        res,
        result,
        'KYC status retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Approve KYC (Admin only)
   * @route PUT /api/kyc/approve/:userId
   */
  async approveKYC(req, res, next) {
    try {
      const { userId } = req.params;
      const result = await kycService.approveKYC(userId);

      return successResponse(
        res,
        result,
        'KYC approved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Reject KYC (Admin only)
   * @route PUT /api/kyc/reject/:userId
   */
  async rejectKYC(req, res, next) {
    try {
      const { userId } = req.params;
      const { reason } = req.body;

      const result = await kycService.rejectKYC(userId, reason);

      return successResponse(
        res,
        result,
        'KYC rejected successfully'
      );
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new KYCController();