const express = require('express');
const router = express.Router();
const awbController = require('../controllers/awb.controller');
const { protect } = require('../middleware/auth.middleware');

// All routes require authentication
router.use(protect);

/**
 * @route   POST /api/awb/fetch
 * @desc    Fetch AWB numbers from delivery partner
 * @access  Private
 */
router.post('/fetch', awbController.fetchAWBNumbers.bind(awbController));

/**
 * @route   GET /api/awb/download
 * @desc    Download AWB numbers as CSV
 * @access  Private
 */
router.get('/download', awbController.downloadAWBCSV.bind(awbController));

module.exports = router;
