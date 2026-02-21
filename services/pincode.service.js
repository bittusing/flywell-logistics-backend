const Pincode = require('../models/Pincode.model');
const AppError = require('../utils/AppError');
const csv = require('csv-parser');
const fs = require('fs');
const { parse } = require('json2csv');

/**
 * Pincode Service - Business logic for pincode serviceability
 */
class PincodeService {
  /**
   * Check if pincode is serviceable
   */
  async checkServiceability(pincode) {
    const pincodeData = await Pincode.findOne({ pincode: pincode.toString() });

    if (!pincodeData) {
      return {
        serviceable: false,
        message: 'Pincode not serviceable',
        pincode: pincode
      };
    }

    return {
      serviceable: pincodeData.isServiceable,
      message: pincodeData.isServiceable ? 'Delivery available' : 'Delivery not available',
      pincode: pincodeData.pincode,
      city: pincodeData.city,
      state: pincodeData.state_code,
      cod: pincodeData.cod === 'Y',
      prepaid: pincodeData.prepaid === 'Y',
      pickup: pincodeData.pickup === 'Y',
      zone: pincodeData.zone
    };
  }

  /**
   * Upload pincodes from CSV
   */
  async uploadPincodes(filePath) {
    const pincodes = [];
    
    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          pincodes.push({
            pincode: row.pincode?.toString().trim(),
            city: row.city?.trim() || '',
            state_code: row.state_code?.trim() || '',
            cod: row.cod?.toUpperCase() === 'Y' ? 'Y' : 'N',
            prepaid: row.prepaid?.toUpperCase() === 'Y' ? 'Y' : 'N',
            pickup: row.pickup?.toUpperCase() === 'Y' ? 'Y' : 'N',
            zone: row.zone?.trim() || '',
            isServiceable: true
          });
        })
        .on('end', async () => {
          try {
            // Delete existing pincodes
            await Pincode.deleteMany({});
            
            // Insert new pincodes in batches
            const batchSize = 1000;
            for (let i = 0; i < pincodes.length; i += batchSize) {
              const batch = pincodes.slice(i, i + batchSize);
              await Pincode.insertMany(batch, { ordered: false });
            }

            // Delete uploaded file
            fs.unlinkSync(filePath);

            resolve({
              success: true,
              count: pincodes.length,
              message: `${pincodes.length} pincodes uploaded successfully`
            });
          } catch (error) {
            reject(error);
          }
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }

  /**
   * Export pincodes to CSV
   */
  async exportPincodes() {
    const pincodes = await Pincode.find({}).select('-_id -__v -createdAt -updatedAt -isServiceable').lean();

    if (pincodes.length === 0) {
      throw new AppError('No pincodes available to export', 404);
    }

    // Convert to CSV format
    const fields = ['pincode', 'city', 'state_code', 'cod', 'prepaid', 'pickup', 'zone'];
    const csv = parse(pincodes, { fields });

    return csv;
  }

  /**
   * Get all pincodes with pagination
   */
  async getAllPincodes({ page = 1, limit = 50, search = '' }) {
    const query = {};

    if (search) {
      query.$or = [
        { pincode: { $regex: search, $options: 'i' } },
        { city: { $regex: search, $options: 'i' } },
        { state_code: { $regex: search, $options: 'i' } }
      ];
    }

    const [pincodes, total] = await Promise.all([
      Pincode.find(query)
        .select('-__v')
        .sort({ pincode: 1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Pincode.countDocuments(query)
    ]);

    return {
      pincodes,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get pincode statistics
   */
  async getStatistics() {
    const [total, codEnabled, prepaidEnabled, pickupEnabled] = await Promise.all([
      Pincode.countDocuments(),
      Pincode.countDocuments({ cod: 'Y' }),
      Pincode.countDocuments({ prepaid: 'Y' }),
      Pincode.countDocuments({ pickup: 'Y' })
    ]);

    return {
      total,
      codEnabled,
      prepaidEnabled,
      pickupEnabled
    };
  }
}

module.exports = new PincodeService();
