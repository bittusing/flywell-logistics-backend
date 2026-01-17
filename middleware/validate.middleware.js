const { validationResult } = require('express-validator');
const AppError = require('../utils/AppError');

/**
 * Middleware to validate request data using express-validator
 * Should be used after validation rules
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.path || error.param,
      message: error.msg
    }));

    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errorMessages
    });
  }

  next();
};

module.exports = validate;
