const kycService = require('../services/kyc.service');
const AppError = require('../utils/AppError');

/**
 * Middleware to check if user has approved KYC
 */
const requireKYC = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const canPerform = await kycService.canPerformActions(userId);

    if (!canPerform) {
      return next(new AppError('KYC verification required. Please complete your KYC verification to access this feature.', 403));
    }

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { requireKYC };