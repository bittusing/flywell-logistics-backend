const bankAccountService = require('../services/bankAccount.service');
const { successResponse, errorResponse } = require('../utils/responseHandler');

/**
 * Bank Account Controller - Handles bank account operations
 */
class BankAccountController {
  /**
   * Add/Update bank account
   * @route POST /api/bank-account
   */
  async addBankAccount(req, res, next) {
    try {
      const userId = req.user._id;
      const bankData = req.body;

      const result = await bankAccountService.addOrUpdateBankAccount(userId, bankData);

      return successResponse(
        res,
        result,
        'Bank account details saved successfully',
        201
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user's bank account
   * @route GET /api/bank-account
   */
  async getBankAccount(req, res, next) {
    try {
      const userId = req.user._id;
      const bankAccount = await bankAccountService.getBankAccount(userId);

      return successResponse(
        res,
        bankAccount,
        'Bank account details retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete bank account
   * @route DELETE /api/bank-account
   */
  async deleteBankAccount(req, res, next) {
    try {
      const userId = req.user._id;
      await bankAccountService.deleteBankAccount(userId);

      return successResponse(
        res,
        null,
        'Bank account deleted successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Verify bank account (Admin only)
   * @route PUT /api/bank-account/verify/:userId
   */
  async verifyBankAccount(req, res, next) {
    try {
      const { userId } = req.params;
      const { status } = req.body;

      const result = await bankAccountService.verifyBankAccount(userId, status);

      return successResponse(
        res,
        result,
        'Bank account verification status updated'
      );
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new BankAccountController();
