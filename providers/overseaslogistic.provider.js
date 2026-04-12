const BaseProvider = require('./base.provider');
const AppError = require('../utils/AppError');
const { ORDER_STATUS } = require('../config/constants');

/**
 * Overseas Logistic Provider
 * 
 * Integration with Overseas Logistic API for international shipping services.
 * Documentation: https://document.overseaslogistic.com/
 * 
 * API Endpoints:
 * - Token Generation: POST /token
 * - Shipment Creation: POST /api/shipment/create
 * - Shipment Tracking: GET /api/tracking/{AwbNo}
 * 
 * Authentication:
 * - OAuth2 with grant_type=client_credentials
 * - Bearer Token in Authorization header
 * 
 * Services Supported:
 * - UPS_SAVER, UPS_EXPRESS, DHL_EXPRESS, FEDEX_PRIORITY, etc.
 */
class OverseasLogisticProvider extends BaseProvider {
    constructor() {
        const baseURL = process.env.OVERSEAS_LOGISTIC_BASE_URL || 'https://api.overseaslogistic.com';

        super('overseas_logistic', baseURL, {
            timeout: 60000 // Longer timeout for international API
        });

        // Token cache
        this._accessToken = null;
        this._tokenExpiry = null;

        // Validate required credentials
        if (!process.env.OVERSEAS_LOGISTIC_USERNAME || !process.env.OVERSEAS_LOGISTIC_PASSWORD) {
            console.warn('[OverseasLogistic] API credentials not found in environment variables');
        }
    }

    /**
     * Get OAuth2 access token
     * Uses grant_type=client_credentials for authentication
     * Caches token until expiry
     * @returns {Promise<String>} Access token
     */
    async getAccessToken() {
        // Check if cached token is still valid (with 5 min buffer)
        if (this._accessToken && this._tokenExpiry) {
            const now = new Date();
            const expiryWithBuffer = new Date(this._tokenExpiry.getTime() - 5 * 60 * 1000);
            if (now < expiryWithBuffer) {
                return this._accessToken;
            }
        }

        const axios = require('axios');
        const tokenUrl = `${this.baseURL}/token`;

        const username = process.env.OVERSEAS_LOGISTIC_USERNAME;
        const password = process.env.OVERSEAS_LOGISTIC_PASSWORD;

        if (!username || !password) {
            throw new AppError('Overseas Logistic credentials not configured', 500);
        }

        console.log(`[OverseasLogistic] Requesting access token from ${tokenUrl}`);

        // Try multiple authentication methods
        const authMethods = [
            // Method 1: Username/password as form fields
            async () => {
                const params = new URLSearchParams();
                params.append('grant_type', 'client_credentials');
                params.append('username', username);
                params.append('password', password);

                console.log('[OverseasLogistic] Trying auth method 1: credentials in form body');
                return await axios.post(tokenUrl, params.toString(), {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    timeout: this.config.timeout
                });
            },
            // Method 2: HTTP Basic Auth
            async () => {
                const params = new URLSearchParams();
                params.append('grant_type', 'client_credentials');

                console.log('[OverseasLogistic] Trying auth method 2: HTTP Basic Auth');
                return await axios.post(tokenUrl, params.toString(), {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    auth: {
                        username: username,
                        password: password
                    },
                    timeout: this.config.timeout
                });
            },
            // Method 3: client_id/client_secret pattern
            async () => {
                const params = new URLSearchParams();
                params.append('grant_type', 'client_credentials');
                params.append('client_id', username);
                params.append('client_secret', password);

                console.log('[OverseasLogistic] Trying auth method 3: client_id/client_secret');
                return await axios.post(tokenUrl, params.toString(), {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    timeout: this.config.timeout
                });
            }
        ];

        let lastError = null;
        for (const authMethod of authMethods) {
            try {
                const response = await authMethod();
                const tokenData = response.data;

                // Cache token
                this._accessToken = tokenData.access_token;

                // Calculate expiry time
                const expiresIn = tokenData.expires_in || 3600; // Default 1 hour
                this._tokenExpiry = new Date(Date.now() + expiresIn * 1000);

                console.log(`[OverseasLogistic] Token obtained successfully, expires at: ${this._tokenExpiry.toISOString()}`);

                return this._accessToken;
            } catch (error) {
                lastError = error;
                console.warn('[OverseasLogistic] Auth method failed:', error.message);
                // Continue to next method
            }
        }

        // All methods failed
        console.error('[OverseasLogistic] All token request methods failed');
        if (lastError?.response) {
            console.error('[OverseasLogistic] Last error response:', lastError.response.data);
        }
        throw new AppError(`Failed to obtain Overseas Logistic access token: ${lastError?.message}`, 401);
    }

