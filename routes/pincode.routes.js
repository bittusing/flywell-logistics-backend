const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const pincodeController = require('../controllers/pincode.controller');
const { protect } = require('../middleware/auth.middleware');
const { isAdmin } = require('../middleware/admin.middleware');

// Configure multer for CSV upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, 'pincodes-' + Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    if (path.extname(file.originalname) !== '.csv') {
      return cb(new Error('Only CSV files are allowed'));
    }
    cb(null, true);
  }
});

// Public route - check serviceability
router.post('/check', pincodeController.checkServiceability);

// Public route - export pincodes
router.get('/export', pincodeController.exportPincodes);

// Admin routes
router.use(protect);
router.use(isAdmin);

router.post('/upload', upload.single('file'), pincodeController.uploadPincodes);
router.get('/all', pincodeController.getAllPincodes);
router.get('/stats', pincodeController.getStatistics);

module.exports = router;
