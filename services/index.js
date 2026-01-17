/**
 * Services Index
 * Central export point for all services
 */

const authService = require('./auth.service');
const walletService = require('./wallet.service');
const paymentService = require('./payment.service');
const orderService = require('./order.service');
const thirdPartyAPIService = require('./thirdPartyAPI.service');

module.exports = {
  authService,
  walletService,
  paymentService,
  orderService,
  thirdPartyAPIService
};