    /**
     * Get headers for API requests
     * Uses Bearer token authentication
     * @returns {Promise<Object>} Headers
     */
    async getAuthHeaders() {
        const token = await this.getAccessToken();
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
    }

    /**
     * Get configured axios client with auth headers
     * Override to use async token fetching
     * @returns {Promise<Object>} Axios instance config
     */
    async getAuthenticatedClient() {
        const axios = require('axios');
        const headers = await this.getAuthHeaders();

        return axios.create({
            baseURL: this.baseURL,
            timeout: this.config.timeout,
            headers: headers
        });
    }

    /**
     * Calculate shipping rate
     * Note: Overseas Logistic may not have a separate rate API
     * This provides estimated rates based on service type
     * @param {Object} rateData - Rate calculation data
     * @returns {Promise<Object>} Rate information
     */
    async calculateRate(rateData) {
        try {
            // Overseas Logistic may not have a dedicated rate API
            // Return estimated rates based on service type and weight
            const weight = rateData.weight || 0.5;
            const serviceType = rateData.serviceType || 'UPS_SAVER';

            // Base rates per kg for different services (approximate)
            const serviceRates = {
                'UPS_SAVER': { base: 800, perKg: 400 },
                'UPS_EXPRESS': { base: 1200, perKg: 600 },
                'DHL_EXPRESS': { base: 1000, perKg: 500 },
                'FEDEX_PRIORITY': { base: 1100, perKg: 550 },
                'FEDEX_ECONOMY': { base: 700, perKg: 350 }
            };

            const rates = serviceRates[serviceType] || serviceRates['UPS_SAVER'];
            const baseRate = rates.base;
            const weightCharge = weight * rates.perKg;
            const subtotal = baseRate + weightCharge;
            const gst = subtotal * 0.18;
            const totalAmount = subtotal + gst;

            return {
                baseRate: parseFloat(baseRate.toFixed(2)),
                additionalCharges: parseFloat(weightCharge.toFixed(2)),
                gst: parseFloat(gst.toFixed(2)),
                dph: 0,
                totalAmount: parseFloat(totalAmount.toFixed(2)),
                currency: 'INR',
                estimatedDelivery: '5-7 business days',
                serviceType: serviceType,
                metadata: {
                    note: 'Estimated rate. Final rate will be confirmed on shipment creation.',
                    availableServices: Object.keys(serviceRates)
                }
            };
        } catch (error) {
            this.handleError(error, 'calculateRate');
        }
    }

