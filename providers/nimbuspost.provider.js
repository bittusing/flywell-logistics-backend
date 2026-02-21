const BaseProvider = require('./base.provider');
const AppError = require('../utils/AppError');

/**
 * NimbusPost Provider
 * Documentation: https://api.nimbuspost.com/
 */
class NimbusPostProvider extends BaseProvider {
  constructor() {
    super('nimbuspost', 'https://api.nimbuspost.com/v1');
    
    this.email = process.env.NIMBUSPOST_EMAIL;
    this.password = process.env.NIMBUSPOST_PASSWORD;
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  /**
   * Authenticate and get access token
   * @returns {String} Access token
   */
  async getAccessToken() {
    try {
      // Return cached token if still valid
      if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
        return this.accessToken;
      }

      if (!this.email || !this.password) {
        throw new AppError('NimbusPost credentials not configured', 500);
      }

      console.log('Authenticating with NimbusPost API...');

      const client = this.getClient();
      const response = await client.post('/users/login', {
        email: this.email,
        password: this.password
      });

      if (!response.data.status || !response.data.data) {
        throw new AppError('Authentication failed', 401);
      }

      this.accessToken = response.data.data;
      // Set token expiry to 23 hours (tokens typically valid for 24 hours)
      this.tokenExpiry = Date.now() + (23 * 60 * 60 * 1000);

      console.log('NimbusPost authentication successful');
      return this.accessToken;
    } catch (error) {
      console.error('NimbusPost Authentication Error:', error.response?.data || error.message);
      throw new AppError(
        'Failed to authenticate with NimbusPost',
        error.response?.status || 500
      );
    }
  }

