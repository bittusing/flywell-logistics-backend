const express = require('express');
const router = express.Router();
const bankAccountController = require('../controllers/bankAccount.controller');
const { protect } = require('../middleware/auth.middleware');
const { isAdmin } = require('../middleware/admin.middleware');

// User routes - require authentication
router.use(protect);

router.post('/', bankAccountController.addBankAccount);
router.get('/', bankAccountController.getBankAccount);
router.delete('/', bankAccountController.deleteBankAccount);

// Admin routes
router.put('/verify/:userId', isAdmin, bankAccountController.verifyBankAccount);

module.exports = router;
