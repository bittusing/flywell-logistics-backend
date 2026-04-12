const BankAccount = require('../models/BankAccount.model');
const AppError = require('../utils/AppError');

/**
 * Bank Account Service - Business logic for bank account operations
 */
class BankAccountService {
  /**
   * Add or update bank account
   */
  async addOrUpdateBankAccount(userId, bankData) {
    const {
      accountHolderName,
      accountNumber,
      ifscCode,
      bankName,
      branchName,
      accountType
    } = bankData;

    // Check if bank account already exists
    let bankAccount = await BankAccount.findOne({ user: userId });

    if (bankAccount) {
      // Update existing bank account
      bankAccount.accountHolderName = accountHolderName;
      bankAccount.accountNumber = accountNumber;
      bankAccount.ifscCode = ifscCode.toUpperCase();
      bankAccount.bankName = bankName;
      bankAccount.branchName = branchName || '';
      bankAccount.accountType = accountType || 'savings';
      
      // Reset verification status on update
      bankAccount.isVerified = false;
      bankAccount.verificationDetails = {
        verificationStatus: 'pending'
      };

      await bankAccount.save();
    } else {
      // Create new bank account
      bankAccount = await BankAccount.create({
        user: userId,
        accountHolderName,
        accountNumber,
        ifscCode: ifscCode.toUpperCase(),
        bankName,
        branchName: branchName || '',
        accountType: accountType || 'savings',
        isPrimary: true
      });
    }

    return {
      _id: bankAccount._id,
      accountHolderName: bankAccount.accountHolderName,
      accountNumber: bankAccount.accountNumber,
      ifscCode: bankAccount.ifscCode,
      bankName: bankAccount.bankName,
      branchName: bankAccount.branchName,
      accountType: bankAccount.accountType,
      isVerified: bankAccount.isVerified,
      verificationStatus: bankAccount.verificationDetails?.verificationStatus
    };
  }

  /**
   * Get user's bank account
   */
  async getBankAccount(userId) {
    const bankAccount = await BankAccount.findOne({ user: userId });

    if (!bankAccount) {
      return null;
    }

    return {
      _id: bankAccount._id,
      accountHolderName: bankAccount.accountHolderName,
      accountNumber: bankAccount.accountNumber,
      ifscCode: bankAccount.ifscCode,
      bankName: bankAccount.bankName,
      branchName: bankAccount.branchName,
      accountType: bankAccount.accountType,
      isVerified: bankAccount.isVerified,
      verificationStatus: bankAccount.verificationDetails?.verificationStatus,
      createdAt: bankAccount.createdAt,
      updatedAt: bankAccount.updatedAt
    };
  }

  /**
   * Delete bank account
   */
  async deleteBankAccount(userId) {
    const bankAccount = await BankAccount.findOne({ user: userId });

    if (!bankAccount) {
      throw new AppError('Bank account not found', 404);
    }

    await BankAccount.deleteOne({ user: userId });

    return true;
  }

  /**
   * Verify bank account (Admin only)
   */
  async verifyBankAccount(userId, status) {
    const bankAccount = await BankAccount.findOne({ user: userId });

    if (!bankAccount) {
      throw new AppError('Bank account not found', 404);
    }

    bankAccount.isVerified = status === 'verified';
    bankAccount.verificationDetails = {
      verifiedAt: status === 'verified' ? new Date() : null,
      verificationMethod: 'manual',
      verificationStatus: status
    };

    await bankAccount.save();

    return {
      _id: bankAccount._id,
      isVerified: bankAccount.isVerified,
      verificationStatus: bankAccount.verificationDetails.verificationStatus,
      verifiedAt: bankAccount.verificationDetails.verifiedAt
    };
  }

  /**
   * Check if user has verified bank account
   */
  async hasVerifiedBankAccount(userId) {
    const bankAccount = await BankAccount.findOne({ 
      user: userId,
      isVerified: true 
    });

    return !!bankAccount;
  }
}

module.exports = new BankAccountService();
