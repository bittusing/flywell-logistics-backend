const authService = require('../services/auth.service');
const { successResponse, errorResponse } = require('../utils/responseHandler');

/**
 * Auth Controller - Handles HTTP request/response for authentication
 */
class AuthController {
  /**
   * Register a new user
   * @route POST /api/auth/signup
   */
  async signup(req, res, next) {
    try {
      const userData = req.body;
      const result = await authService.signup(userData);

      return successResponse(
        res,
        {
          user: result.user,
          token: result.token
        },
        'User registered successfully',
        201
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Login user
   * @route POST /api/auth/login
   */
  async login(req, res, next) {
    try {
      const credentials = req.body;
      const result = await authService.login(credentials);

      return successResponse(
        res,
        {
          user: result.user,
          token: result.token
        },
        'Login successful'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get current logged in user
   * @route GET /api/auth/me
   */
  async getCurrentUser(req, res, next) {
    try {
      const userId = req.user._id;
      const user = await authService.getCurrentUser(userId);

      return successResponse(
        res,
        { user },
        'User retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuthController();
