const express = require('express');
const kycController = require('../controllers/kyc.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { requireKYC } = require('../middleware/kyc.middleware');

const router = express.Router();

// All routes require authentication
// router.use(authenticate);

/**
 * @route   POST /api/kyc/submit
 * @desc    Submit KYC documents
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