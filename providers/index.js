/**
 * Provider Registry
 * 
 * This file registers all delivery partner providers.
 * To add a new provider:
 * 1. Create provider class in providers/{providerName}.provider.js
 * 2. Import and register here
 * 3. Export in the PROVIDERS object
 */

const DelhiveryProvider = require('./delhivery.provider');
// const BlueDartProvider = require('./bluedart.provider');
// const FedexProvider = require('./fedex.provider');

/**
 * Provider Registry
 * Maps partner names to their provider instances
 */
const PROVIDERS = {
  delhivery: new DelhiveryProvider(),
  // blue_dart: new BlueDartProvider(),
  // bluedart: new BlueDartProvider(),
  // fedex: new FedexProvider()
};

/**
 * Get provider instance by name
 * @param {String} partnerName - Partner name (e.g., 'delhivery', 'blue_dart')
 * @returns {Object} Provider instance
 * @throws {Error} If provider not found
 */
function getProvider(partnerName) {
  const provider = PROVIDERS[partnerName];
  
  if (!provider) {
    const availableProviders = Object.keys(PROVIDERS).join(', ');
    throw new Error(
      `Provider '${partnerName}' not found. Available providers: ${availableProviders}`
    );
  }
  
  return provider;
}

/**
 * Check if provider exists
 * @param {String} partnerName - Partner name
 * @returns {Boolean} True if provider exists
 */
function hasProvider(partnerName) {
  return !!PROVIDERS[partnerName];
}

/**
 * Get all registered providers
 * @returns {Array} Array of provider names
 */
function getAllProviders() {
  return Object.keys(PROVIDERS);
}

module.exports = {
  PROVIDERS,
  getProvider,
  hasProvider,
  getAllProviders
};
