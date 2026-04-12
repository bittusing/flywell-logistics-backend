const BaseProvider = require('./base.provider');
const AppError = require('../utils/AppError');
const { ORDER_STATUS } = require('../config/constants');

/**
 * Delhivery Provider
 * 
 * Integration with Delhivery API for delivery services.
 * Documentation: https://one.delhivery.com/developer-portal/documents
 * 
 * API Endpoints:
 * - Rate Calculation: GET /api/kinko/v1/invoice/charges/.json
 * - Shipment Creation: POST /api/p/packing_slip
 * - Tracking: GET /api/packages/json
 * 
 * Authentication:
 * - Header: Authorization: Token {API_TOKEN}
 * 
 * Environments:
 * - Test: https://staging-express.delhivery.com
 * - Production: https://track.delhivery.com
 */
class DelhiveryProvider extends BaseProvider {
  constructor() {
    // Determine environment (test or production)
    const environment = process.env.DELHIVERY_ENVIRONMENT || 'production';
    const baseURL = environment === 'test' 
      ? 'https://staging-express.delhivery.com'
      : 'https://track.delhivery.com';
    
    super('delhivery', baseURL, {
      timeout: 30000
    });

    // Validate required credentials
    if (!process.env.DELHIVERY_API_TOKEN) {
      console.warn('[Delhivery] API Token not found in environment variables');
    }
  }

