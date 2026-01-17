/**
 * Controllers Index
 * Central export point for all controllers
 */

const authController = require('./auth.controller');
const walletController = require('./wallet.controller');
const orderController = require('./order.controller');

module.exports = {
  authController,
  walletController,
  orderController
};
