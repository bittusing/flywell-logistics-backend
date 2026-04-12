const invoiceService = require('../services/invoice.service');
const { successResponse } = require('../utils/responseHandler');
const AppError = require('../utils/AppError');

/**
 * Invoice Controller
 */
class InvoiceController {
  /**
   * Get user invoices
   */
  async getInvoices(req, res, next) {
    try {
      const userId = req.user._id;
      const filters = {
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        search: req.query.search,
        limit: req.query.limit,
        skip: req.query.skip
      };

      const invoices = await invoiceService.getInvoices(userId, filters);

      return successResponse(res, { invoices }, 'Invoices retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get invoice by ID
   */
  async getInvoiceById(req, res, next) {
    try {
      const userId = req.user._id;
      const { id } = req.params;

      const invoice = await invoiceService.getInvoiceById(id, userId);

      return successResponse(res, { invoice }, 'Invoice retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Download invoice PDF
   */
  async downloadInvoice(req, res, next) {
    try {
      const userId = req.user._id;
      const { id } = req.params;

      const invoice = await invoiceService.getInvoiceById(id, userId);

      // TODO: Generate PDF and return
      // For now, return invoice data as JSON
      return successResponse(res, { invoice }, 'Invoice data retrieved');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new InvoiceController();
