const express = require('express');
const authController = require('../controllers/auth.controller');
const { signupValidation, loginValidation } = require('../validators/auth.validator');
const validate = require('../middleware/validate.middleware');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

/**
 * @route   POST /api/auth/signup
 * @desc    Register a new user
 * @access  Public
 */
router.post(
  '/signup',
  signupValidation,
  validate,
  authController.signup.bind(authController)
);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post(
  '/login',
  loginValidation,
  validate,
  authController.login.bind(authController)
);

/**
 * @route   GET /api/auth/me
 * @desc    Get current logged in user
 * @access  Private
 */
router.get(
  '/me',
  protect,
  authController.getCurrentUser.bind(authController)
);

module.exports = router;