  /**
   * Get headers with authentication
   * @returns {Object} Headers
   */
  async getAuthHeaders() {
    const token = await this.getAccessToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  /**
   * Calculate shipping rate with serviceability
   * @param {Object} rateData - Rate calculation data
   * @returns {Promise<Object>} Rate information with courier options
   */
  async calculateRate(rateData) {
    try {
      const headers = await this.getAuthHeaders();
      const client = this.getClient();

      // Prepare request data
      const requestData = {
        origin: rateData.from.pincode,
        destination: rateData.to.pincode,
        payment_type: rateData.paymentType || 'prepaid', // cod or prepaid
        order_amount: Math.round(rateData.declaredValue || 1000),
        weight: this.kgToGrams(rateData.weight), // Convert kg to grams
        length: Math.round(rateData.dimensions?.length || 10),
        breadth: Math.round(rateData.dimensions?.width || 10),
        height: Math.round(rateData.dimensions?.height || 10)
      };

      console.log('NimbusPost Rate Request:', requestData);

      const response = await client.post('/courier/serviceability', requestData, { headers });

      if (!response.data.status || !response.data.data) {
        throw new AppError('No courier services available', 400);
      }

      const couriers = response.data.data;

      // Sort by total charges (cheapest first)
      couriers.sort((a, b) => a.total_charges - b.total_charges);

      // Return the cheapest option as default, but include all options
      const cheapest = couriers[0];

      return {
        baseRate: cheapest.freight_charges,
        additionalCharges: cheapest.cod_charges || 0,
        totalAmount: cheapest.total_charges,
        currency: 'INR',
        estimatedDelivery: '3-5 business days',
        serviceType: cheapest.name,
        courierId: cheapest.id,
        courierName: cheapest.name,
        minWeight: cheapest.min_weight,
        chargeableWeight: cheapest.chargeable_weight,
        // Include all courier options for frontend selection
        courierOptions: couriers.map(courier => ({
          id: courier.id,
          name: courier.name,
          freightCharges: courier.freight_charges,
          codCharges: courier.cod_charges || 0,
          totalCharges: courier.total_charges,
          minWeight: courier.min_weight,
          chargeableWeight: courier.chargeable_weight
        })),
        metadata: {
          provider: 'nimbuspost',
          requestData
        }
      };
    } catch (error) {
      this.handleError(error, 'calculateRate');
    }
  }

  /**
   * Create shipment with NimbusPost
   * @param {Object} shipmentData - Shipment data
   * @returns {Promise<Object>} Shipment information
   */
  async createShipment(shipmentData) {
    try {
      const headers = await this.getAuthHeaders();
      const client = this.getClient();

      // Extract and transform data
      const pickup = shipmentData.pickup;
      const delivery = shipmentData.delivery;
      const packageInfo = shipmentData.package;

      // Prepare shipment request
      const requestData = {
        order_number: shipmentData.orderId || `#${Date.now()}`,
        shipping_charges: Math.round(shipmentData.shippingCharges || 0),
        discount: Math.round(shipmentData.discount || 0),
        cod_charges: Math.round(shipmentData.codCharges || 0),
        payment_type: shipmentData.paymentType || 'prepaid', // cod or prepaid
        order_amount: Math.round(packageInfo.declaredValue || 1000),
        package_weight: this.kgToGrams(packageInfo.weight),
        package_length: Math.round(packageInfo.dimensions?.length || 10),
        package_breadth: Math.round(packageInfo.dimensions?.width || 10),
        package_height: Math.round(packageInfo.dimensions?.height || 10),
        request_auto_pickup: 'Yes',
        
        // Consignee (delivery) details
        consignee: {
          name: delivery.name,
          address: delivery.address,
          address_2: delivery.address2 || delivery.landmark || '',
          city: delivery.city,
          state: delivery.state,
          pincode: delivery.pincode,
          phone: delivery.phone
        },
        
        // Pickup details (warehouse)
        pickup: {
          warehouse_name: pickup.warehouseName || pickup.warehouse_name || 'Warehouse 1',
          name: pickup.name,
          address: pickup.address,
          address_2: pickup.address2 || pickup.landmark || '',
          city: pickup.city,
          state: pickup.state,
          pincode: pickup.pincode,
          phone: pickup.phone
        },
        
        // Order items
        order_items: shipmentData.orderItems || [{
          name: packageInfo.description || 'Product',
          qty: '1',
          price: String(Math.round(packageInfo.declaredValue || 1000)),
          sku: 'SKU001'
        }]
      };

      // Add courier_id if specified
      if (shipmentData.courierId) {
        requestData.courier_id = String(shipmentData.courierId);
      }

      // Add tags if specified
      if (shipmentData.tags) {
        requestData.tags = Array.isArray(shipmentData.tags) 
          ? shipmentData.tags.join(', ') 
          : shipmentData.tags;
      }

      console.log('NimbusPost Create Shipment Request:', {
        order_number: requestData.order_number,
        payment_type: requestData.payment_type,
        order_amount: requestData.order_amount,
        package_weight: requestData.package_weight,
        consignee: { 
          name: requestData.consignee.name,
          city: requestData.consignee.city,
          pincode: requestData.consignee.pincode,
          phone: '****' + requestData.consignee.phone.slice(-4) 
        },
        pickup: { 
          warehouse_name: requestData.pickup.warehouse_name,
          name: requestData.pickup.name,
          city: requestData.pickup.city,
          pincode: requestData.pickup.pincode,
          phone: '****' + requestData.pickup.phone.slice(-4) 
        }
      });

      const response = await client.post('/shipments', requestData, { headers });

      console.log('NimbusPost Create Shipment Response:', {
        status: response.data.status,
        hasData: !!response.data.data,
        message: response.data.message,
        error: response.data.error
      });

      if (!response.data.status || !response.data.data) {
        const errorMsg = response.data.message || response.data.error || 'Shipment creation failed';
        console.error('NimbusPost Shipment Error Response:', response.data);
        throw new AppError(`Shipment creation failed: ${errorMsg}`, 400);
      }

      const data = response.data.data;

      return {
        success: true,
        awb: data.awb_number,
        trackingNumber: data.awb_number,
        orderId: data.order_id,
        shipmentId: data.shipment_id,
        courierId: data.courier_id,
        courierName: data.courier_name,
        status: data.status,
        labelUrl: data.label,
        trackingUrl: `https://ship.nimbuspost.com/tracking/${data.awb_number}`,
        additionalInfo: data.additional_info,
        metadata: {
          provider: 'nimbuspost',
          paymentType: requestData.payment_type
        }
      };
    } catch (error) {
      this.handleError(error, 'createShipment');
    }
  }

  /**
   * Track shipment by AWB
   * @param {String} awbNumber - AWB number
   * @returns {Promise<Object>} Tracking information
   */
  async trackShipment(awbNumber) {
    try {
      const headers = await this.getAuthHeaders();
      const client = this.getClient();

      const response = await client.get(`/shipments/track/${awbNumber}`, { headers });

      if (!response.data.status || !response.data.data) {
        throw new AppError('Tracking information not available', 404);
      }

      const data = response.data.data;

      return {
        awb: awbNumber,
        status: this.mapStatus(data.status),
        currentLocation: data.current_location,
        courierName: data.courier_name,
        estimatedDelivery: data.estimated_delivery,
        trackingHistory: data.tracking_history || [],
        lastUpdate: data.last_update,
        metadata: {
          provider: 'nimbuspost',
          rawStatus: data.status
        }
      };
    } catch (error) {
      this.handleError(error, 'trackShipment');
    }
  }

  /**
   * Get courier list
   * @returns {Promise<Array>} List of available couriers
   */
  async getCourierList() {
    try {
      const headers = await this.getAuthHeaders();
      const client = this.getClient();

      const response = await client.get('/courier', { headers });

      if (!response.data.status || !response.data.data) {
        throw new AppError('Failed to fetch courier list', 400);
      }

      return response.data.data;
    } catch (error) {
      this.handleError(error, 'getCourierList');
    }
  }

  /**
   * Check pincode serviceability
   * @param {String} pincode - Pincode to check
   * @returns {Promise<Object>} Serviceability information
   */
  async checkPincodeServiceability(pincode) {
    try {
      const headers = await this.getAuthHeaders();
      const client = this.getClient();

      const response = await client.get(`/courier/serviceable-pincodes/${pincode}`, { headers });

      if (!response.data.status) {
        return {
          serviceable: false,
          pincode,
          message: 'Pincode not serviceable'
        };
      }

      return {
        serviceable: true,
        pincode,
        couriers: response.data.data || [],
        message: 'Pincode is serviceable'
      };
    } catch (error) {
      return {
        serviceable: false,
        pincode,
        message: error.message
      };
    }
  }

  /**
   * Map NimbusPost status to internal status
   * @param {String} nimbusStatus - NimbusPost status
   * @returns {String} Internal status
   */
  mapStatus(nimbusStatus) {
    const statusMap = {
      'booked': 'confirmed',
      'manifested': 'in_transit',
      'shipped': 'in_transit',
      'in_transit': 'in_transit',
      'out_for_delivery': 'out_for_delivery',
      'delivered': 'delivered',
      'rto': 'rto',
      'rto_delivered': 'rto_delivered',
      'cancelled': 'cancelled',
      'lost': 'lost',
      'damaged': 'damaged'
    };

    return statusMap[nimbusStatus?.toLowerCase()] || nimbusStatus?.toLowerCase() || 'pending';
  }


   /**
    * Fetch AWB numbers from NimbusPost
    * @param {Number} quantity - Number of AWBs to fetch
    * @returns {Promise<Array>} AWB numbers
    */
   async fetchAWBNumbers(quantity) {
     try {
       const headers = await this.getAuthHeaders();
       const client = this.getClient();

       console.log(`Fetching ${quantity} AWB numbers from NimbusPost...`);

       const response = await client.post('/courier/awb',
         { quantity },
         { headers }
       );

       if (!response.data.status || !response.data.data) {
         throw new AppError('Failed to fetch AWB numbers', 400);
       }

       console.log(`Successfully fetched ${response.data.data.length} AWB numbers`);
       return response.data.data;
     } catch (error) {
       console.error('NimbusPost AWB Fetch Error:', error.response?.data || error.message);
       throw new AppError(
         error.response?.data?.message || 'Failed to fetch AWB numbers from NimbusPost',
         error.response?.status || 500
       );
     }
   }

}

module.exports = NimbusPostProvider;
