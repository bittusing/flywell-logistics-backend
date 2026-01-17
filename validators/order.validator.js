const { body } = require('express-validator');
const { DELIVERY_PARTNERS } = require('../config/constants');

/**
 * Validation rules for order creation
 */
const createOrderValidation = [
  // Pickup Details
  body('pickupDetails.name')
    .trim()
    .notEmpty()
    .withMessage('Pickup name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Pickup name must be between 2 and 100 characters'),
  
  body('pickupDetails.phone')
    .matches(/^[0-9]{10}$/)
    .withMessage('Pickup phone must be a valid 10-digit number'),
  
  body('pickupDetails.address')
    .trim()
    .notEmpty()
    .withMessage('Pickup address is required')
    .isLength({ min: 10, max: 500 })
    .withMessage('Pickup address must be between 10 and 500 characters'),
  
  body('pickupDetails.pincode')
    .matches(/^[0-9]{6}$/)
    .withMessage('Pickup pincode must be a valid 6-digit number'),
  
  body('pickupDetails.city')
    .trim()
    .notEmpty()
    .withMessage('Pickup city is required'),
  
  body('pickupDetails.state')
    .trim()
    .notEmpty()
    .withMessage('Pickup state is required'),

  // Delivery Details
  body('deliveryDetails.name')
    .trim()
    .notEmpty()
    .withMessage('Delivery name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Delivery name must be between 2 and 100 characters'),
  
  body('deliveryDetails.phone')
    .matches(/^[0-9]{10}$/)
    .withMessage('Delivery phone must be a valid 10-digit number'),
  
  body('deliveryDetails.address')
    .trim()
    .notEmpty()
    .withMessage('Delivery address is required')
    .isLength({ min: 10, max: 500 })
    .withMessage('Delivery address must be between 10 and 500 characters'),
  
  body('deliveryDetails.pincode')
    .matches(/^[0-9]{6}$/)
    .withMessage('Delivery pincode must be a valid 6-digit number'),
  
  body('deliveryDetails.city')
    .trim()
    .notEmpty()
    .withMessage('Delivery city is required'),
  
  body('deliveryDetails.state')
    .trim()
    .notEmpty()
    .withMessage('Delivery state is required'),

  // Package Details
  body('packageDetails.weight')
    .isFloat({ min: 0.1 })
    .withMessage('Package weight must be at least 0.1 kg')
    .isFloat({ max: 100 })
    .withMessage('Package weight cannot exceed 100 kg'),
  
  body('packageDetails.dimensions.length')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Length must be a positive number'),
  
  body('packageDetails.dimensions.width')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Width must be a positive number'),
  
  body('packageDetails.dimensions.height')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Height must be a positive number'),
  
  body('packageDetails.declaredValue')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Declared value must be a positive number'),

  // Delivery Partner
  body('deliveryPartner')
    .isIn(Object.values(DELIVERY_PARTNERS))
    .withMessage('Invalid delivery partner')
];

/**
 * Validation rules for rate calculation
 */
const calculateRateValidation = [
  body('pickupPincode')
    .matches(/^[0-9]{6}$/)
    .withMessage('Pickup pincode must be a valid 6-digit number'),
  
  body('deliveryPincode')
    .matches(/^[0-9]{6}$/)
    .withMessage('Delivery pincode must be a valid 6-digit number'),
  
  body('weight')
    .isFloat({ min: 0.1 })
    .withMessage('Weight must be at least 0.1 kg')
    .isFloat({ max: 100 })
    .withMessage('Weight cannot exceed 100 kg'),
  
  body('deliveryPartner')
    .isIn(Object.values(DELIVERY_PARTNERS))
    .withMessage('Invalid delivery partner')
];

module.exports = {
  createOrderValidation,
  calculateRateValidation
};
