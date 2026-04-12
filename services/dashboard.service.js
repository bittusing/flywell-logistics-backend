const Order = require('../models/Order.model');
const { ORDER_STATUS } = require('../config/constants');

/**
 * Dashboard Service - Handles dashboard statistics and data
 */
class DashboardService {
  /**
   * Get dashboard statistics
   * @param {String} userId - User ID
   * @param {String} orderType - domestic or international
   * @returns {Object} Dashboard statistics
   */
  async getStats(userId, orderType = 'domestic') {
    const orders = await Order.find({ user: userId, orderType });

    // Calculate statistics
    const totalShipments = orders.length;
    const deliveredShipments = orders.filter(o => o.status === ORDER_STATUS.DELIVERED).length;
    const deliveredPercentage = totalShipments > 0
      ? ((deliveredShipments / totalShipments) * 100).toFixed(0)
      : 0;

    // Calculate total revenue from delivered orders
    const totalRevenue = orders
      .filter(o => o.status === ORDER_STATUS.DELIVERED)
      .reduce((sum, o) => sum + (o.pricing?.totalAmount || 0), 0);

    // RTO (Return to Origin) orders
    const rtoOrders = orders.filter(o => o.status === ORDER_STATUS.RTO).length;
    const rtoPercentage = totalShipments > 0
      ? ((rtoOrders / totalShipments) * 100).toFixed(0)
      : 0;

    return {
      totalShipments,
      deliveredShipments,
      deliveredPercentage,
      totalRevenue,
      rtoOrders,
      rtoPercentage
    };
  }

  /**
   * Get upcoming pickups
   * @param {String} userId - User ID
   * @param {Number} limit - Number of pickups to return
   * @param {String} orderType - domestic or international
   * @returns {Array} Upcoming pickups
   */
  async getUpcomingPickups(userId, limit = 10, orderType = 'domestic') {
    const pickups = await Order.find({
      user: userId,
      orderType,
      status: { $in: [ORDER_STATUS.PENDING, ORDER_STATUS.CONFIRMED] }
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('orderNumber awb pickupDetails deliveryDetails status createdAt');

    return pickups.map(order => ({
      orderNumber: order.orderNumber,
      awb: order.awb || 'Not generated',
      pickup: {
        address: `${order.pickupDetails.city}, ${order.pickupDetails.state}`,
        pincode: order.pickupDetails.pincode
      },
      delivery: {
        address: `${order.deliveryDetails.city}, ${order.deliveryDetails.state}`,
        pincode: order.deliveryDetails.pincode
      },
      status: order.status,
      date: order.createdAt
    }));
  }

  /**
   * Get performance graph data
   * @param {String} userId - User ID
   * @param {Number} period - Number of days
   * @param {String} orderType - domestic or international
   * @returns {Array} Performance data points
   */
  async getPerformanceData(userId, period = 14, orderType = 'domestic') {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period);

    // Get orders in the date range
    const orders = await Order.find({
      user: userId,
      orderType,
      createdAt: { $gte: startDate, $lte: endDate }
    });

    // Group by date
    const dataMap = {};
    const dates = [];

    for (let i = period - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      dates.push(dateStr);
      dataMap[dateStr] = 0;
    }

    // Count orders per day
    orders.forEach(order => {
      const dateStr = new Date(order.createdAt).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short'
      });
      if (dataMap[dateStr] !== undefined) {
        dataMap[dateStr]++;
      }
    });

    // Convert to array format
    const data = dates.map(date => ({
      name: date,
      value: dataMap[date] || 0
    }));

    return data;
  }
}

module.exports = new DashboardService();
