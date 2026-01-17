const Order = require('../models/Order.model');
const AppError = require('../utils/AppError');
const { ORDER_STATUS } = require('../config/constants');

/**
 * Invoice Service - Handles invoice generation and management
 */
class InvoiceService {
  /**
   * Generate invoices from orders
   * @param {String} userId - User ID
   * @param {Object} filters - Filter options
   * @returns {Array} Invoice list
   */
  async getInvoices(userId, filters = {}) {
    const query = { 
      user: userId,
      'payment.status': 'completed'
    };

    // Date range filter
    if (filters.startDate || filters.endDate) {
      query['payment.paidAt'] = {};
      if (filters.startDate) {
        query['payment.paidAt'].$gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        query['payment.paidAt'].$lte = new Date(filters.endDate);
      }
    }

    // Search by invoice ID (order number or AWB)
    if (filters.search) {
      query.$or = [
        { orderNumber: { $regex: filters.search, $options: 'i' } },
        { awb: { $regex: filters.search, $options: 'i' } }
      ];
    }

    const limit = parseInt(filters.limit) || 50;
    const skip = parseInt(filters.skip) || 0;

    const orders = await Order.find(query)
      .sort({ 'payment.paidAt': -1 })
      .limit(limit)
      .skip(skip);

    // Generate invoices from orders
    const invoices = orders.map(order => ({
      invoiceId: `INV${order.orderNumber}`,
      orderNumber: order.orderNumber,
      awb: order.awb,
      invoiceDate: order.payment.paidAt || order.createdAt,
      gstNumber: '07KVFPS0396D1Z8', // This should come from user/company profile
      serviceType: 'Domestic',
      invoiceAmount: order.pricing.totalAmount,
      currency: order.pricing.currency || 'INR',
      orderDetails: {
        pickup: order.pickupDetails,
        delivery: order.deliveryDetails,
        deliveryPartner: order.deliveryPartner
      },
      orderId: order._id
    }));

    return invoices;
  }

  /**
   * Get invoice by ID
   * @param {String} invoiceId - Invoice ID
   * @param {String} userId - User ID
   * @returns {Object} Invoice details
   */
  async getInvoiceById(invoiceId, userId) {
    // Extract order number from invoice ID (INV{orderNumber})
    const orderNumber = invoiceId.replace(/^INV/, '');
    
    const order = await Order.findOne({ 
      orderNumber, 
      user: userId,
      'payment.status': 'completed'
    });

    if (!order) {
      throw new AppError('Invoice not found', 404);
    }

    return {
      invoiceId: `INV${order.orderNumber}`,
      orderNumber: order.orderNumber,
      awb: order.awb,
      invoiceDate: order.payment.paidAt || order.createdAt,
      gstNumber: '07KVFPS0396D1Z8',
      serviceType: 'Domestic',
      invoiceAmount: order.pricing.totalAmount,
      currency: order.pricing.currency || 'INR',
      orderDetails: {
        pickup: order.pickupDetails,
        delivery: order.deliveryDetails,
        deliveryPartner: order.deliveryPartner,
        package: order.packageDetails
      },
      pricing: order.pricing,
      orderId: order._id
    };
  }
}

module.exports = new InvoiceService();
