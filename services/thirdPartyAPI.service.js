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
        // Blue Dart uses API Key and API ID
        if (process.env.BLUE_DART_API_KEY && process.env.BLUE_DART_API_ID) {
          config.headers['Api-Key'] = process.env.BLUE_DART_API_KEY;
          config.headers['Api-ID'] = process.env.BLUE_DART_API_ID;
        } else if (process.env.BLUE_DART_API_KEY) {
          config.headers['Authorization'] = `Bearer ${process.env.BLUE_DART_API_KEY}`;
        }
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
    try {
      // Blue Dart rate calculation format
      const blueDartPayload = {
        FromPincode: rateData.from.pincode,
        ToPincode: rateData.to.pincode,
        Weight: rateData.weight || 0.5,
        ProductCode: 'A' // Standard product code
      };

      const response = await client.post('/rate/calculate', blueDartPayload);
      
      // Extract rate from response
      return {
        baseRate: response.data?.BaseRate || response.data?.ShippingCharge || 30.00,
        additionalCharges: response.data?.AdditionalCharges || response.data?.Surcharge || 2.50,
        gst: response.data?.GST || response.data?.Tax || 5.94,
        dph: response.data?.DPH || response.data?.FuelSurcharge || 0.46,
        totalAmount: response.data?.TotalAmount || response.data?.FinalAmount || 35.50,
        estimatedDelivery: response.data?.EstimatedDays || '1 days',
        currency: 'INR',
        metadata: response.data
      };
    } catch (error) {
      // If API call fails, return mock data for development
      if (process.env.NODE_ENV === 'development') {
        console.warn('Blue Dart rate API unavailable, using mock data:', error.message);
        // Calculate mock rate based on distance and weight
        const baseRate = 30.00 + (rateData.weight || 0.5) * 5;
        const additionalCharges = 2.50;
        const gst = (baseRate + additionalCharges) * 0.18;
        const dph = 0.46;
        const totalAmount = baseRate + additionalCharges + gst + dph;
        
        return {
          baseRate,
          additionalCharges,
          gst,
          dph,
          totalAmount,
          estimatedDelivery: '1 days',
          currency: 'INR',
          metadata: { mock: true }
        };
      }
      throw error;
    }
  }

  async _createFedexShipment(client, shipmentData) {
    // TODO: Implement FedEx shipment creation
    const response = await client.post('/ship/v1/shipments', shipmentData);
    return response.data;
  }

  async _createBlueDartShipment(client, shipmentData) {
    // Blue Dart shipment creation format
    const blueDartPayload = {
      ConsigneeName: shipmentData.delivery.name,
      ConsigneeAddress: shipmentData.delivery.address,
      ConsigneeCity: shipmentData.delivery.city,
      ConsigneeState: shipmentData.delivery.state,
      ConsigneePincode: shipmentData.delivery.pincode,
      ConsigneeMobile: shipmentData.delivery.phone,
      ShipperName: shipmentData.pickup.name,
      ShipperAddress: shipmentData.pickup.address,
      ShipperCity: shipmentData.pickup.city,
      ShipperState: shipmentData.pickup.state,
      ShipperPincode: shipmentData.pickup.pincode,
      ShipperMobile: shipmentData.pickup.phone,
      ProductCode: 'A', // Standard product code
      Weight: shipmentData.package.weight || 0.5,
      DeclaredValue: shipmentData.package.declaredValue || 0,
      ReferenceNo: shipmentData.orderId || '',
      Pieces: 1
    };

    try {
      const response = await client.post('/shipment/create', blueDartPayload);
      
      // Extract AWB and tracking URL from response
      return {
        awb: response.data?.AWBNo || response.data?.awb || null,
        trackingNumber: response.data?.AWBNo || response.data?.awb || null,
        trackingUrl: response.data?.TrackingURL || `https://www.bluedart.com/track/${response.data?.AWBNo}`,
        status: response.data?.Status || 'created',
        partnerOrderId: response.data?.OrderId || null,
        metadata: response.data
      };
    } catch (error) {
      // If API call fails, return mock data for development
      if (process.env.NODE_ENV === 'development') {
        console.warn('Blue Dart API unavailable, using mock data:', error.message);
        return {
          awb: `BLUEDART${Date.now()}`,
          trackingNumber: `BLUEDART${Date.now()}`,
          trackingUrl: `https://www.bluedart.com/track/BLUEDART${Date.now()}`,
          status: 'created',
          metadata: { mock: true }
        };
      }
      throw error;
    }
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
