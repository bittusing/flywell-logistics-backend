const walletService = require('../services/wallet.service');
const paymentService = require('../services/payment.service');
const { successResponse } = require('../utils/responseHandler');

/**
 * Wallet Controller - Handles wallet-related requests
 */
class WalletController {
  /**
   * Get wallet balance
   * @route GET /api/wallet/balance
   */
  async getBalance(req, res, next) {
    try {
      const userId = req.user._id;
      const balance = await walletService.getBalance(userId);

      return successResponse(res, balance, 'Balance retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get wallet transactions
   * @route GET /api/wallet/transactions
   */
  async getTransactions(req, res, next) {
    try {
      const userId = req.user._id;
      const filters = {
        type: req.query.type,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20
      };

      const result = await walletService.getTransactions(userId, filters);

      return successResponse(res, result, 'Transactions retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create Razorpay order for wallet recharge
   * @route POST /api/wallet/recharge
   */
  async createRechargeOrder(req, res, next) {
    try {
      const userId = req.user._id;
      const { amount } = req.body;

      const razorpayOrder = await paymentService.createRazorpayOrder(userId, amount);

      return successResponse(
        res,
        razorpayOrder,
        'Payment order created successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Verify and complete wallet recharge
   * @route POST /api/wallet/verify-payment
   */
  async verifyPayment(req, res, next) {
    try {
      const userId = req.user._id;
      const { paymentId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

      // Verify payment
      const payment = await paymentService.verifyAndCompletePayment(paymentId, {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature
      });

      // Check if payment is for wallet recharge
      if (payment.paymentType === 'wallet_recharge' && payment.status === 'completed') {
        // Add money to wallet
        const walletTransaction = await walletService.addMoney(
          userId,
          payment.amount,
          `Wallet recharge via Razorpay - Payment ID: ${razorpay_payment_id}`,
          {
            paymentId: payment._id,
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id
          }
        );

        // Update payment with wallet transaction reference
        payment.walletTransactionId = walletTransaction.transaction._id;
        await payment.save();

        return successResponse(
          res,
          {
            payment: {
              id: payment._id,
              status: payment.status,
              amount: payment.amount
            },
            wallet: {
              balance: walletTransaction.wallet.balance
            }
          },
          'Payment verified and wallet recharged successfully'
        );
      }

      return successResponse(res, { payment }, 'Payment verified successfully');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new WalletController();
