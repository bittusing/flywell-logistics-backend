const mongoose = require('mongoose');

const pincodeSchema = new mongoose.Schema({
  pincode: {
    type: String,
    required: true,
<<<<<<< HEAD
    unique: true
=======
    unique: true,
    index: true
>>>>>>> e173c96881d6134e0904d3ff749bc7ec6eb3cc5a
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
<<<<<<< HEAD
=======
pincodeSchema.index({ pincode: 1 });
>>>>>>> e173c96881d6134e0904d3ff749bc7ec6eb3cc5a
pincodeSchema.index({ city: 1 });
pincodeSchema.index({ state_code: 1 });

const Pincode = mongoose.model('Pincode', pincodeSchema);

module.exports = Pincode;
