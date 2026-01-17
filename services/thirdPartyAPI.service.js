const axios = require('axios');
const AppError = require('../utils/AppError');
const { DELIVERY_PARTNERS } = require('../config/constants');

/**
 * Third Party API Service
 * Handles integration with delivery partner APIs (FedEx, Blue Dart, etc.)
 */
class ThirdPartyAPIService {
  /**
   * Initialize third-party API client
   * @param {String} partner - Delivery partner name
   * @returns {Object} Configured axios instance
   */
  _getClient(partner) {
    const config = {
      timeout: 30000, // 30 seconds timeout
      headers: {
        'Content-Type': 'application/json'
      }
    };

    switch (partner) {
      case DELIVERY_PARTNERS.FEDEX:
        config.baseURL = process.env.FEDEX_API_BASE_URL || 'https://apis.fedex.com';
        config.headers['Authorization'] = `Bearer ${process.env.FEDEX_API_KEY}`;
        break;

      case DELIVERY_PARTNERS.BLUE_DART:
      case DELIVERY_PARTNERS.BLUEDART:
        config.baseURL = process.env.BLUE_DART_API_BASE_URL || 'https://www.bluedart.com/api';
        config.headers['Authorization'] = `Bearer ${process.env.BLUE_DART_API_KEY}`;
        break;

      default:
        throw new AppError(`Unsupported delivery partner: ${partner}`, 400);
    }

    return axios.create(config);
  }

  /**
   * Calculate shipping rate
   * @param {String} partner - Delivery partner
   * @param {Object} rateData - Rate calculation data
   * @returns {Object} Rate information
   */
  async calculateRate(partner, rateData) {
    try {
      const client = this._getClient(partner);
      
      // Partner-specific rate calculation logic
      switch (partner) {
        case DELIVERY_PARTNERS.FEDEX:
          return await this._calculateFedexRate(client, rateData);
        
        case DELIVERY_PARTNERS.BLUE_DART:
        case DELIVERY_PARTNERS.BLUEDART:
          return await this._calculateBlueDartRate(client, rateData);
        
        default:
          throw new AppError(`Rate calculation not implemented for ${partner}`, 501);
      }
    } catch (error) {
      if (error.response) {
        throw new AppError(
          `Third-party API error: ${error.response.data?.message || error.message}`,
          error.response.status || 500
        );
      }
      throw error;
    }
  }

  /**
   * Create shipment/order with third-party
   * @param {String} partner - Delivery partner
   * @param {Object} shipmentData - Shipment data
   * @returns {Object} Shipment information
   */
  async createShipment(partner, shipmentData) {
    try {
      const client = this._getClient(partner);
      
      switch (partner) {
        case DELIVERY_PARTNERS.FEDEX:
          return await this._createFedexShipment(client, shipmentData);
        
        case DELIVERY_PARTNERS.BLUE_DART:
        case DELIVERY_PARTNERS.BLUEDART:
          return await this._createBlueDartShipment(client, shipmentData);
        
        default:
          throw new AppError(`Shipment creation not implemented for ${partner}`, 501);
      }
    } catch (error) {
      if (error.response) {
        throw new AppError(
          `Third-party API error: ${error.response.data?.message || error.message}`,
          error.response.status || 500
        );
      }
      throw error;
    }
  }

  /**
   * Track shipment
   * @param {String} partner - Delivery partner
   * @param {String} trackingNumber - AWB/Tracking number
   * @returns {Object} Tracking information
   */
  async trackShipment(partner, trackingNumber) {
    try {
      const client = this._getClient(partner);
      
      switch (partner) {
        case DELIVERY_PARTNERS.FEDEX:
          return await this._trackFedexShipment(client, trackingNumber);
        
        case DELIVERY_PARTNERS.BLUE_DART:
        case DELIVERY_PARTNERS.BLUEDART:
          return await this._trackBlueDartShipment(client, trackingNumber);
        
        default:
          throw new AppError(`Shipment tracking not implemented for ${partner}`, 501);
      }
    } catch (error) {
      if (error.response) {
        throw new AppError(
          `Third-party API error: ${error.response.data?.message || error.message}`,
          error.response.status || 500
        );
      }
      throw error;
    }
  }

  /**
   * Check serviceability (pincode check)
   * @param {String} partner - Delivery partner
   * @param {Object} serviceabilityData - Source and destination pincodes
   * @returns {Object} Serviceability information
   */
  async checkServiceability(partner, serviceabilityData) {
    try {
      const client = this._getClient(partner);
      
      switch (partner) {
        case DELIVERY_PARTNERS.FEDEX:
          return await this._checkFedexServiceability(client, serviceabilityData);
        
        case DELIVERY_PARTNERS.BLUE_DART:
        case DELIVERY_PARTNERS.BLUEDART:
          return await this._checkBlueDartServiceability(client, serviceabilityData);
        
        default:
          throw new AppError(`Serviceability check not implemented for ${partner}`, 501);
      }
    } catch (error) {
      if (error.response) {
        throw new AppError(
          `Third-party API error: ${error.response.data?.message || error.message}`,
          error.response.status || 500
        );
      }
      throw error;
    }
  }

  // Private helper methods for each partner

  async _calculateFedexRate(client, rateData) {
    // TODO: Implement FedEx rate calculation
    const response = await client.post('/rate/v1/rates/quotes', rateData);
    return response.data;
  }

  async _calculateBlueDartRate(client, rateData) {
    // TODO: Implement Blue Dart rate calculation
    const response = await client.post('/rate/calculate', rateData);
    return response.data;
  }

  async _createFedexShipment(client, shipmentData) {
    // TODO: Implement FedEx shipment creation
    const response = await client.post('/ship/v1/shipments', shipmentData);
    return response.data;
  }

  async _createBlueDartShipment(client, shipmentData) {
    // TODO: Implement Blue Dart shipment creation
    const response = await client.post('/shipment/create', shipmentData);
    return response.data;
  }

  async _trackFedexShipment(client, trackingNumber) {
    // TODO: Implement FedEx tracking
    const response = await client.get(`/track/v1/trackingnumbers/${trackingNumber}`);
    return response.data;
  }

  async _trackBlueDartShipment(client, trackingNumber) {
    // TODO: Implement Blue Dart tracking
    const response = await client.get(`/tracking/${trackingNumber}`);
    return response.data;
  }

  async _checkFedexServiceability(client, serviceabilityData) {
    // TODO: Implement FedEx serviceability check
    const response = await client.post('/serviceability/v1/check', serviceabilityData);
    return response.data;
  }

  async _checkBlueDartServiceability(client, serviceabilityData) {
    // TODO: Implement Blue Dart serviceability check
    const response = await client.post('/serviceability/check', serviceabilityData);
    return response.data;
  }
}

module.exports = new ThirdPartyAPIService();