    /**
     * Create shipment with Overseas Logistic
     * 
     * API: POST /api/shipment/create
     * 
     * @param {Object} shipmentData - Shipment data
     * @returns {Promise<Object>} Shipment information with AWB
     */
    async createShipment(shipmentData) {
        try {
            const client = await this.getAuthenticatedClient();

            // Get account code from env or use default
            const accountCode = process.env.OVERSEAS_LOGISTIC_ACCOUNT_CODE || 'TEST';

            // Build payload in Overseas Logistic format
            const payload = {
                AccountCode: accountCode,

                // Sender Details (Pickup)
                Sender: {
                    SenderName: shipmentData.pickup?.companyName || shipmentData.pickup?.name || '',
                    SenderContactPerson: shipmentData.pickup?.contactPerson || shipmentData.pickup?.name || '',
                    SenderAddressLine1: shipmentData.pickup?.address || shipmentData.pickup?.addressLine1 || '',
                    SenderAddressLine2: shipmentData.pickup?.addressLine2 || '',
                    SenderAddressLine3: shipmentData.pickup?.addressLine3 || '',
                    SenderPincode: shipmentData.pickup?.pincode || '',
                    SenderCity: shipmentData.pickup?.city || '',
                    SenderState: shipmentData.pickup?.state || '',
                    SenderTelephone: shipmentData.pickup?.phone || '',
                    SenderEmailId: shipmentData.pickup?.email || '',
                    KYCType: shipmentData.pickup?.kycType || 'GSTIN (Normal)',
                    KYCNo: shipmentData.pickup?.kycNo || shipmentData.pickup?.gstin || ''
                },

                // Receiver Details (Delivery)
                Receiver: {
                    ReceiverName: shipmentData.delivery?.companyName || shipmentData.delivery?.name || '',
                    ReceiverContactPerson: shipmentData.delivery?.contactPerson || shipmentData.delivery?.name || '',
                    ReceiverAddressLine1: shipmentData.delivery?.address || shipmentData.delivery?.addressLine1 || '',
                    ReceiverAddressLine2: shipmentData.delivery?.addressLine2 || '',
                    ReceiverAddressLine3: shipmentData.delivery?.addressLine3 || '',
                    ReceiverZipcode: shipmentData.delivery?.zipcode || shipmentData.delivery?.pincode || '',
                    ReceiverCity: shipmentData.delivery?.city || '',
                    ReceiverState: shipmentData.delivery?.state || '',
                    ReceiverCountry: shipmentData.delivery?.country || 'US',
                    ReceiverTelephone: shipmentData.delivery?.phone || '',
                    ReceiverEmailid: shipmentData.delivery?.email || '',
                    VatId: shipmentData.delivery?.vatId || ''
                },

                // Service Details
                ServiceDetails: {
                    Service: shipmentData.serviceType || 'UPS_SAVER',
                    GoodsType: shipmentData.goodsType || 'NDox', // NDox = Non-Documents
                    PackageType: shipmentData.packageType || 'PACKAGE'
                },

                // Package Details
                PackageDetails: {
                    PackageDetail: this._buildPackageDetails(shipmentData.package)
                },

                // Additional Details
                AdditionalDetails: {
                    ProductDetails: this._buildProductDetails(shipmentData.products || shipmentData.package?.products),
                    InvoiceCurrency: shipmentData.invoiceCurrency || 'INR',
                    InvoiceNo: shipmentData.invoiceNo || `INV-${Date.now()}`,
                    InvoiceDate: shipmentData.invoiceDate || new Date().toISOString(),
                    TermsOfSale: shipmentData.termsOfSale || 'FOB',
                    ReasonForExport: shipmentData.reasonForExport || 'SALE',
                    FreightCharge: shipmentData.freightCharge || 0,
                    InsuranceCharge: shipmentData.insuranceCharge || 0,
                    CSB_Type: shipmentData.csbType || 'CSB 4',
                    CustomerRefNo: shipmentData.orderId || `CUSTREF-${Date.now()}`,
                    DeliveryConfirmation: shipmentData.deliveryConfirmation || 'No',
                    DutyTax: shipmentData.dutyTax || 'DDU',
                    DutiesAccountNo: shipmentData.dutiesAccountNo || '',
                    TransactionId: shipmentData.transactionId || `TXN${Date.now()}`
                }
            };

            // Add shipper documents if provided
            if (shipmentData.shipperImage) {
                payload.AdditionalDetails.ShipperImage = shipmentData.shipperImage;
            }
            if (shipmentData.shipperKYC) {
                payload.AdditionalDetails.ShipperKYC = shipmentData.shipperKYC;
                payload.AdditionalDetails.FileName = shipmentData.kycFileName || 'kyc_document.pdf';
            }

            console.log('[OverseasLogistic] Creating shipment');
            console.log('[OverseasLogistic] Payload:', JSON.stringify(payload, null, 2));

            const response = await client.post('/api/shipment/create', payload);

            console.log('[OverseasLogistic] Response status:', response.status);
            console.log('[OverseasLogistic] Response data:', JSON.stringify(response.data, null, 2));

            // Parse response
            const responseData = response.data;

            // Extract AWB/tracking number from response
            // Try multiple possible field names
            const awb = responseData?.Awbno ||
                responseData?.AwbNo ||
                responseData?.awb ||
                responseData?.AWB ||
                responseData?.trackingNumber ||
                responseData?.TrackingNumber ||
                responseData?.waybill ||
                responseData?.WaybillNo ||
                null;

            const status = responseData?.Status || responseData?.status || 'created';
            const message = responseData?.Message || responseData?.message || '';

            // Check for error response
            if (status === 'Error' || status === 'error' || status === 'Failed') {
                throw new AppError(`Shipment creation failed: ${message}`, 400);
            }

            return {
                awb: awb,
                trackingNumber: awb,
                trackingUrl: awb ? `https://api.overseaslogistic.com/api/tracking/${awb}` : null,
                status: 'created',
                partnerOrderId: responseData?.OrderId || responseData?.orderId || null,
                message: message,
                metadata: responseData
            };
        } catch (error) {
            // Log detailed error information
            if (error.response) {
                console.error('[OverseasLogistic] Shipment creation error:', {
                    status: error.response.status,
                    statusText: error.response.statusText,
                    data: error.response.data
                });
            } else {
                console.error('[OverseasLogistic] Shipment creation error:', error.message);
            }

            // If API call fails in development, return mock data
            if (process.env.NODE_ENV === 'development') {
                console.warn('[OverseasLogistic] Shipment creation API unavailable, using mock data:', error.message);
                const mockAwb = `OL${Date.now()}`;
                return {
                    awb: mockAwb,
                    trackingNumber: mockAwb,
                    trackingUrl: `https://api.overseaslogistic.com/api/tracking/${mockAwb}`,
                    status: 'created',
                    metadata: { mock: true }
                };
            }

            this.handleError(error, 'createShipment');
        }
    }

