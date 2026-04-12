const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  balance: {
    type: Number,
    default: 0,
    min: [0, 'Balance cannot be negative']
  },
  transactions: [{
    type: {
      type: String,
      enum: ['credit', 'debit'],
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    description: {
      type: String,
      required: true
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null
    },
    awb: {
      type: String,
      default: null
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  }]
}, {
  timestamps: true
});

// Add transaction method
walletSchema.methods.addTransaction = function(type, amount, description, orderId = null, awb = null, metadata = {}) {
  if (type === 'debit' && this.balance < amount) {
    throw new Error('Insufficient balance');
  }

  this.transactions.push({
    type,
    amount,
    description,
    orderId,
    awb,
    metadata
  });

  if (type === 'credit') {
    this.balance += amount;
  } else {
    this.balance -= amount;
  }

  return this.save();
};

const Wallet = mongoose.model('Wallet', walletSchema);

module.exports = Wallet;
