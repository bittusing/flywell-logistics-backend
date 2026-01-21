const User = require('../models/User.model');
const AppError = require('../utils/AppError');
const axios = require('axios');

/**
 * KYC Service - Business logic for KYC verification using Sandbox.co.in
 */
class KYCService {
  constructor() {
    // Use SANDBOX_ENVIRONMENT if set, otherwise determine from API key
    const environment = process.env.SANDBOX_ENVIRONMENT;
    
    this.baseURL = 'https://api.sandbox.co.in';
    
    this.apiKey = process.env.SANDBOX_API_KEY;
    this.apiSecret = process.env.SANDBOX_API_SECRET;
    
    console.log('KYC Service initialized:', {
      baseURL: this.baseURL,
      apiKeyPrefix: this.apiKey?.substring(0, 15) + '...',
      environment
    });
  }
  /**
   * Send OTP to Aadhaar number
   * @param {String} aadhaarNumber - Aadhaar number
   * @returns {Object} OTP response with reference_id
   */
  async sendAadhaarOTP(aadhaarNumber) {
    try {
      if (!this.apiKey || !this.apiSecret) {
        throw new AppError('Sandbox API credentials not configured', 500);
      }

      console.log('Sending Aadhaar OTP:', {
        url: `${this.baseURL}/kyc/aadhaar/okyc/otp`,
        apiKeyPrefix: this.apiKey?.substring(0, 15) + '...',
        aadhaarMasked: '****' + aadhaarNumber.slice(-4)
      });

      const response = await axios.post(
        `${this.baseURL}/kyc/aadhaar/okyc/otp`,
        {
          '@entity': 'in.co.sandbox.kyc.aadhaar.okyc.otp.request',
          aadhaar_number: aadhaarNumber,
          consent: 'Y',
          reason: 'KYC verification for shipping account'
        },
        {
          headers: {
            'Authorization': this.apiKey,
            'x-api-key': this.apiKey,
            'x-api-secret': this.apiSecret,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        referenceId: response.data.data.reference_id,
        message: response.data.data.message
      };
    } catch (error) {
      console.error('Aadhaar OTP Error:', error.response?.data || error.message);
      
      // Handle specific error cases
      let errorMessage = 'Failed to send OTP to Aadhaar number';
      
      if (error.response?.data?.code === 403) {
        errorMessage = 'API key does not have permission. Please use live API keys (key_live_*) for KYC verification.';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      throw new AppError(
        errorMessage,
        error.response?.status || 500
      );
    }
  }

  /**
   * Verify Aadhaar OTP
   * @param {String} referenceId - Reference ID from OTP request
   * @param {String} otp - OTP received
   * @returns {Object} Aadhaar verification data
   */
  async verifyAadhaarOTP(referenceId, otp) {
    try {
      if (!this.apiKey || !this.apiSecret) {
        throw new AppError('Sandbox API credentials not configured', 500);
      }

      const response = await axios.post(
        `${this.baseURL}/kyc/aadhaar/okyc/otp/verify`,
        {
          '@entity': 'in.co.sandbox.kyc.aadhaar.okyc.request',
          reference_id: referenceId,
          otp: otp
        },
        {
          headers: {
            'Authorization': this.apiKey,
            'x-api-key': this.apiKey,
            'x-api-secret': this.apiSecret,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = response.data.data;
      
      return {
        success: true,
        status: data.status,
        name: data.name,
        dateOfBirth: data.date_of_birth,
        gender: data.gender,
        address: data.address,
        photo: data.photo,
        fullAddress: data.full_address
      };
    } catch (error) {
      console.error('Aadhaar Verification Error:', error.response?.data || error.message);
      throw new AppError(
        error.response?.data?.message || 'Failed to verify Aadhaar OTP',
        error.response?.status || 500
      );
    }
  }

  /**
   * Verify PAN Card
   * @param {String} pan - PAN number
   * @param {String} nameAsPer PAN - Name as per PAN
   * @param {String} dateOfBirth - Date of birth (DD-MM-YYYY)
   * @returns {Object} PAN verification data
   */
  async verifyPAN(pan, nameAsPerPAN, dateOfBirth) {
    try {
      if (!this.apiKey || !this.apiSecret) {
        throw new AppError('Sandbox API credentials not configured', 500);
      }

      const response = await axios.post(
        `${this.baseURL}/kyc/pan/verify`,
        {
          '@entity': 'in.co.sandbox.kyc.pan_verification.request',
          pan: pan,
          name_as_per_pan: nameAsPerPAN,
          date_of_birth: dateOfBirth,
          consent: 'Y',
          reason: 'KYC verification for shipping account'
        },
        {
          headers: {
            'Authorization': this.apiKey,
            'x-api-key': this.apiKey,
            'x-api-secret': this.apiSecret,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = response.data.data;
      
      return {
        success: true,
        pan: data.pan,
        status: data.status,
        category: data.category,
        nameMatch: data.name_as_per_pan_match,
        dobMatch: data.date_of_birth_match,
        aadhaarSeeding: data.aadhaar_seeding_status
      };
    } catch (error) {
      console.error('PAN Verification Error:', error.response?.data || error.message);
      throw new AppError(
        error.response?.data?.message || 'Failed to verify PAN card',
        error.response?.status || 500
      );
    }
  }

  /**
   * Submit KYC documents (Aadhaar or PAN)
   * @param {String} userId - User ID
   * @param {Object} kycData - KYC document data
   * @returns {Object} Updated user KYC status
   */
  async submitKYC(userId, kycData) {
    const { documentType, documentNumber, name, dateOfBirth, verificationData } = kycData;

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
      name,
      dateOfBirth,
      verificationData: verificationData || {},
      submittedAt: new Date()
    };
    user.kycStatus = 'approved'; // Auto-approve if verified through Sandbox API

    await user.save();

    return {
      kycStatus: user.kycStatus,
      submittedAt: user.kycData.submittedAt,
      approvedAt: new Date()
    };
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
      kycData: user.kycData ? {
        documentType: user.kycData.documentType,
        submittedAt: user.kycData.submittedAt,
        approvedAt: user.kycData.approvedAt
      } : null
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
    if (!user.kycData) {
      user.kycData = {};
    }
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
    if (!user.kycData) {
      user.kycData = {};
    }
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