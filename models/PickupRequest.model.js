const mongoose = require('mongoose');

const PICKUP_STATUS = {
  PENDING: 'pending',
  SCHEDULED: 'scheduled',
  PICKED_UP: 'picked_up',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed'
};

const pickupRequestSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  orderType: {
    type: String,
    enum: ['domestic', 'international'],
    default: 'domestic',
    required: true
  },
  pickupId: {
    type: String,
    unique: true,
    required: true
  },
  // Pickup Location
  pickupLocation: {
    name: { type: String, required: true },
    address: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    phone: { type: String, required: true }
  },
  // Pickup Date and Time
  pickupDate: {
    type: Date,
    required: true
  },
  pickupSlot: {
    startTime: { type: String, required: true }, // e.g., "10:00:00"
    endTime: { type: String, required: true },   // e.g., "14:00:00"
    label: { type: String, required: true }      // e.g., "Mid Day"
  },
  // Orders to be picked up
  orders: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  }],
  // Status
  status: {
    type: String,
    enum: Object.values(PICKUP_STATUS),
    default: PICKUP_STATUS.PENDING
  },
  // AWB tracking
  expectedAWBs: {
    type: Number,
    default: 0
  },
  pickedAWBs: {
    type: Number,
    default: 0
  },
  // Default slot saved
  isDefaultSlot: {
    type: Boolean,
    default: false
  },
  // Metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Generate pickup ID before saving
pickupRequestSchema.pre('save', async function (next) {
  if (!this.pickupId) {
    const timestamp = Date.now();
    const randomSuffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const count = await mongoose.model('PickupRequest').countDocuments();
    const sequential = String(count + 1).padStart(4, '0');
    this.pickupId = `PR${timestamp}${randomSuffix}${sequential}`;
  }
  next();
});

// Indexes
pickupRequestSchema.index({ user: 1, createdAt: -1 });
pickupRequestSchema.index({ pickupId: 1 });
pickupRequestSchema.index({ status: 1 });
pickupRequestSchema.index({ pickupDate: 1 });

const PickupRequest = mongoose.model('PickupRequest', pickupRequestSchema);

module.exports = PickupRequest;
module.exports.PICKUP_STATUS = PICKUP_STATUS;
