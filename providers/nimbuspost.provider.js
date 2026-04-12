const http = require('http');
const https = require('https');
const { URL: URLParser } = require('url');
const axios = require('axios');
const BaseProvider = require('./base.provider');
const AppError = require('../utils/AppError');

/**
 * Nimbus Ship API — POST JSON with exact headers (no fetch/undici/axios charset quirks).
 * @param {string} urlString - Full URL including path and optional ?query
 * @param {object} jsonBody - Serialized as JSON body
 * @param {string} apiKey - NP-API-KEY
 * @param {'json'|'arraybuffer'} responseType
 */
function nimbusShipHttpsPost(urlString, jsonBody, apiKey, responseType = 'json', timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    let url;
    try {
      url = new URLParser(urlString);
    } catch {
      reject(new Error('Invalid Ship API URL'));
      return;
    }
    const bodyBuf = Buffer.from(JSON.stringify(jsonBody), 'utf8');
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;
    const port = url.port ? Number(url.port) : isHttps ? 443 : 80;
    const options = {
      hostname: url.hostname,
      port,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': bodyBuf.length,
        Accept: 'application/json',
        'NP-API-KEY': apiKey
      }
    };
    const req = lib.request(options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        const status = res.statusCode || 0;
        const ct = (res.headers['content-type'] || '').toLowerCase();
        const headers = { 'content-type': ct };
        if (responseType === 'arraybuffer') {
          resolve({ status, headers, data: buf });
          return;
        }
        const text = buf.toString('utf8');
        let data;
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
        resolve({ status, headers, data });
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('Nimbus Ship API request timeout'));
    });
    req.write(bodyBuf);
    req.end();
  });
}

/**
 * Normalize .env values: Windows \\r, surrounding quotes, accidental spaces.
 * Important: duplicate KEY= lines in .env — dotenv uses the LAST one; a second truncated line breaks Ship API.
 */
