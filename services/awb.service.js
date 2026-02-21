const AppError = require('../utils/AppError');
const nimbuspostProvider = require('../providers/nimbuspost.provider');
const delhiveryProvider = require('../providers/delhivery.provider');

/**
 * AWB Service - Handles AWB number generation and management
 */
class AWBService {
  /**
   * Fetch AWB numbers from delivery partner
   * @param {String} userId - User ID
   * @param {Number} count - Number of AWBs to fetch
   * @param {String} deliveryPartner - Delivery partner name
   * @returns {Array} AWB numbers
   */
  async fetchAWBNumbers(userId, count, deliveryPartner = 'nimbuspost') {
    try {
      let awbNumbers = [];

      switch (deliveryPartner.toLowerCase()) {
        case 'nimbuspost':
          awbNumbers = await this.fetchFromNimbuspost(count);
          break;
        
        case 'delhivery':
          awbNumbers = await this.fetchFromDelhivery(count);
          break;
        
        default:
          throw new AppError(`Unsupported delivery partner: ${deliveryPartner}`, 400);
      }

      return awbNumbers;
    } catch (error) {
      console.error('Error fetching AWB numbers:', error);
      throw new AppError(
        error.message || 'Failed to fetch AWB numbers from delivery partner',
        error.statusCode || 500
      );
    }
  }

  /**
   * Fetch AWB numbers from Nimbuspost
   */
  async fetchFromNimbuspost(count) {
    try {
      // Use the provider's fetchAWBNumbers method
      const awbNumbers = await nimbuspostProvider.fetchAWBNumbers(count);

      // Transform response to standard format
      return awbNumbers.map(awb => ({
        awb: typeof awb === 'string' ? awb : awb.awb_number || awb.awb,
        deliveryPartner: 'nimbuspost',
        generatedAt: new Date()
      }));
    } catch (error) {
      console.error('Nimbuspost AWB fetch error:', error);
      throw error;
    }
  }

  /**
   * Fetch AWB numbers from Delhivery
   */
  async fetchFromDelhivery(count) {
    try {
      // Delhivery AWB generation
      // Note: Delhivery typically generates AWB during shipment creation
      // This is a placeholder - adjust based on actual Delhivery API
      const awbNumbers = [];
      
      for (let i = 0; i < count; i++) {
        // Generate placeholder AWB (in production, call Delhivery API)
        awbNumbers.push({
          awb: `DLV${Date.now()}${i}`,
          deliveryPartner: 'delhivery',
          generatedAt: new Date()
        });
      }

      return awbNumbers;
    } catch (error) {
      console.error('Delhivery AWB fetch error:', error);
      throw error;
    }
  }

  /**
   * Generate CSV file with AWB numbers
   * @param {String} userId - User ID
   * @param {Number} count - Number of AWBs
   * @param {String} deliveryPartner - Delivery partner
   * @returns {String} CSV content
   */
  async generateAWBCSV(userId, count, deliveryPartner) {
    const awbNumbers = await this.fetchAWBNumbers(userId, count, deliveryPartner);

    // CSV Header
    let csv = 'AWB Number,Delivery Partner,Generated At\n';

    // CSV Rows
    awbNumbers.forEach(item => {
      csv += `${item.awb},${item.deliveryPartner},${item.generatedAt.toISOString()}\n`;
    });

    return csv;
  }
}

module.exports = new AWBService();
