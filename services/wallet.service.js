const Wallet = require('../models/Wallet.model');
const AppError = require('../utils/AppError');
const { TRANSACTION_TYPES } = require('../config/constants');

/**
 * Wallet Service - Handles wallet transactions and balance management
 */
class WalletService {
  /**
   * Get wallet by user ID
   * @param {String} userId - User ID
   * @returns {Object} Wallet details
   */
  async getWalletByUserId(userId) {
    let wallet = await Wallet.findOne({ user: userId });

    if (!wallet) {
      // Create wallet if doesn't exist
      wallet = await Wallet.create({
        user: userId,
        balance: 0
      });
    }

    return wallet;
  }

  /**
   * Add money to wallet (Credit)
   * @param {String} userId - User ID
   * @param {Number} amount - Amount to add
   * @param {String} description - Transaction description
   * @param {Object} metadata - Additional metadata
   * @returns {Object} Transaction details
   */
  async addMoney(userId, amount, description, metadata = {}) {
    if (amount <= 0) {
      throw new AppError('Amount must be greater than 0', 400);
    }

    const wallet = await this.getWalletByUserId(userId);

    const transaction = {
      type: TRANSACTION_TYPES.CREDIT,
      amount: amount,
      description: description || 'Wallet recharge',
      metadata: {
        ...metadata,
        addedAt: new Date()
      }
    };

    await wallet.addTransaction(
      transaction.type,
      transaction.amount,
      transaction.description,
      null,
      null,
      transaction.metadata
    );

    // Reload wallet to get updated balance
    await wallet.populate('user', 'name email');

    return {
      wallet: {
        id: wallet._id,
        balance: wallet.balance,
        userId: wallet.user._id
      },
      transaction
    };
  }

  /**
   * Deduct money from wallet (Debit)
   * @param {String} userId - User ID
   * @param {Number} amount - Amount to deduct
   * @param {String} description - Transaction description
   * @param {String} orderId - Order ID (optional)
   * @param {String} awb - AWB number (optional)
   * @param {Object} metadata - Additional metadata
   * @returns {Object} Transaction details
   */
  async deductMoney(userId, amount, description, orderId = null, awb = null, metadata = {}) {
    if (amount <= 0) {
      throw new AppError('Amount must be greater than 0', 400);
    }

    const wallet = await this.getWalletByUserId(userId);

    if (wallet.balance < amount) {
      throw new AppError('Insufficient wallet balance', 400);
    }

    const transaction = {
      type: TRANSACTION_TYPES.DEBIT,
      amount: amount,
      description: description || 'Order payment',
      orderId: orderId,
      awb: awb,
      metadata: {
        ...metadata,
        deductedAt: new Date()
      }
    };

    await wallet.addTransaction(
      transaction.type,
      transaction.amount,
      transaction.description,
      transaction.orderId,
      transaction.awb,
      transaction.metadata
    );

    // Reload wallet to get updated balance
    await wallet.populate('user', 'name email');

    return {
      wallet: {
        id: wallet._id,
        balance: wallet.balance,
        userId: wallet.user._id
      },
      transaction
    };
  }

  /**
   * Get wallet balance
   * @param {String} userId - User ID
   * @returns {Object} Wallet balance
   */
  async getBalance(userId) {
    const wallet = await this.getWalletByUserId(userId);
    return {
      balance: wallet.balance,
      walletId: wallet._id
    };
  }

  /**
   * Get wallet transactions
   * @param {String} userId - User ID
   * @param {Object} filters - Filter options
   * @returns {Object} Wallet with transactions
   */
  async getTransactions(userId, filters = {}) {
    const wallet = await this.getWalletByUserId(userId);

    let transactions = wallet.transactions || [];

    // Apply filters
    if (filters.type) {
      transactions = transactions.filter(t => t.type === filters.type);
    }

    if (filters.startDate || filters.endDate) {
      transactions = transactions.filter(t => {
        const txDate = new Date(t.createdAt || t._id.getTimestamp());
        if (filters.startDate && txDate < new Date(filters.startDate)) return false;
        if (filters.endDate && txDate > new Date(filters.endDate)) return false;
        return true;
      });
    }

    // Sort by date (newest first)
    transactions.sort((a, b) => {
      const dateA = new Date(a.createdAt || a._id?.getTimestamp() || 0);
      const dateB = new Date(b.createdAt || b._id?.getTimestamp() || 0);
      return dateB - dateA;
    });

    // Pagination
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const paginatedTransactions = transactions.slice(skip, skip + limit);

    // Calculate totals
    const totalCredit = transactions
      .filter(t => t.type === TRANSACTION_TYPES.CREDIT)
      .reduce((sum, t) => sum + t.amount, 0);

    const totalDebit = transactions
      .filter(t => t.type === TRANSACTION_TYPES.DEBIT)
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      wallet: {
        id: wallet._id,
        balance: wallet.balance,
        totalCredit,
        totalDebit
      },
      transactions: paginatedTransactions,
      pagination: {
        page,
        limit,
        total: transactions.length,
        pages: Math.ceil(transactions.length / limit)
      }
    };
  }
}

module.exports = new WalletService();
