const express = require('express');
const kycController = require('../controllers/kyc.controller');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

// All routes require authentication
router.use(protect);

/**
 * @route   POST /api/kyc/aadhaar/send-otp
 * @desc    Send OTP to Aadhaar registered mobile
 * @access  Private
 */
router.post('/aadhaar/send-otp', kycController.sendAadhaarOTP);

/**
 * @route   POST /api/kyc/aadhaar/verify-otp
 * @desc    Verify Aadhaar OTP and complete KYC
 * @access  Private
 */
router.post('/aadhaar/verify-otp', kycController.verifyAadhaarOTP);

/**
 * @route   POST /api/kyc/pan/verify
 * @desc    Verify PAN and complete KYC
 * @access  Private
 */
router.post('/pan/verify', kycController.verifyPAN);

/**
 * @route   POST /api/kyc/submit
 * @desc    Submit KYC documents (legacy)
 * @access  Private
 */
router.post('/submit', kycController.submitKYC);

/**
 * @route   GET /api/kyc/status
 * @desc    Get KYC status
 * @access  Private
 */
router.get('/status', kycController.getKYCStatus);

/**
 * @route   PUT /api/kyc/approve/:userId
 * @desc    Approve KYC (Admin only)
 * @access  Private (Admin)
 */
router.put('/approve/:userId', kycController.approveKYC);

/**
 * @route   PUT /api/kyc/reject/:userId
 * @desc    Reject KYC (Admin only)
 * @access  Private (Admin)
 */
router.put('/reject/:userId', kycController.rejectKYC);

module.exports = router;
