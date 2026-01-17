const { body } = require('express-validator');

/**
 * Validation rules for user signup
 */
const signupValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2 })
    .withMessage('Name must be at least 2 characters')
    .isLength({ max: 100 })
    .withMessage('Name must not exceed 100 characters'),
  
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail()
    .isLength({ max: 255 })
    .withMessage('Email must not exceed 255 characters'),
  
  body('phone')
    .matches(/^[0-9]{10}$/)
    .withMessage('Please provide a valid 10-digit phone number'),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters')
    .isLength({ max: 128 })
    .withMessage('Password must not exceed 128 characters'),
  
  body('termsAccepted')
    .custom((value) => {
      if (value === true || value === 'true' || value === true) {
        return true;
      }
      throw new Error('You must accept the terms and conditions');
    })
];

/**
 * Validation rules for user login
 */
const loginValidation = [
  body('email')
    .optional()
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  
  body('phone')
    .optional()
    .matches(/^[0-9]{10}$/)
    .withMessage('Please provide a valid 10-digit phone number'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 1 })
    .withMessage('Password cannot be empty'),
  
  body()
    .custom((value) => {
      if (!value.email && !value.phone) {
        throw new Error('Please provide either email or phone number');
      }
      return true;
    })
];

module.exports = {
  signupValidation,
  loginValidation
};
