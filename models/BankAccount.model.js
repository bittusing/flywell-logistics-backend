const mongoose = require('mongoose');

const bankAccountSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  accountHolderName: {
    type: String,
    required: [true, 'Account holder name is required'],
    trim: true
  },
  accountNumber: {
    type: String,
    required: [true, 'Account number is required'],
    trim: true
  },
  ifscCode: {
    type: String,
    required: [true, 'IFSC code is required'],
    uppercase: true,
    trim: true,
    match: [/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Please provide a valid IFSC code']
  },
  bankName: {
    type: String,
    required: [true, 'Bank name is required'],
    trim: true
  },
  branchName: {
    type: String,
    trim: true
  },
  accountType: {
    type: String,
    enum: ['savings', 'current'],
    default: 'savings'
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isPrimary: {
    type: Boolean,
    default: true
  },
  verificationDetails: {
    verifiedAt: Date,
    verificationMethod: String,
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'failed'],
      default: 'pending'
    }
  }
}, {
  timestamps: true
});

// Index for faster queries
bankAccountSchema.index({ user: 1 });

const BankAccount = mongoose.model('BankAccount', bankAccountSchema);

module.exports = BankAccount;
