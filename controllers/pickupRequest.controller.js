const pickupRequestService = require('../services/pickupRequest.service');
const { successResponse } = require('../utils/responseHandler');

/**
 * Pickup Request Controller
 */
class PickupRequestController {
  /**
   * Create pickup request
   */
  async createPickupRequest(req, res, next) {
    try {
      const userId = req.user._id;
      const pickupData = req.body;

      const pickupRequest = await pickupRequestService.createPickupRequest(userId, pickupData);

      return successResponse(
        res,
        { pickupRequest },
        'Pickup request created successfully',
        201
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user pickup requests
   */
  async getUserPickupRequests(req, res, next) {
    try {
      const userId = req.user._id;
      const filters = {
        status: req.query.status,
        location: req.query.location,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        search: req.query.search,
        limit: req.query.limit,
        skip: req.query.skip
      };

      const pickupRequests = await pickupRequestService.getUserPickupRequests(userId, filters);

      return successResponse(res, { pickupRequests }, 'Pickup requests retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get pickup request by ID
   */
  async getPickupRequestById(req, res, next) {
    try {
      const userId = req.user._id;
      const { id } = req.params;

      const pickupRequest = await pickupRequestService.getPickupRequestById(id, userId);

      return successResponse(res, { pickupRequest }, 'Pickup request retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get available orders for pickup
   */
  async getAvailableOrders(req, res, next) {
    try {
      const userId = req.user._id;
      const { location } = req.query;

      const orders = await pickupRequestService.getAvailableOrdersForPickup(userId, location);

      return successResponse(res, { orders }, 'Available orders retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get pickup locations
   */
  async getPickupLocations(req, res, next) {
    try {
      const userId = req.user._id;

      const locations = await pickupRequestService.getPickupLocations(userId);

      return successResponse(res, { locations }, 'Pickup locations retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new PickupRequestController();
