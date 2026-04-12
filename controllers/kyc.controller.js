const kycService = require('../services/kyc.service');
const { successResponse, errorResponse } = require('../utils/responseHandler');

/**
 * KYC Controller - Handles HTTP request/response for KYC verification
 */
class KYCController {
  /**
   * Send OTP to Aadhaar number
   * @route POST /api/kyc/aadhaar/send-otp
   */
  async sendAadhaarOTP(req, res, next) {
    try {
      const { aadhaarNumber } = req.body;

      if (!aadhaarNumber || aadhaarNumber.length !== 12) {
        return errorResponse(res, 'Valid 12-digit Aadhaar number is required', 400);
      }

      const result = await kycService.sendAadhaarOTP(aadhaarNumber);

      return successResponse(
        res,
        result,
        'OTP sent successfully to registered mobile number'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Verify Aadhaar OTP and complete KYC
   * @route POST /api/kyc/aadhaar/verify-otp
   */
  async verifyAadhaarOTP(req, res, next) {
    try {
      const userId = req.user._id;
      const { referenceId, otp } = req.body;

      if (!referenceId || !otp) {
        return errorResponse(res, 'Reference ID and OTP are required', 400);
      }

      // Verify OTP with Sandbox API
      const verificationData = await kycService.verifyAadhaarOTP(referenceId, otp);

      if (verificationData.status !== 'VALID') {
        return errorResponse(res, 'Aadhaar verification failed', 400);
      }

      // Submit KYC with verified data
      const result = await kycService.submitKYC(userId, {
        documentType: 'aadhaar',
        documentNumber: '****', // Masked for security
        name: verificationData.name,
        dateOfBirth: verificationData.dateOfBirth,
        verificationData: {
          address: verificationData.address,
          gender: verificationData.gender,
          photo: verificationData.photo
        }
      });

      return successResponse(
        res,
        result,
        'Aadhaar verified and KYC completed successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Verify PAN and complete KYC
   * @route POST /api/kyc/pan/verify
   */
  async verifyPAN(req, res, next) {
    try {
      const userId = req.user._id;
      const { pan, nameAsPerPAN, dateOfBirth } = req.body;

      if (!pan || !nameAsPerPAN || !dateOfBirth) {
        return errorResponse(res, 'PAN, name, and date of birth are required', 400);
      }

      // Verify PAN with Sandbox API
      const verificationData = await kycService.verifyPAN(pan, nameAsPerPAN, dateOfBirth);

      if (verificationData.status !== 'valid') {
        return errorResponse(res, 'PAN verification failed', 400);
      }

      if (!verificationData.nameMatch || !verificationData.dobMatch) {
        return errorResponse(res, 'Name or date of birth does not match PAN records', 400);
      }

      // Submit KYC with verified data
      const result = await kycService.submitKYC(userId, {
        documentType: 'pan',
        documentNumber: pan,
        name: nameAsPerPAN,
        dateOfBirth: dateOfBirth,
        verificationData: {
          category: verificationData.category,
          aadhaarSeeding: verificationData.aadhaarSeeding
        }
      });

      return successResponse(
        res,
        result,
        'PAN verified and KYC completed successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Submit KYC documents (legacy method)
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