  /**
   * Get headers for Delhivery API requests
   * Delhivery uses: Authorization: Token {API_TOKEN}
   * @returns {Object} Headers
   */
  getHeaders() {
    const token = process.env.DELHIVERY_API_TOKEN;
    if (!token) {
      throw new AppError('Delhivery API token not configured', 500);
    }

    return {
      'Authorization': `Token ${token}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Calculate shipping rate
   * 
   * API: GET /api/kinko/v1/invoice/charges/.json
   * 
   * Parameters:
   * - md: Billing Mode (E=Express, S=Surface)
   * - cgm: Chargeable weight in GRAMS
   * - o_pin: Origin pincode (6 digits)
   * - d_pin: Destination pincode (6 digits)
   * - ss: Shipment status (Delivered, RTO, DTO)
   * - pt: Payment type (Pre-paid, COD)
   * 
   * @param {Object} rateData - Rate calculation data
   * @returns {Promise<Object>} Rate information
   */
  async calculateRate(rateData) {
    try {
      const client = this.getClient();
      
      // Prepare query parameters as per Delhivery API documentation
      const params = new URLSearchParams({
        md: rateData.serviceType === 'express' ? 'E' : 'S', // E=Express, S=Surface
        cgm: this.kgToGrams(rateData.weight || 0.5), // Weight in GRAMS
        o_pin: rateData.from.pincode,
        d_pin: rateData.to.pincode,
        ss: 'Delivered', // Shipment status (Delivered, RTO, DTO)
        pt: 'Pre-paid' // Payment type (Pre-paid, COD)
      });

      // API endpoint as per documentation
      const endpoint = `/api/kinko/v1/invoice/charges/.json?${params.toString()}`;
      
      console.log(`[Delhivery] Calculating rate: ${endpoint}`);
      console.log(`[Delhivery] Headers:`, this.getHeaders());

      const response = await client.get(endpoint);

      // Log response for debugging
      console.log(`[Delhivery] Response status:`, response.status);
      console.log(`[Delhivery] Response data:`, JSON.stringify(response.data, null, 2));

      // Parse Delhivery response
      // Response format may vary, but typically contains:
      // - Total amount
      // - Base rate
      // - Additional charges
      const responseData = response.data;

      // Extract rate information from response
      // Delhivery API response format can be:
      // Option 1: { total_amount: 100, base_rate: 80, ... }
      // Option 2: Array with rate objects
      // Option 3: Single object with different field names
      
      let responseDataParsed = responseData;
      
      // Handle array response (some APIs return array)
      if (Array.isArray(responseData) && responseData.length > 0) {
        responseDataParsed = responseData[0];
        console.log('[Delhivery] Response is array, using first element');
      }
      
      // Handle nested data (some APIs wrap in data/result field)
      if (responseDataParsed?.data) {
        responseDataParsed = responseDataParsed.data;
      }
      if (responseDataParsed?.result) {
        responseDataParsed = responseDataParsed.result;
      }
      
      console.log('[Delhivery] Parsed response data:', JSON.stringify(responseDataParsed, null, 2));
      
      // Extract rate information from Delhivery API response
      // Based on actual API response structure:
      // {
      //   "total_amount": 77.88,        // Final total including all charges and tax
      //   "gross_amount": 66,           // Base amount before tax
      //   "charge_DL": 65,              // Delivery charge (main shipping cost)
      //   "charge_DPH": 1,              // DPH (Delivery Partner Handling)
      //   "tax_data": {
      //     "CGST": 5.94,               // Central GST
      //     "SGST": 5.94                // State GST
      //   }
      // }
      
      // Total amount (final amount including all charges and taxes)
      const totalAmount = responseDataParsed?.total_amount || 0;
      
      // Base rate (delivery charge - main shipping cost)
      const baseRate = responseDataParsed?.charge_DL || 
                      responseDataParsed?.gross_amount ||
                      0;

      // Additional charges (DPH, pickup, etc.)
      const dph = responseDataParsed?.charge_DPH || 0;
      const pickupCharge = responseDataParsed?.charge_pickup || 0;
      const awbCharge = responseDataParsed?.charge_AWB || 0;
      const additionalCharges = dph + pickupCharge + awbCharge;

      // Calculate GST from tax_data (CGST + SGST)
      const taxData = responseDataParsed?.tax_data || {};
      const cgst = taxData?.CGST || 0;
      const sgst = taxData?.SGST || 0;
      const igst = taxData?.IGST || 0;
      const gst = cgst + sgst + igst; // Total GST

      // Final total (use total_amount from API, it's already calculated correctly)
      const finalTotal = totalAmount;

      return {
        baseRate: parseFloat(baseRate.toFixed(2)),
        additionalCharges: parseFloat(additionalCharges.toFixed(2)),
        gst: parseFloat(gst.toFixed(2)),
        dph: parseFloat(dph.toFixed(2)),
        totalAmount: parseFloat(finalTotal.toFixed(2)),
        currency: 'INR',
        estimatedDelivery: responseData?.estimated_delivery || 
                          responseData?.tat || 
                          '3-5 business days',
        serviceType: rateData.serviceType || 'express',
        metadata: responseData
      };
    } catch (error) {
      // Log detailed error information
      if (error.response) {
        console.error('[Delhivery] Rate API Error:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
          headers: error.response.headers
        });
      } else {
        console.error('[Delhivery] Rate API Error:', error.message);
      }

      // If API call fails in development, return mock data
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Delhivery] Rate API unavailable, using mock data:', error.message);
        return this._getMockRate(rateData);
      }
      this.handleError(error, 'calculateRate');
    }
  }

  /**
   * Create shipment with Delhivery
   * 
   * API: POST /api/cmu/packing_slip (or /v1/forward/order/create)
   * Documentation: https://one.delhivery.com/developer-portal/documents
   * 
   * @param {Object} shipmentData - Shipment data
   * @returns {Promise<Object>} Shipment information with AWB
   */
  async createShipment(shipmentData) {
    try {
      // For shipment creation, Delhivery might use different base URLs
      // track.delhivery.com is mainly for tracking
      // Try multiple base URLs for shipment creation
      const baseURLs = [
        this.baseURL, // Current base URL (track.delhivery.com)
        'https://api.delhivery.com', // API base URL
        'https://staging-express.delhivery.com', // Staging
        'https://track.delhivery.com' // Keep original
      ];

      // Try to get a client with the original base URL first
      let client = this.getClient();

      // Delhivery API endpoints - based on official documentation
      // Delhivery uses forward order creation pattern
      // Common endpoints:
      // - /api/cmu/packing_slip (POST) - Packing slip creation
      // - /api/p/packing_slip (POST) - Alternative packing slip
      // - /forward/order/create (POST) - Forward order creation
      const endpoints = [
        '/api/cmu/packing_slip',           // Most common for packing slip
        '/api/p/packing_slip',             // Alternative format
        '/forward/order/create',           // Forward order creation (without /api prefix)
        '/api/forward/order/create',       // With /api prefix
        '/v1/forward/order/create',        // With version prefix
        '/api/v1/forward/order/create',    // Full version path
        '/api/p/packing-slip',             // With hyphen (alternative)
        '/api/shipment/create'             // Generic endpoint (fallback)
      ];

      // Prepare shipment payload as per Delhivery API format
      // Delhivery typically uses camelCase or snake_case field names
      const payload = {
        // Delivery/Consignee details
        name: shipmentData.delivery.name,
        phone: shipmentData.delivery.phone,
        add: shipmentData.delivery.address,
        pin: shipmentData.delivery.pincode,
        city: shipmentData.delivery.city,
        state: shipmentData.delivery.state,
        
        // Package details
        shipment_width: shipmentData.package.dimensions?.width || 10,
        shipment_height: shipmentData.package.dimensions?.height || 10,
        shipment_length: shipmentData.package.dimensions?.length || 10,
        weight: this.kgToGrams(shipmentData.package.weight || 0.5),
        
        // Payment and order details
        payment_mode: 'Pre-paid',
        amount: shipmentData.package.declaredValue || 0,
        order: shipmentData.orderId || `ORDER_${Date.now()}`,
        
        // Service type
        service_type: 'surface' // or 'express'
      };

      // Add pickup details if provided
      if (shipmentData.pickup) {
        payload.pickup_name = shipmentData.pickup.name;
        payload.pickup_phone = shipmentData.pickup.phone;
        payload.pickup_add = shipmentData.pickup.address;
        payload.pickup_pin = shipmentData.pickup.pincode;
        payload.pickup_city = shipmentData.pickup.city;
        payload.pickup_state = shipmentData.pickup.state;
      }

      console.log('[Delhivery] Creating shipment');
      console.log('[Delhivery] Payload:', JSON.stringify(payload, null, 2));

      // Try endpoints in order until one works
      let response = null;
      let lastError = null;

      for (const endpoint of endpoints) {
        try {
          console.log(`[Delhivery] Trying endpoint: ${endpoint}`);
          response = await client.post(endpoint, payload);
          console.log(`[Delhivery] Success with endpoint: ${endpoint}`);
          break;
        } catch (err) {
          lastError = err;
          if (err.response) {
            console.warn(`[Delhivery] Endpoint ${endpoint} failed: ${err.response.status} - ${err.response.statusText}`);
            if (err.response.status !== 404 && err.response.status !== 405) {
              // If not 404/405, might be auth issue, stop trying
              break;
            }
          }
        }
      }

      if (!response) {
        throw lastError || new Error('All endpoints failed');
      }

      // Log response for debugging
      console.log('[Delhivery] Response status:', response.status);
      console.log('[Delhivery] Response data:', JSON.stringify(response.data, null, 2));

      // Extract AWB and tracking information
      let responseData = response.data;
      
      // Handle array or nested responses
      if (Array.isArray(responseData) && responseData.length > 0) {
        responseData = responseData[0];
      }
      if (responseData?.data) {
        responseData = responseData.data;
      }
      if (responseData?.result) {
        responseData = responseData.result;
      }
      
      // Delhivery typically returns AWB in response
      // Try multiple possible field names
      const awb = responseData?.waybill || 
                  responseData?.wayBill ||
                  responseData?.awb || 
                  responseData?.AWB ||
                  responseData?.tracking_id ||
                  responseData?.trackingId ||
                  responseData?.packing_slip ||
                  responseData?.packingSlip ||
                  null;

      return {
        awb: awb,
        trackingNumber: awb,
        trackingUrl: awb ? `https://www.delhivery.com/track/${awb}` : null,
        status: 'created',
        partnerOrderId: responseData?.order_id || 
                       responseData?.orderId || 
                       responseData?.order_number ||
                       null,
        metadata: responseData
      };
    } catch (error) {
      // Log detailed error information
      if (error.response) {
        console.error('[Delhivery] Shipment creation error:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
          headers: error.response.headers
        });
      } else {
        console.error('[Delhivery] Shipment creation error:', error.message);
      }

