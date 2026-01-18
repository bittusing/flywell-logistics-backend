const AppError = require('../utils/AppError');
const { DELIVERY_PARTNERS } = require('../config/constants');
const { getProvider, hasProvider } = require('../providers');

/**
 * Third Party API Service
 * 
 * This service acts as a facade/orchestrator for all delivery partner providers.
 * It uses the Provider Pattern for scalability and maintainability.
 * 
 * Architecture:
 * - Each delivery partner has its own Provider class (extends BaseProvider)
 * - Providers are registered in providers/index.js
 * - This service delegates calls to appropriate provider
 * 
 * Benefits:
 * 1. Easy to add new providers - just create provider class and register
 * 2. Each provider handles its own API format, auth, endpoints
 * 3. Consistent interface across all providers
 * 4. Better error handling and logging per provider
 * 5. Easy to test and mock individual providers
 * 
 * Usage:
 * const thirdPartyAPI = require('./services/thirdPartyAPI.service');
 * const rate = await thirdPartyAPI.calculateRate('delhivery', rateData);
 */
class ThirdPartyAPIService {
  /**
   * Calculate shipping rate
   * 
   * Delegates to the appropriate provider based on partner name.
   * 
   * @param {String} partner - Delivery partner name (e.g., 'delhivery', 'blue_dart')
   * @param {Object} rateData - Rate calculation data
   * @param {String} rateData.from.pincode - Origin pincode
   * @param {String} rateData.to.pincode - Destination pincode
   * @param {Number} rateData.weight - Weight in kg
   * @param {Object} rateData.dimensions - Optional dimensions
   * @param {Number} rateData.declaredValue - Optional declared value
   * @returns {Promise<Object>} Rate information
   * @throws {AppError} If partner not supported or calculation fails
   * 
   * @example
   * const rate = await thirdPartyAPI.calculateRate('delhivery', {
   *   from: { pincode: '110001' },
   *   to: { pincode: '400001' },
   *   weight: 1.5
   * });
   */
  async calculateRate(partner, rateData) {
    try {
      // Validate partner
      if (!Object.values(DELIVERY_PARTNERS).includes(partner)) {
        throw new AppError(`Invalid delivery partner: ${partner}`, 400);
      }

      // Get provider for this partner
      if (!hasProvider(partner)) {
        throw new AppError(
          `Provider for '${partner}' not implemented. Available: ${Object.keys(require('../providers').PROVIDERS).join(', ')}`,
          501
        );
      }

      const provider = getProvider(partner);
      
      // Delegate to provider
      console.log(`[ThirdPartyAPI] Calculating rate with ${partner} provider`);
      const result = await provider.calculateRate(rateData);
      
      return result;
    } catch (error) {
      // If it's already an AppError, re-throw it
      if (error instanceof AppError) {
        throw error;
      }

      // Otherwise, wrap in AppError
      console.error(`[ThirdPartyAPI] Error calculating rate for ${partner}:`, error.message);
      throw new AppError(
        `Rate calculation failed for ${partner}: ${error.message}`,
        500
      );
    }
  }

  /**
   * Create shipment/order with delivery partner
   * 
   * Delegates to the appropriate provider to create shipment and get AWB.
   * 
   * @param {String} partner - Delivery partner name
   * @param {Object} shipmentData - Shipment data
   * @param {Object} shipmentData.pickup - Pickup address
   * @param {Object} shipmentData.delivery - Delivery address
   * @param {Object} shipmentData.package - Package details
   * @param {String} shipmentData.orderId - Order ID
   * @returns {Promise<Object>} Shipment information with AWB
   * @throws {AppError} If partner not supported or creation fails
   * 
   * @example
   * const shipment = await thirdPartyAPI.createShipment('delhivery', {
   *   pickup: { name: '...', address: '...', pincode: '...' },
   *   delivery: { name: '...', address: '...', pincode: '...' },
   *   package: { weight: 1.5 },
   *   orderId: 'ORD123'
   * });
   */
  async createShipment(partner, shipmentData) {
    try {
      // Validate partner
      if (!Object.values(DELIVERY_PARTNERS).includes(partner)) {
        throw new AppError(`Invalid delivery partner: ${partner}`, 400);
      }

      // Get provider for this partner
      if (!hasProvider(partner)) {
        throw new AppError(
          `Provider for '${partner}' not implemented`,
          501
        );
      }

      const provider = getProvider(partner);
      
      // Delegate to provider
      console.log(`[ThirdPartyAPI] Creating shipment with ${partner} provider`);
      const result = await provider.createShipment(shipmentData);
      
      return result;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      console.error(`[ThirdPartyAPI] Error creating shipment for ${partner}:`, error.message);
      throw new AppError(
        `Shipment creation failed for ${partner}: ${error.message}`,
        500
      );
    }
  }

