const mongoose = require('mongoose');
const { ORDER_STATUS, DELIVERY_PARTNERS } = require('../config/constants');

// Order types
const ORDER_TYPES = {
  DOMESTIC: 'domestic',
  INTERNATIONAL: 'international'
};

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
  // Order type - domestic or international
  orderType: {
    type: String,
    enum: Object.values(ORDER_TYPES),
    default: ORDER_TYPES.DOMESTIC
  },
  // Pickup Details (Sender)
  pickupDetails: {
    name: { type: String, required: true },
    companyName: { type: String, default: '' },
    contactPerson: { type: String, default: '' },
    phone: { type: String, required: true },
    email: { type: String, default: '' },
    address: { type: String, required: true },
    addressLine2: { type: String, default: '' },
    addressLine3: { type: String, default: '' },
    pincode: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    country: { type: String, default: 'IN' },
    // KYC for international
    kycType: { type: String, default: '' },
    kycNo: { type: String, default: '' },
    gstin: { type: String, default: '' }
  },
  // Delivery Details (Receiver) - supports international addresses
  deliveryDetails: {
    name: { type: String, required: true },
    companyName: { type: String, default: '' },
    contactPerson: { type: String, default: '' },
    phone: { type: String, required: true },
    email: { type: String, default: '' },
    address: { type: String, required: true },
    addressLine2: { type: String, default: '' },
    addressLine3: { type: String, default: '' },
    pincode: { type: String, required: true },  // or zipcode for international
    city: { type: String, required: true },
    state: { type: String, required: true },
    country: { type: String, default: 'IN' },  // Country code for international
    vatId: { type: String, default: '' }  // For international
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

// Generate order number before saving (fallback if not provided)
orderSchema.pre('save', async function (next) {
  if (!this.orderNumber) {
    const timestamp = Date.now();
    const randomSuffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const count = await mongoose.model('Order').countDocuments();
    const sequential = String(count + 1).padStart(4, '0');
    this.orderNumber = `ORD${timestamp}${randomSuffix}${sequential}`;
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
