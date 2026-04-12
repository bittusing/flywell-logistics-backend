const mongoose = require('mongoose');

const pincodeSchema = new mongoose.Schema({
  pincode: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  city: {
    type: String,
    required: true
  },
  state_code: {
    type: String,
    required: true
  },
  cod: {
    type: String,
    enum: ['Y', 'N'],
    default: 'Y'
  },
  prepaid: {
    type: String,
    enum: ['Y', 'N'],
    default: 'Y'
  },
  pickup: {
    type: String,
    enum: ['Y', 'N'],
    default: 'Y'
  },
  zone: {
    type: String,
    default: ''
  },
  isServiceable: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for faster searches
pincodeSchema.index({ pincode: 1 });
pincodeSchema.index({ city: 1 });
pincodeSchema.index({ state_code: 1 });

const Pincode = mongoose.model('Pincode', pincodeSchema);

module.exports = Pincode;
