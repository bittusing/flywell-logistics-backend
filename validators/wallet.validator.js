const { body } = require('express-validator');

/**
 * Validation rules for wallet recharge
 */
const rechargeValidation = [
  body('amount')
    .isFloat({ min: 1 })
    .withMessage('Amount must be at least ₹1')
    .isFloat({ max: 100000 })
    .withMessage('Maximum recharge amount is ₹1,00,000')
    .custom((value) => {
      if (isNaN(value) || value <= 0) {
        throw new Error('Amount must be a positive number');
      }
      return true;
    })
];

/**
 * Validation rules for payment verification
 */
const verifyPaymentValidation = [
  body('paymentId')
    .notEmpty()
    .withMessage('Payment ID is required')
    .isMongoId()
    .withMessage('Invalid payment ID'),
  
  body('razorpay_order_id')
    .notEmpty()
    .withMessage('Razorpay order ID is required'),
  
  body('razorpay_payment_id')
    .notEmpty()
    .withMessage('Razorpay payment ID is required'),
  
  body('razorpay_signature')
    .notEmpty()
    .withMessage('Razorpay signature is required')
];

module.exports = {
  rechargeValidation,
  verifyPaymentValidation
};
