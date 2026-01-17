const mongoose = require('mongoose');
const { ORDER_STATUS, DELIVERY_PARTNERS } = require('../config/constants');

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  orderNumber: {
    type: String,
    unique: true,
    required: true
  },
  // Pickup Details
  pickupDetails: {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    pincode: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true }
  },
  // Delivery Details
  deliveryDetails: {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    pincode: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true }
  },
  // Package Details
  packageDetails: {
    weight: { type: Number, required: true, min: 0.1 }, // in kg
    dimensions: {
      length: { type: Number, default: 0 },
      width: { type: Number, default: 0 },
      height: { type: Number, default: 0 }
    },
    description: { type: String, default: '' },
    declaredValue: { type: Number, default: 0 } // in rupees
  },
  // Delivery Partner
  deliveryPartner: {
    type: String,
    enum: Object.values(DELIVERY_PARTNERS),
    required: true
  },
  // Pricing
  pricing: {
    baseRate: { type: Number, required: true },
    additionalCharges: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    currency: { type: String, default: 'INR' }
  },
  // Payment
  payment: {
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending'
    },
    method: {
      type: String,
      enum: ['wallet', 'razorpay'],
      default: 'wallet'
    },
    transactionId: { type: String, default: null },
    paidAt: { type: Date, default: null }
  },
  // Tracking
  status: {
    type: String,
    enum: Object.values(ORDER_STATUS),
    default: ORDER_STATUS.PENDING
  },
  awb: {
    type: String,
    default: null
  },
  trackingUrl: {
    type: String,
    default: null
  },
  // Metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Generate order number before saving
orderSchema.pre('save', async function(next) {
  if (!this.orderNumber) {
    const count = await mongoose.model('Order').countDocuments();
    this.orderNumber = `ORD${Date.now()}${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

// Indexes for better query performance
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ awb: 1 });
orderSchema.index({ status: 1 });

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
