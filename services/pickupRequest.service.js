const mongoose = require('mongoose');
const PickupRequest = require('../models/PickupRequest.model');
const Order = require('../models/Order.model');
const AppError = require('../utils/AppError');
const { ORDER_STATUS } = require('../config/constants');
const { PICKUP_STATUS } = require('../models/PickupRequest.model');

/**
 * Pickup Request Service
 */
class PickupRequestService {
  /**
   * Create pickup request
   * @param {String} userId - User ID
   * @param {Object} pickupData - Pickup request data
   * @returns {Object} Created pickup request
   */
  async createPickupRequest(userId, pickupData) {
    const {
      pickupLocation,
      pickupDate,
      pickupSlot,
      orderIds = [],
      isDefaultSlot = false
    } = pickupData;

    // Validate orders belong to user
    let orders = [];
    if (orderIds && orderIds.length > 0) {
      orders = await Order.find({
        _id: { $in: orderIds },
        user: userId,
        status: { $in: [ORDER_STATUS.PENDING, ORDER_STATUS.CONFIRMED] }
      });

      if (orders.length !== orderIds.length) {
        throw new AppError('Some orders not found or not available for pickup', 400);
      }
    } else {
      // Get all pending/confirmed orders for this pickup location
      orders = await Order.find({
        user: userId,
        'pickupDetails.pincode': pickupLocation.pincode,
        status: { $in: [ORDER_STATUS.PENDING, ORDER_STATUS.CONFIRMED] }
      });
    }

    if (orders.length === 0) {
      throw new AppError('No orders available for pickup at this location', 400);
    }

    // Generate unique pickup ID
    const timestamp = Date.now();
    const randomSuffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const count = await PickupRequest.countDocuments();
    const sequential = String(count + 1).padStart(4, '0');
    const pickupId = `PR${timestamp}${randomSuffix}${sequential}`;

    // Create pickup request
    const pickupRequest = await PickupRequest.create({
      user: userId,
      pickupId: pickupId,
      pickupLocation,
      pickupDate: new Date(pickupDate),
      pickupSlot,
      orders: orders.map(o => o._id),
      expectedAWBs: orders.length,
      pickedAWBs: 0,
      status: PICKUP_STATUS.PENDING,
      isDefaultSlot
    });

    // Update orders status to scheduled for pickup
    await Order.updateMany(
      { _id: { $in: orders.map(o => o._id) } },
      { status: ORDER_STATUS.CONFIRMED }
    );

    return pickupRequest;
  }

  /**
   * Get user pickup requests
   * @param {String} userId - User ID
   * @param {Object} filters - Filter options
   * @returns {Array} Pickup requests
   */
  async getUserPickupRequests(userId, filters = {}) {
    const query = { user: userId };

    // Status filter
    if (filters.status) {
      query.status = filters.status;
    }

    // Location filter
    if (filters.location) {
      query['pickupLocation.name'] = { $regex: filters.location, $options: 'i' };
    }

    // Date range filter
    if (filters.startDate || filters.endDate) {
      query.pickupDate = {};
      if (filters.startDate) {
        query.pickupDate.$gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        query.pickupDate.$lte = new Date(filters.endDate);
      }
    }

    // Search by pickup ID
    if (filters.search) {
      query.pickupId = { $regex: filters.search, $options: 'i' };
    }

    const limit = parseInt(filters.limit) || 50;
    const skip = parseInt(filters.skip) || 0;

    const pickupRequests = await PickupRequest.find(query)
      .populate('orders', 'orderNumber awb status')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    return pickupRequests.map(pr => ({
      id: pr.pickupId,
      requestedOn: pr.createdAt,
      status: pr.status,
      location: `${pr.pickupLocation.name}, ${pr.pickupLocation.city}`,
      pickupLocation: pr.pickupLocation,
      awbs: `${pr.pickedAWBs} / ${pr.expectedAWBs}`,
      pickupDate: pr.pickupDate,
      lastUpdate: pr.updatedAt,
      orders: pr.orders,
      pickupSlot: pr.pickupSlot
    }));
  }

  /**
   * Get pickup request by ID
   * @param {String} pickupId - Pickup request ID
   * @param {String} userId - User ID
   * @returns {Object} Pickup request
   */
  async getPickupRequestById(pickupId, userId) {
    const pickupRequest = await PickupRequest.findOne({ pickupId, user: userId })
      .populate('orders');

    if (!pickupRequest) {
      throw new AppError('Pickup request not found', 404);
    }

    return pickupRequest;
  }

  /**
   * Get available orders for pickup at location
   * @param {String} userId - User ID
   * @param {String} locationName - Location name
   * @returns {Array} Available orders
   */
  async getAvailableOrdersForPickup(userId, locationName) {
    const orders = await Order.find({
      user: userId,
      'pickupDetails.name': { $regex: locationName, $options: 'i' },
      status: { $in: [ORDER_STATUS.PENDING, ORDER_STATUS.CONFIRMED] }
    })
      .select('orderNumber awb pickupDetails deliveryDetails status createdAt')
      .sort({ createdAt: -1 });

    return orders;
  }

  /**
   * Get pickup locations for user
   * @param {String} userId - User ID
   * @returns {Array} Unique pickup locations
   */
  async getPickupLocations(userId) {
    const orders = await Order.find({
      user: userId,
      status: { $in: [ORDER_STATUS.PENDING, ORDER_STATUS.CONFIRMED] }
    })
      .select('pickupDetails')
      .distinct('pickupDetails.name');

    // Get unique locations with full details
    const locations = await Order.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(userId),
          status: { $in: [ORDER_STATUS.PENDING, ORDER_STATUS.CONFIRMED] }
        }
      },
      {
        $group: {
          _id: '$pickupDetails.name',
          address: { $first: '$pickupDetails.address' },
          city: { $first: '$pickupDetails.city' },
          state: { $first: '$pickupDetails.state' },
          pincode: { $first: '$pickupDetails.pincode' },
          phone: { $first: '$pickupDetails.phone' }
        }
      }
    ]);

    return locations.map(loc => ({
      name: loc._id,
      address: loc.address,
      city: loc.city,
      state: loc.state,
      pincode: loc.pincode,
      phone: loc.phone
    }));
  }
}

module.exports = new PickupRequestService();