    /**
     * Build package details array
     * @param {Object} packageData - Package data
     * @returns {Array} Package details array
     */
    _buildPackageDetails(packageData) {
        if (!packageData) {
            return [{
                Length: 20,
                Width: 15,
                Height: 10,
                ActualWeight: 0.5
            }];
        }

        // If multiple packages
        if (Array.isArray(packageData.packages)) {
            return packageData.packages.map(pkg => ({
                Length: pkg.length || pkg.dimensions?.length || 20,
                Width: pkg.width || pkg.dimensions?.width || 15,
                Height: pkg.height || pkg.dimensions?.height || 10,
                ActualWeight: pkg.weight || 0.5
            }));
        }

        // Single package
        return [{
            Length: packageData.dimensions?.length || packageData.length || 20,
            Width: packageData.dimensions?.width || packageData.width || 15,
            Height: packageData.dimensions?.height || packageData.height || 10,
            ActualWeight: packageData.weight || 0.5
        }];
    }

    /**
     * Build product details array
     * @param {Array} products - Products array
     * @returns {Array} Product details array
     */
    _buildProductDetails(products) {
        if (!products || !Array.isArray(products) || products.length === 0) {
            // Default product details if not provided
            return [{
                BoxNo: '1',
                Description: 'General Merchandise',
                HSNCode: '99999999',
                HTSCode: '9999999999',
                UnitType: 'PCS',
                Qty: 1,
                UnitRate: 100.00,
                ShipPieceIGST: 0.00,
                PieceWt: 0.5
            }];
        }

        return products.map((product, index) => ({
            BoxNo: product.boxNo || String(index + 1),
            Description: product.description || product.name || 'Product',
            HSNCode: product.hsnCode || product.hsn || '',
            HTSCode: product.htsCode || product.hts || '',
            UnitType: product.unitType || product.unit || 'PCS',
            Qty: product.qty || product.quantity || 1,
            UnitRate: product.unitRate || product.price || product.value || 0,
            ShipPieceIGST: product.igst || 0,
            PieceWt: product.weight || product.pieceWeight || 0.1
        }));
    }

    /**
     * Track shipment by AWB
     * 
     * API: GET /api/tracking/{AwbNo}
     * 
     * @param {String} trackingNumber - AWB number
     * @returns {Promise<Object>} Tracking information
     */
    async trackShipment(trackingNumber) {
        try {
            const client = await this.getAuthenticatedClient();

            console.log(`[OverseasLogistic] Tracking shipment: ${trackingNumber}`);

            const response = await client.get(`/api/tracking/${trackingNumber}`);

            console.log('[OverseasLogistic] Tracking response:', JSON.stringify(response.data, null, 2));

            const trackingData = response.data;

            // Check if successful
            if (trackingData?.Status === false || trackingData?.status === 'error') {
                throw new AppError(trackingData?.Message || 'Tracking failed', 404);
            }

            // Extract tracking information
            // Based on API response structure from documentation
            const shipmentInfo = trackingData?.ShipmentInfo || trackingData;

            return {
                awb: trackingNumber,
                status: this.mapStatus(shipmentInfo?.Status || shipmentInfo?.EventCode),
                currentLocation: shipmentInfo?.Location || shipmentInfo?.Destination || null,
                consignee: shipmentInfo?.Consignee || null,
                destination: shipmentInfo?.Destination || null,
                forwarder: shipmentInfo?.Forwarder || null,
                forwardingNo: shipmentInfo?.ForwardingNo || null,
                eventDate: shipmentInfo?.EventDate || null,
                eventTime: shipmentInfo?.EventTime || null,
                history: this._parseTrackingEvents(shipmentInfo?.Events || trackingData?.Events || []),
                expectedDelivery: shipmentInfo?.ExpectedDelivery || null,
                trackingUrl: `https://api.overseaslogistic.com/api/tracking/${trackingNumber}`,
                metadata: trackingData
            };
        } catch (error) {
            if (process.env.NODE_ENV === 'development') {
                console.warn('[OverseasLogistic] Tracking API unavailable, using mock data:', error.message);
                return {
                    awb: trackingNumber,
                    status: ORDER_STATUS.IN_TRANSIT,
                    history: [{ status: 'Mock Data - In Transit', timestamp: new Date().toISOString() }],
                    trackingUrl: `https://api.overseaslogistic.com/api/tracking/${trackingNumber}`,
                    metadata: { mock: true }
                };
            }
            this.handleError(error, 'trackShipment');
        }
    }

