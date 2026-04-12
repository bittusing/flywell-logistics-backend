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

  /**
   * @route POST /api/auth/google
   */
  async googleAuth(req, res, next) {
    try {
      const result = await authService.googleAuth(req.body);

      return successResponse(
        res,
        {
          user: result.user,
          token: result.token
        },
        'Signed in with Google successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route POST /api/auth/forgot-password
   */
  async forgotPassword(req, res, next) {
    try {
      const result = await authService.forgotPassword(req.body);

      return successResponse(res, { message: result.message }, result.message);
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route POST /api/auth/reset-password
   */
  async resetPassword(req, res, next) {
    try {
      const result = await authService.resetPassword(req.body);

      return successResponse(res, { message: result.message }, result.message);
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route POST /api/auth/change-password
   */
  async changePassword(req, res, next) {
    try {
      const result = await authService.changePassword(req.user._id, req.body);
      return successResponse(res, { message: result.message }, result.message);
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route PATCH /api/auth/update-me
   */
  async updateMe(req, res, next) {
    try {
      const result = await authService.updateMe(req.user._id, req.body);
      return successResponse(res, { user: result }, 'Profile updated successfully');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuthController();
