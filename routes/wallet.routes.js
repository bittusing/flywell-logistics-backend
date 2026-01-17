const express = require('express');
const walletController = require('../controllers/wallet.controller');
const { rechargeValidation, verifyPaymentValidation } = require('../validators/wallet.validator');
const validate = require('../middleware/validate.middleware');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

// All wallet routes require authentication
router.use(protect);

/**
 * @route   GET /api/wallet/balance
 * @desc    Get wallet balance
 * @access  Private
 */
router.get(
  '/balance',
  walletController.getBalance.bind(walletController)
);

/**
 * @route   GET /api/wallet/transactions
 * @desc    Get wallet transactions
 * @access  Private
 */
router.get(
  '/transactions',
  walletController.getTransactions.bind(walletController)
);

/**
 * @route   POST /api/wallet/recharge
 * @desc    Create Razorpay order for wallet recharge
 * @access  Private
 */
router.post(
  '/recharge',
  rechargeValidation,
  validate,
  walletController.createRechargeOrder.bind(walletController)
);

/**
 * @route   POST /api/wallet/verify-payment
 * @desc    Verify Razorpay payment and add money to wallet
 * @access  Private
 */
router.post(
  '/verify-payment',
  verifyPaymentValidation,
  validate,
  walletController.verifyPayment.bind(walletController)
);

module.exports = router;