function envTrim(name) {
  const v = process.env[name];
  if (v == null || v === '') return '';
  return String(v)
    .replace(/\r/g, '')
    .trim()
    .replace(/^["']|["']$/g, '');
}

/**
 * NimbusPost Provider
 * Documentation: https://api.nimbuspost.com/
 */
class NimbusPostProvider extends BaseProvider {
  constructor() {
    super('nimbuspost', 'https://api.nimbuspost.com/v1');

    this.email = process.env.NIMBUSPOST_EMAIL;
    this.password = process.env.NIMBUSPOST_PASSWORD;
    /** Ship portal APIs (pickup, label) use NP-API-KEY — same key as Nimbus ship dashboard */
    this.shipApiBaseUrl =
      envTrim('NIMBUSPOST_SHIP_API_BASE') || 'https://ship.nimbuspost.com/api';
    this.nimbusApiKey = envTrim('NIMBUSPOST_API_KEY') || undefined;
    this.accessToken = null;
    this.tokenExpiry = null;

    if (process.env.NODE_ENV === 'development' && this.nimbusApiKey) {
      console.log(
        '[NimbusPost] NIMBUSPOST_API_KEY loaded (length:',
        this.nimbusApiKey.length,
        ') — if pickup/label fail, ensure only ONE key in .env and it matches Ship panel → API'
      );
    }
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
   * Nimbus requires exactly 10 digits (+91 / spaces / leading 0 stripped).
   */
  normalizeNimbusPhone(phone, fieldLabel = 'Phone') {
    if (phone == null || String(phone).trim() === '') {
      throw new AppError(`${fieldLabel} is required`, 400);
    }
    let digits = String(phone).replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('0')) {
      digits = digits.slice(1);
    }
    if (digits.length === 12 && digits.startsWith('91')) {
      digits = digits.slice(2);
    } else if (digits.length > 10) {
      digits = digits.slice(-10);
    }
    if (digits.length !== 10) {
      throw new AppError(
        `${fieldLabel} must be exactly 10 digits (Nimbus requirement); got ${digits.length} digit(s) after cleanup`,
        400
      );
    }
    return digits;
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
        payment_type:
          rateData.paymentType === 'cod' ? 'cod' : 'prepaid',
        order_amount: Math.round(rateData.declaredValue || 1000),
        weight: this.kgToGrams(rateData.weight), // Convert kg to grams
        length: Math.round(rateData.dimensions?.length || 10),
        breadth: Math.round(rateData.dimensions?.width || 10),
        height: Math.round(rateData.dimensions?.height || 10)
      };

      console.log('NimbusPost Rate Request:', requestData);

      const response = await client.post('/courier/serviceability', requestData, { headers });
      const payload = response.data;

      const couriers = Array.isArray(payload?.data) ? payload.data : [];

      if (!payload?.status || couriers.length === 0) {
        console.warn('[NimbusPost] serviceability — no couriers', {
          request: requestData,
          apiStatus: payload?.status,
          apiMessage: payload?.message,
          courierCount: couriers.length,
          raw: payload
        });
        const hint =
          payload?.message ||
          'No courier is available for this origin–destination and package. Check pincodes, weight, and dimensions.';
        throw new AppError(hint, 400);
      }

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
      if (error instanceof AppError) {
        throw error;
      }
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

      const consigneePhone = this.normalizeNimbusPhone(
        delivery.phone,
        'Consignee phone'
      );
      const pickupPhone = this.normalizeNimbusPhone(pickup.phone, 'Pickup phone');

      // Prepare shipment request
      const requestData = {
        order_number: shipmentData.orderId || `#${Date.now()}`,
        shipping_charges: Math.round(shipmentData.shippingCharges || 0),
        discount: Math.round(shipmentData.discount || 0),
        cod_charges: Math.round(shipmentData.codCharges || 0),
        payment_type:
          shipmentData.paymentType === 'cod' ? 'cod' : 'prepaid',
        order_amount: Math.round(packageInfo.declaredValue || 1000),
        package_weight: this.kgToGrams(packageInfo.weight),
        package_length: Math.round(packageInfo.dimensions?.length || 10),
        package_breadth: Math.round(packageInfo.dimensions?.width || 10),
        package_height: Math.round(packageInfo.dimensions?.height || 10),
        request_auto_pickup: 'yes',
        
        // Consignee (delivery) details
        consignee: {
          name: delivery.name,
          address: delivery.address,
          address_2:
            delivery.address2 ||
            delivery.addressLine2 ||
            delivery.landmark ||
            '',
          city: delivery.city,
          state: delivery.state,
          pincode: delivery.pincode,
          phone: consigneePhone
        },
        
        // Pickup details (warehouse)
        pickup: {
          warehouse_name: pickup.warehouseName || pickup.warehouse_name || 'Warehouse 1',
          name: pickup.name,
          address: pickup.address,
          address_2:
            pickup.address2 || pickup.addressLine2 || pickup.landmark || '',
          city: pickup.city,
          state: pickup.state,
          pincode: pickup.pincode,
          phone: pickupPhone
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
   * Cancel shipment (main API — Bearer token, not Ship NP-API-KEY).
   * POST /v1/shipments/cancel — body: { "awb": "<awb>" }
   */
  async cancelShipment(awb) {
    try {
      const awbStr = String(awb ?? '').trim();
      if (!awbStr) {
        throw new AppError('AWB is required to cancel shipment', 400);
      }
      const headers = await this.getAuthHeaders();
      const client = this.getClient();
      const response = await client.post(
        '/shipments/cancel',
        { awb: awbStr },
        { headers }
      );
      const payload = response.data;
      if (payload && payload.status === false) {
        throw new AppError(
          payload.message || 'Nimbus refused to cancel this shipment',
          400
        );
      }
      return payload;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      this.handleError(error, 'cancelShipment');
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

  /**
   * Base URL for ship.nimbuspost.com APIs (must include `/api`).
   * If env is only `https://ship.nimbuspost.com`, `/api` is appended to avoid 404 on wrong path.
   */
  /**
   * Always read latest env (singleton loads before dotenv in some tests; nodemon restarts need fresh base).
   */
  normalizeShipApiBaseUrl() {
    const raw = (
      envTrim('NIMBUSPOST_SHIP_API_BASE') ||
      this.shipApiBaseUrl ||
      'https://ship.nimbuspost.com/api'
    ).replace(/\/+$/, '');
    try {
      const u = new URL(raw);
      if (u.pathname === '/' || u.pathname === '') {
        return `${u.origin}/api`;
      }
    } catch (_) {
      /* keep raw */
    }
    return raw;
  }

  /**
   * Ship API — NP-API-KEY + JSON body (Nimbus rejects form-urlencoded).
   */
  requireNimbusShipApiKey() {
    const key = envTrim('NIMBUSPOST_API_KEY') || this.nimbusApiKey;
    if (!key) {
      throw new AppError(
        'NIMBUSPOST_API_KEY is not configured (required for pickup & label on ship.nimbuspost.com)',
        500
      );
    }
    return key;
  }

  /**
   * Ship portal (ship.nimbuspost.com/api): NP-API-KEY + JSON body via native https.
   * Avoids fetch/axios adding charset or altering Content-Type (Nimbus rejects that with
   * "Invalid Content-Type. Only application/json is allowed.").
   * @param {object} [query] - Optional query params (e.g. { ids: '1,2' }) appended to URL
   */
  async shipApiPost(path, jsonBody, { responseType = 'json', query = null } = {}) {
    const apiKey = this.requireNimbusShipApiKey();
    const base = this.normalizeShipApiBaseUrl();
    const pathNorm = path.startsWith('/') ? path : `/${path}`;
    let search = '';
    if (query && typeof query === 'object') {
      const sp = new URLSearchParams();
      for (const [k, v] of Object.entries(query)) {
        if (v != null && v !== '') sp.set(k, String(v));
      }
      const q = sp.toString();
      if (q) search = `?${q}`;
    }
    const url = `${base}${pathNorm}${search}`;
    const timeoutMs = responseType === 'arraybuffer' ? 120000 : 60000;

    console.log('[NimbusPost Ship API] POST', url);

    return nimbusShipHttpsPost(url, jsonBody, apiKey, responseType, timeoutMs);
  }

  /**
   * Official: POST {base}/shipments/pickups — https://ship.nimbuspost.com/api/shipments/pickups
   * Header: NP-API-KEY. Body: ids as array (docs show ids[] e.g. array(222,333,656) → JSON {"ids":[222,333,656]}).
   * @param {Array<number|string>} shipmentIds - Nimbus shipment IDs
   */
  async requestPickup(shipmentIds) {
    try {
      const ids = Array.isArray(shipmentIds) ? shipmentIds : [shipmentIds];
      const cleaned = ids.map((id) => String(id).trim()).filter(Boolean);
      if (!cleaned.length) {
        throw new AppError('At least one shipment id is required', 400);
      }

      const idsNumeric = cleaned.map((id) => {
        const n = Number(id);
        return Number.isFinite(n) ? n : id;
      });

      console.log('[NimbusPost Ship API] POST /shipments/pickups', {
        count: cleaned.length,
        base: this.normalizeShipApiBaseUrl()
      });

      const response = await this.shipApiPost('/shipments/pickups', {
        ids: idsNumeric
      });

      const data = response.data;
      if (data && typeof data === 'object' && data.status === false) {
        throw new AppError(data.message || 'Pickup request rejected by Nimbus', 400);
      }
      if (response.status >= 400) {
        let msg = `Pickup request failed (${response.status})`;
        if (typeof data === 'string') {
          msg = data.length > 500 ? `${data.slice(0, 500)}…` : data;
        } else if (data && typeof data === 'object') {
          msg = data.message || data.error || msg;
        }
        throw new AppError(msg, response.status);
      }

      return data;
    } catch (error) {
      if (error instanceof AppError) throw error;
      const d = error.response?.data;
      let msg = error.message;
      if (Buffer.isBuffer(d)) {
        msg = d.toString('utf8').slice(0, 500);
      } else if (typeof d === 'string') {
        msg = d.slice(0, 500);
      } else if (d && typeof d === 'object') {
        msg = d.message || d.error || msg;
      }
      console.error('[NimbusPost Ship API] pickup error:', d || msg);
      throw new AppError(`Nimbus pickup failed: ${msg}`, error.response?.status || 500);
    }
  }

  /**
   * Official: POST {base}/shipments/label — https://ship.nimbuspost.com/api/shipments/label
   * Body: ids as comma-separated string (docs). Optional retry: single id as integer.
   * Do not send ids as JSON array — Nimbus may reject with "Invalid Content-Type" on label route.
   * @param {Array<number|string>} shipmentIds - Nimbus shipment IDs
   */
  async generateShippingLabels(shipmentIds) {
    try {
      const ids = Array.isArray(shipmentIds) ? shipmentIds : [shipmentIds];
      const cleaned = ids.map((id) => String(id).trim()).filter(Boolean);
      if (!cleaned.length) {
        throw new AppError('At least one shipment id is required', 400);
      }

      const idsNumeric = cleaned
        .map((x) => parseInt(x, 10))
        .filter((n) => !Number.isNaN(n));
      const idsComma = cleaned.join(',');

      const configuredPath = envTrim('NIMBUSPOST_SHIP_LABEL_PATH');
      const labelPaths = [configuredPath || '/shipments/label', '/shipments/label'].filter(
        (p, i, arr) => p && arr.indexOf(p) === i
      );

      const parseLabelErrorBuf = (data) => {
        const raw = Buffer.from(data).toString('utf8');
        if (/<!DOCTYPE|<html/i.test(raw)) {
          return 'Wrong Ship API path (HTML 404). Use NIMBUSPOST_SHIP_API_BASE=https://ship.nimbuspost.com/api';
        }
        try {
          const j = JSON.parse(raw);
          return j.message || j.error || raw.slice(0, 300);
        } catch (_) {
          return raw.slice(0, 300);
        }
      };

      /** JSON body only → then query ?ids= (docs/Postman) with {} or duplicate body */
      const labelAttempts = [
        { body: { ids: idsComma }, query: null, tag: 'body:ids-string' },
        ...(cleaned.length === 1 && idsNumeric.length === 1
          ? [{ body: { ids: idsNumeric[0] }, query: null, tag: 'body:ids-int' }]
          : []),
        { body: {}, query: { ids: idsComma }, tag: 'query:ids + body:{}' },
        { body: { ids: idsComma }, query: { ids: idsComma }, tag: 'query:ids + body:ids' }
      ];

      console.log('[NimbusPost Ship API] label attempt', {
        idsComma,
        idsNumeric,
        base: this.normalizeShipApiBaseUrl(),
        paths: labelPaths,
        strategies: labelAttempts.map((a) => a.tag)
      });

      let response;
      let lastMsg = 'Label generation failed';
      let lastStatus = 500;

      pathLoop: for (const path of labelPaths) {
        for (const attempt of labelAttempts) {
          response = await this.shipApiPost(path, attempt.body, {
            responseType: 'arraybuffer',
            query: attempt.query || undefined
          });
          if (response.status < 400) {
            break pathLoop;
          }
          lastMsg = parseLabelErrorBuf(response.data);
          lastStatus = response.status;
          console.warn(
            '[NimbusPost Ship API] label HTTP',
            response.status,
            attempt.tag,
            lastMsg.slice(0, 120)
          );
        }
        if (response.status < 400) {
          break;
        }
        if (labelPaths.indexOf(path) < labelPaths.length - 1) {
          console.warn('[NimbusPost Ship API] label trying next path');
        }
      }

      if (!response || response.status >= 400) {
        throw new AppError(lastMsg, lastStatus);
      }

      const status = response.status;
      const ct = (
        response.headers['content-type'] ||
        response.headers['Content-Type'] ||
        ''
      ).toLowerCase();

      if (status >= 400) {
        let msg = 'Label generation failed';
        try {
          const txt = Buffer.from(response.data).toString('utf8');
          const j = JSON.parse(txt);
          msg = j.message || j.error || msg;
        } catch (_) {
          try {
            msg = Buffer.from(response.data).toString('utf8').slice(0, 500);
          } catch (_) {}
        }
        throw new AppError(msg, status);
      }

      if (ct.includes('application/pdf')) {
        return {
          type: 'pdf',
          buffer: Buffer.from(response.data),
          filename: `shipping-label-${cleaned.join('-')}.pdf`,
          contentType: 'application/pdf'
        };
      }

      if (ct.includes('application/json')) {
        const json = JSON.parse(Buffer.from(response.data).toString('utf8'));
        if (json.status === false && json.message) {
          throw new AppError(json.message, 400);
        }
        return { type: 'json', data: json };
      }

      return {
        type: 'raw',
        buffer: Buffer.from(response.data),
        contentType: ct || 'application/octet-stream',
        filename: `label-${cleaned.join('-')}.bin`
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      const d = error.response?.data;
      let msg = error.message;
      if (Buffer.isBuffer(d)) {
        msg = d.toString('utf8').slice(0, 500);
      } else if (typeof d === 'string') {
        msg = d.slice(0, 500);
      } else if (d && typeof d === 'object') {
        msg = d.message || d.error || msg;
      }
      console.error('[NimbusPost Ship API] label error:', d || msg);
      throw new AppError(`Nimbus label failed: ${msg}`, error.response?.status || 500);
    }
  }
}

module.exports = NimbusPostProvider;
