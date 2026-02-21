const awbService = require('../services/awb.service');
const { successResponse } = require('../utils/responseHandler');
const AppError = require('../utils/AppError');

/**
 * AWB Controller - Handles AWB number fetching
 */
class AWBController {
  /**
   * Fetch AWB numbers from delivery partner
   */
  async fetchAWBNumbers(req, res, next) {
    try {
      const userId = req.user._id;
      const { count, deliveryPartner } = req.body;

      // Validate count
      if (!count || count < 1 || count > 50) {
        throw new AppError('Please provide a valid count between 1 and 50', 400);
      }

      const awbNumbers = await awbService.fetchAWBNumbers(
        userId,
        parseInt(count),
        deliveryPartner || 'nimbuspost'
      );

      return successResponse(
        res,
        { awbNumbers, count: awbNumbers.length },
        'AWB numbers fetched successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Download AWB numbers as CSV
   */
  async downloadAWBCSV(req, res, next) {
    try {
      const userId = req.user._id;
      const { count, deliveryPartner } = req.query;

      // Validate count
      if (!count || count < 1 || count > 50) {
        throw new AppError('Please provide a valid count between 1 and 50', 400);
      }

      const csvData = await awbService.generateAWBCSV(
        userId,
        parseInt(count),
        deliveryPartner || 'nimbuspost'
      );

      // Set headers for CSV download
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=awb-numbers-${Date.now()}.csv`);
      
      return res.send(csvData);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AWBController();
