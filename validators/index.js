/**
 * Validators Index
 * Central export point for all validators
 */

const { signupValidation, loginValidation } = require('./auth.validator');
const { rechargeValidation, verifyPaymentValidation } = require('./wallet.validator');
const { createOrderValidation, calculateRateValidation } = require('./order.validator');

module.exports = {
  signupValidation,
  loginValidation,
  rechargeValidation,
  verifyPaymentValidation,
  createOrderValidation,
  calculateRateValidation
};
