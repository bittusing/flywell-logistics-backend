/**
 * Application Constants
 */

// HTTP Status Codes
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500
};

// Order Types (Domestic vs International)
const ORDER_TYPES = {
  DOMESTIC: 'domestic',
  INTERNATIONAL: 'international'
};

// User Roles
const USER_ROLES = {
  USER: 'user',
  ADMIN: 'admin'
};

// Order Status
const ORDER_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  PICKED_UP: 'picked_up',
  IN_TRANSIT: 'in_transit',
  OUT_FOR_DELIVERY: 'out_for_delivery',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  RTO: 'rto'
};

// Delivery Partners
const DELIVERY_PARTNERS = {
  NIMBUSPOST: 'nimbuspost',
  // DELHIVERY: 'delhivery',
  // FEDEX: 'fedex',
  // BLUE_DART: 'blue_dart',
  // BLUEDART: 'bluedart',
  OVERSEAS_LOGISTIC: 'overseas_logistic'
};

// Transaction Types
const TRANSACTION_TYPES = {
  CREDIT: 'credit',
  DEBIT: 'debit'
};

module.exports = {
  HTTP_STATUS,
  ORDER_TYPES,
  USER_ROLES,
  ORDER_STATUS,
  DELIVERY_PARTNERS,
  TRANSACTION_TYPES
};