    /**
     * Parse tracking events into standardized format
     * @param {Array} events - Raw events from API
     * @returns {Array} Parsed events
     */
    _parseTrackingEvents(events) {
        if (!Array.isArray(events)) return [];

        return events.map(event => ({
            date: event.EventDate || event.Date || null,
            time: event.EventTime || event.Time || null,
            timestamp: event.EventDate && event.EventTime
                ? `${event.EventDate}T${event.EventTime}`
                : event.Timestamp || null,
            status: event.EventCode || event.Status || event.Code || '',
            description: event.EventDescription || event.Description || '',
            location: event.Location || '',
            receiverName: event.ReceiverName || null
        }));
    }

    /**
     * Map Overseas Logistic status to our internal status
     * @param {String} providerStatus - Provider status string
     * @returns {String} Internal status
     */
    mapStatus(providerStatus) {
        if (!providerStatus) return ORDER_STATUS.PENDING;

        const statusMap = {
            // Common shipment statuses
            'PKL': ORDER_STATUS.PICKED_UP,
            'PKD': ORDER_STATUS.PICKED_UP,
            'Picked Up': ORDER_STATUS.PICKED_UP,
            'PICKUP': ORDER_STATUS.PICKED_UP,

            'IN_TRANSIT': ORDER_STATUS.IN_TRANSIT,
            'In Transit': ORDER_STATUS.IN_TRANSIT,
            'TRANSIT': ORDER_STATUS.IN_TRANSIT,
            'DEP': ORDER_STATUS.IN_TRANSIT,
            'ARR': ORDER_STATUS.IN_TRANSIT,

            'OUT': ORDER_STATUS.OUT_FOR_DELIVERY,
            'OFD': ORDER_STATUS.OUT_FOR_DELIVERY,
            'Out for Delivery': ORDER_STATUS.OUT_FOR_DELIVERY,

            'DLV': ORDER_STATUS.DELIVERED,
            'DELIVERED': ORDER_STATUS.DELIVERED,
            'Delivered': ORDER_STATUS.DELIVERED,
            'POD': ORDER_STATUS.DELIVERED,

            'RTO': ORDER_STATUS.RTO,
            'RETURN': ORDER_STATUS.RTO,
            'Returned': ORDER_STATUS.RTO,

            'CANCELLED': ORDER_STATUS.CANCELLED,
            'Cancelled': ORDER_STATUS.CANCELLED,
            'CANCEL': ORDER_STATUS.CANCELLED,

            'PENDING': ORDER_STATUS.PENDING,
            'Pending': ORDER_STATUS.PENDING,
            'MANIFESTED': ORDER_STATUS.CONFIRMED,
            'Manifested': ORDER_STATUS.CONFIRMED,
            'BOOKED': ORDER_STATUS.CONFIRMED
        };

        // Normalize status string
        const normalizedStatus = providerStatus.trim();

        // Check direct mapping
        if (statusMap[normalizedStatus]) {
            return statusMap[normalizedStatus];
        }

        // Check case-insensitive match
        const upperStatus = normalizedStatus.toUpperCase();
        for (const [key, value] of Object.entries(statusMap)) {
            if (key.toUpperCase() === upperStatus) {
                return value;
            }
        }

        // Check if status contains keywords
        const lowerStatus = normalizedStatus.toLowerCase();
        if (lowerStatus.includes('deliver')) return ORDER_STATUS.DELIVERED;
        if (lowerStatus.includes('transit')) return ORDER_STATUS.IN_TRANSIT;
        if (lowerStatus.includes('pickup') || lowerStatus.includes('pick')) return ORDER_STATUS.PICKED_UP;
        if (lowerStatus.includes('out for')) return ORDER_STATUS.OUT_FOR_DELIVERY;
        if (lowerStatus.includes('return') || lowerStatus.includes('rto')) return ORDER_STATUS.RTO;

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
        const baseRate = 800 + (weight * 400);
        const gst = baseRate * 0.18;
        const totalAmount = baseRate + gst;

        return {
            baseRate: parseFloat(baseRate.toFixed(2)),
            additionalCharges: 0,
            gst: parseFloat(gst.toFixed(2)),
            dph: 0,
            totalAmount: parseFloat(totalAmount.toFixed(2)),
            currency: 'INR',
            estimatedDelivery: '5-7 business days',
            serviceType: rateData.serviceType || 'UPS_SAVER',
            metadata: { mock: true }
        };
    }
}

module.exports = OverseasLogisticProvider;
