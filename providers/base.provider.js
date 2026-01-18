const axios = require('axios');
const AppError = require('../utils/AppError');

/**
 * Base Provider Class
 * 
 * This is the base class for all third-party delivery partner providers.
 * All provider implementations should extend this class and implement required methods.
 * 
 * This architecture makes it easy to add new delivery partners:
 * 1. Create a new provider class extending BaseProvider
 * 2. Implement required methods (calculateRate, createShipment, trackShipment)
 * 3. Register provider in providers/index.js
 * 4. Add partner constant in config/constants.js
 * 
 * @example
 * class MyProvider extends BaseProvider {
 *   constructor() {
 *     super('my_provider', 'https://api.myprovider.com');
 *   }
 *   
 *   async calculateRate(rateData) {
 *     // Implementation
 *   }
 * }
 */
class BaseProvider {
  /**
   * @param {String} name - Provider name (e.g., 'delhivery', 'blue_dart')
   * @param {String} baseURL - Base URL for the API
   * @param {Object} config - Additional configuration
   */
  constructor(name, baseURL, config = {}) {
    this.name = name;
    this.baseURL = baseURL;
    this.config = {
      timeout: config.timeout || 30000,
      ...config
    };
  }

  /**
   * Get configured axios client
   * Override this method to customize headers/auth per provider
   * @returns {Object} Axios instance
   */
  getClient() {
    return axios.create({
      baseURL: this.baseURL,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        ...this.getHeaders()
      }
    });
  }

  /**
   * Get headers for API requests
   * Override this method to add provider-specific headers (auth, API keys, etc.)
   * @returns {Object} Headers object
   */
  getHeaders() {
    return {};
  }

  /**
   * Calculate shipping rate
   * Must be implemented by each provider
   * @param {Object} rateData - Rate calculation data
   * @param {String} rateData.from.pincode - Origin pincode
   * @param {String} rateData.to.pincode - Destination pincode
   * @param {Number} rateData.weight - Weight in kg
   * @param {Object} rateData.dimensions - Optional dimensions {length, width, height}
   * @param {Number} rateData.declaredValue - Optional declared value
   * @returns {Promise<Object>} Rate information
   * @throws {AppError} If calculation fails
   */
  async calculateRate(rateData) {
    throw new AppError(`calculateRate not implemented for ${this.name}`, 501);
  }

  /**
   * Create shipment/order with provider
   * Must be implemented by each provider
   * @param {Object} shipmentData - Shipment data
   * @param {Object} shipmentData.pickup - Pickup address details
   * @param {Object} shipmentData.delivery - Delivery address details
   * @param {Object} shipmentData.package - Package details
   * @param {String} shipmentData.orderId - Order ID
   * @returns {Promise<Object>} Shipment information with AWB
   * @throws {AppError} If shipment creation fails
   */
  async createShipment(shipmentData) {
    throw new AppError(`createShipment not implemented for ${this.name}`, 501);
  }

  /**
   * Track shipment by AWB/tracking number
   * Must be implemented by each provider
   * @param {String} trackingNumber - AWB or tracking number
   * @returns {Promise<Object>} Tracking information
   * @throws {AppError} If tracking fails
   */
  async trackShipment(trackingNumber) {
    throw new AppError(`trackShipment not implemented for ${this.name}`, 501);
  }

  /**
   * Check serviceability (pincode serviceability)
   * Optional method - override if provider supports it
   * @param {String} fromPincode - Origin pincode
   * @param {String} toPincode - Destination pincode
   * @returns {Promise<Object>} Serviceability information
   */
  async checkServiceability(fromPincode, toPincode) {
    // Default implementation - override in provider if needed
    return {
      serviceable: true,
      message: 'Serviceability check not implemented'
    };
  }

  /**
   * Map provider status to our internal status
   * Override this method to map provider-specific statuses
   * @param {String} providerStatus - Provider's status string
   * @returns {String} Internal status
   */
  mapStatus(providerStatus) {
    // Default mapping - override in provider
    return providerStatus?.toLowerCase() || 'pending';
  }

  /**
   * Handle API errors consistently
   * @param {Error} error - Error object
   * @param {String} operation - Operation name (for logging)
   * @throws {AppError} Formatted error
   */
  handleError(error, operation) {
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.message || 
                     error.response.data?.detail || 
                     error.response.data?.error ||
                     error.message;
      
      console.error(`[${this.name}] ${operation} error:`, {
        status,
        message,
        data: error.response.data
      });
      
      throw new AppError(
        `${this.name} API error (${operation}): ${message}`,
        status
      );
    }
    
    throw new AppError(
      `${this.name} API error (${operation}): ${error.message}`,
      500
    );
  }

  /**
   * Convert weight from kg to grams (common requirement)
   * @param {Number} weightKg - Weight in kg
   * @returns {Number} Weight in grams
   */
  kgToGrams(weightKg) {
    return Math.round(weightKg * 1000);
  }

  /**
   * Convert weight from grams to kg
   * @param {Number} weightGrams - Weight in grams
   * @returns {Number} Weight in kg
   */
  gramsToKg(weightGrams) {
    return weightGrams / 1000;
  }
}

module.exports = BaseProvider;
