const User = require('../models/User.model');
const AppError = require('../utils/AppError');
const axios = require('axios');

/**
 * KYC Service - Business logic for KYC verification
 */
class KYCService {
  /**
   * Submit KYC documents
   * @param {String} userId - User ID
   * @param {Object} kycData - KYC document data
   * @returns {Object} Updated user KYC status
   */
  async submitKYC(userId, kycData) {
    const { documentType, documentNumber, documentImages } = kycData;

    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (user.kycStatus === 'approved') {
      throw new AppError('KYC is already approved', 400);
    }

    // Update user KYC data
    user.kycData = {
      documentType,
      documentNumber,
      documentImages,
      submittedAt: new Date()
    };
    user.kycStatus = 'pending';

    await user.save();

    // Here you can integrate with sandbox.co.in KYC API
    // For now, we'll simulate the process
    try {
      await this.verifyWithSandboxAPI(documentType, documentNumber);
    } catch (error) {
      console.log('KYC API verification failed:', error.message);
      // Continue with manual verification process
    }

    return {
      kycStatus: user.kycStatus,
      submittedAt: user.kycData.submittedAt
    };
  }

  /**
   * Verify KYC with Sandbox API
   * @param {String} documentType - Type of document
   * @param {String} documentNumber - Document number
   */
  async verifyWithSandboxAPI(documentType, documentNumber) {
    try {
      // Sandbox.co.in KYC API integration
      const apiKey = process.env.SANDBOX_API_KEY;
      const apiUrl = 'https://sandbox.co.in/kyc';

      if (!apiKey) {
        throw new AppError('Sandbox API key not configured', 500);
      }

      const response = await axios.post(`${apiUrl}/verify`, {
        document_type: documentType,
        document_number: documentNumber
      }, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data;
    } catch (error) {
      console.error('Sandbox KYC API Error:', error.response?.data || error.message);
      throw new AppError('KYC verification service unavailable', 503);
    }
  }

  /**
   * Get KYC status
   * @param {String} userId - User ID
   * @returns {Object} KYC status and data
   */
  async getKYCStatus(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    return {
      kycStatus: user.kycStatus,
      kycData: user.kycData
    };
  }

  /**
   * Approve KYC (Admin only)
   * @param {String} userId - User ID
   * @returns {Object} Updated KYC status
   */
  async approveKYC(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    user.kycStatus = 'approved';
    user.kycData.approvedAt = new Date();
    await user.save();

    return {
      kycStatus: user.kycStatus,
      approvedAt: user.kycData.approvedAt
    };
  }

  /**
   * Reject KYC (Admin only)
   * @param {String} userId - User ID
   * @param {String} reason - Rejection reason
   * @returns {Object} Updated KYC status
   */
  async rejectKYC(userId, reason) {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    user.kycStatus = 'rejected';
    user.kycData.rejectedAt = new Date();
    user.kycData.rejectionReason = reason;
    await user.save();

    return {
      kycStatus: user.kycStatus,
      rejectedAt: user.kycData.rejectedAt,
      rejectionReason: user.kycData.rejectionReason
    };
  }

  /**
   * Check if user can perform actions (KYC approved)
   * @param {String} userId - User ID
   * @returns {Boolean} Can perform actions
   */
  async canPerformActions(userId) {
    const user = await User.findById(userId);
    if (!user) {
      return false;
    }

    return user.kycStatus === 'approved';
  }
}

module.exports = new KYCService();