  /**
   * Track shipment by AWB/tracking number
   * 
   * Delegates to the appropriate provider to get tracking information.
   * 
   * @param {String} partner - Delivery partner name
   * @param {String} trackingNumber - AWB or tracking number
   * @returns {Promise<Object>} Tracking information
   * @throws {AppError} If partner not supported or tracking fails
   * 
   * @example
   * const tracking = await thirdPartyAPI.trackShipment('delhivery', 'DELHIVERY123456');
   */
  async trackShipment(partner, trackingNumber) {
    try {
      // Validate partner
      if (!Object.values(DELIVERY_PARTNERS).includes(partner)) {
        throw new AppError(`Invalid delivery partner: ${partner}`, 400);
      }

      // Get provider for this partner
      if (!hasProvider(partner)) {
        throw new AppError(
          `Provider for '${partner}' not implemented`,
          501
        );
      }

      const provider = getProvider(partner);
      
      // Delegate to provider
      console.log(`[ThirdPartyAPI] Tracking shipment with ${partner} provider: ${trackingNumber}`);
      const result = await provider.trackShipment(trackingNumber);
      
      return result;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      console.error(`[ThirdPartyAPI] Error tracking shipment for ${partner}:`, error.message);
      throw new AppError(
        `Tracking failed for ${partner}: ${error.message}`,
        500
      );
    }
  }

  /**
   * Check serviceability (pincode serviceability)
   * 
   * Checks if delivery is possible from origin to destination pincode.
   * 
   * @param {String} partner - Delivery partner name
   * @param {Object} serviceabilityData - Serviceability check data
   * @param {String} serviceabilityData.fromPincode - Origin pincode
   * @param {String} serviceabilityData.toPincode - Destination pincode
   * @returns {Promise<Object>} Serviceability information
   * @throws {AppError} If partner not supported or check fails
   */
  async checkServiceability(partner, serviceabilityData) {
    try {
      // Validate partner
      if (!Object.values(DELIVERY_PARTNERS).includes(partner)) {
        throw new AppError(`Invalid delivery partner: ${partner}`, 400);
      }

      // Get provider for this partner
      if (!hasProvider(partner)) {
        throw new AppError(
          `Provider for '${partner}' not implemented`,
          501
        );
      }

      const provider = getProvider(partner);
      
      // Delegate to provider (if implemented)
      const result = await provider.checkServiceability(
        serviceabilityData.fromPincode,
        serviceabilityData.toPincode
      );
      
      return result;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      console.error(`[ThirdPartyAPI] Error checking serviceability for ${partner}:`, error.message);
      throw new AppError(
        `Serviceability check failed for ${partner}: ${error.message}`,
        500
      );
    }
  }

  /**
   * Get list of available providers
   * 
   * @returns {Array} List of provider names
   */
  getAvailableProviders() {
    const { getAllProviders } = require('../providers');
    return getAllProviders();
  }

  /**
   * Check if a provider is available
   * 
   * @param {String} partner - Partner name
   * @returns {Boolean} True if provider is available
   */
  isProviderAvailable(partner) {
    return hasProvider(partner);
  }
}

// Export singleton instance
module.exports = new ThirdPartyAPIService();
