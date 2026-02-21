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
      user: userId
      // Removed payment.status filter to show all orders
      // Users can see which orders have invoices and which don't
    };

    console.log('Invoice Query:', JSON.stringify(query, null, 2));
    console.log('Filters:', JSON.stringify(filters, null, 2));

    // Date range filter - use createdAt if paidAt is not available
    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) {
        query.createdAt.$gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        query.createdAt.$lte = new Date(filters.endDate);
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
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    console.log(`Found ${orders.length} orders`);

    // Generate invoices from orders
    const invoices = orders
      .filter(order => order.payment.status === 'completed') // Only show completed payments as invoices
      .map(order => ({
        invoiceId: `INV${order.orderNumber}`,
        orderNumber: order.orderNumber,
        awb: order.awb,
        invoiceDate: order.payment.paidAt || order.createdAt,
        gstNumber: '07KVFPS0396D1Z8', // This should come from user/company profile
        serviceType: order.orderType === 'international' ? 'International' : 'Domestic',
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
      serviceType: order.orderType === 'international' ? 'International' : 'Domestic',
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
