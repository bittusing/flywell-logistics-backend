const express = require('express');
const authController = require('../controllers/auth.controller');
const {
  signupValidation,
  loginValidation,
  googleAuthValidation,
  forgotPasswordValidation,
  resetPasswordValidation
} = require('../validators/auth.validator');
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
 * @route   POST /api/auth/google
 * @desc    Sign in or sign up with Google ID token
 * @access  Public
 */
router.post(
  '/google',
  googleAuthValidation,
  validate,
  authController.googleAuth.bind(authController)
);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset email
 * @access  Public
 */
router.post(
  '/forgot-password',
  forgotPasswordValidation,
  validate,
  authController.forgotPassword.bind(authController)
);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Set new password with token from email
 * @access  Public
 */
router.post(
  '/reset-password',
  resetPasswordValidation,
  validate,
  authController.resetPassword.bind(authController)
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