      // If API call fails in development, return mock data
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Delhivery] Shipment creation API unavailable, using mock data:', error.message);
        return {
          awb: `DELHIVERY${Date.now()}`,
          trackingNumber: `DELHIVERY${Date.now()}`,
          trackingUrl: `https://www.delhivery.com/track/DELHIVERY${Date.now()}`,
          status: 'created',
          metadata: { mock: true }
        };
      }
      this.handleError(error, 'createShipment');
    }
  }

  /**
   * Track shipment by AWB
   * 
   * API: GET /api/packages/json
   * 
   * @param {String} trackingNumber - AWB number
   * @returns {Promise<Object>} Tracking information
   */
  async trackShipment(trackingNumber) {
    try {
      const client = this.getClient();

      // Delhivery tracking API endpoints - try multiple formats
      // Based on documentation: /waybill/api/fetch/json/?cl={client}&waybill={awb}
      const clientName = process.env.DELHIVERY_CLIENT_NAME || '';
      const endpoints = [
        `/api/packages/json?waybill=${trackingNumber}`,                    // Standard format
        `/api/packages/json?waybill=${trackingNumber}&cl=${clientName}`,  // With client name
        `/waybill/api/fetch/json/?waybill=${trackingNumber}&cl=${clientName}`, // Alternative format from docs
        `/api/tracking?waybill=${trackingNumber}`,                        // Alternative
        `/v1/tracking?waybill=${trackingNumber}`,                         // Versioned
        `/api/packages?waybill=${trackingNumber}`                         // Without .json
      ];

      console.log(`[Delhivery] Tracking shipment: ${trackingNumber}`);

      // Try endpoints in order until one works
      let response = null;
      let lastError = null;

      for (const endpoint of endpoints) {
        try {
          console.log(`[Delhivery] Trying tracking endpoint: ${endpoint}`);
          response = await client.get(endpoint);
          console.log(`[Delhivery] Success with tracking endpoint: ${endpoint}`);
          break;
        } catch (err) {
          lastError = err;
          if (err.response) {
            console.warn(`[Delhivery] Tracking endpoint ${endpoint} failed: ${err.response.status} - ${err.response.statusText}`);
            if (err.response.status !== 404) {
              // If not 404, might be auth issue, stop trying
              break;
            }
          }
        }
      }

      if (!response) {
        throw lastError || new Error('All tracking endpoints failed');
      }

      const trackingData = response.data;

      // Map Delhivery status to our internal status
      const providerStatus = trackingData?.ShipmentData?.[0]?.Status || 
                            trackingData?.status ||
                            'Unknown';

      return {
        awb: trackingNumber,
        status: this.mapStatus(providerStatus),
        currentLocation: trackingData?.ShipmentData?.[0]?.CurrentLocation || null,
        history: trackingData?.ShipmentData?.[0]?.Scans || 
                trackingData?.tracking_history || 
                [],
        expectedDelivery: trackingData?.ShipmentData?.[0]?.ExpectedDate || null,
        trackingUrl: `https://www.delhivery.com/track/${trackingNumber}`,
        metadata: trackingData
      };
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Delhivery] Tracking API unavailable, using mock data:', error.message);
        return {
          awb: trackingNumber,
          status: ORDER_STATUS.IN_TRANSIT,
          history: [{ status: 'Mock Data - In Transit', timestamp: new Date().toISOString() }],
          trackingUrl: `https://www.delhivery.com/track/${trackingNumber}`,
          metadata: { mock: true }
        };
      }
      this.handleError(error, 'trackShipment');
    }
  }

  /**
   * Map Delhivery status to our internal status
   * @param {String} delhiveryStatus - Delhivery status string
   * @returns {String} Internal status
   */
  mapStatus(delhiveryStatus) {
    const statusMap = {
      'In Transit': ORDER_STATUS.IN_TRANSIT,
      'Out for Delivery': ORDER_STATUS.OUT_FOR_DELIVERY,
      'Delivered': ORDER_STATUS.DELIVERED,
      'RTO': ORDER_STATUS.RTO,
      'Cancelled': ORDER_STATUS.CANCELLED,
      'Pending': ORDER_STATUS.PENDING,
      'Dispatched': ORDER_STATUS.CONFIRMED,
      'Manifested': ORDER_STATUS.CONFIRMED,
      'Pickup': ORDER_STATUS.PICKED_UP
    };

    // Normalize status string
    const normalizedStatus = delhiveryStatus?.trim() || '';
    
    // Check direct mapping
    if (statusMap[normalizedStatus]) {
      return statusMap[normalizedStatus];
    }

    // Check case-insensitive match
    const lowerStatus = normalizedStatus.toLowerCase();
    for (const [key, value] of Object.entries(statusMap)) {
      if (key.toLowerCase() === lowerStatus) {
        return value;
      }
    }

    // Default to pending if unknown
    return ORDER_STATUS.PENDING;
  }

  /**
   * Get mock rate for development/testing
   * @param {Object} rateData - Rate calculation data
   * @returns {Object} Mock rate data
   */
  _getMockRate(rateData) {
    const weight = rateData.weight || 0.5;
    const baseRate = 50 + (weight * 10); // ₹50 base + ₹10 per kg
    const additionalCharges = 20;
    const gst = (baseRate + additionalCharges) * 0.18;
    const dph = 5;
    const totalAmount = baseRate + additionalCharges + gst + dph;

    return {
      baseRate: parseFloat(baseRate.toFixed(2)),
      additionalCharges: parseFloat(additionalCharges.toFixed(2)),
      gst: parseFloat(gst.toFixed(2)),
      dph: parseFloat(dph.toFixed(2)),
      totalAmount: parseFloat(totalAmount.toFixed(2)),
      currency: 'INR',
      estimatedDelivery: '3-5 business days',
      serviceType: rateData.serviceType || 'express',
      metadata: { mock: true }
    };
  }
}

module.exports = DelhiveryProvider;
