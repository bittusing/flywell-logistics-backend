const Order = require('../models/Order.model');
const User = require('../models/User.model');
const Payment = require('../models/Payment.model');
const SupportTicket = require('../models/SupportTicket.model');
const Wallet = require('../models/Wallet.model');

/**
 * Reports Service - Generates various reports
 */
class ReportsService {
  /**
   * Generate Orders Report CSV
   */
  async generateOrdersReport(startDate, endDate) {
    const orders = await Order.find({
      createdAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    })
    .populate('user', 'name email phone')
    .sort({ createdAt: -1 });

    // CSV Header
    let csv = 'Order Number,User Name,User Email,User Phone,AWB,Delivery Partner,Status,Order Type,';
    csv += 'Pickup City,Pickup Pincode,Delivery City,Delivery Pincode,';
    csv += 'Weight (kg),Amount (₹),Payment Status,Created At,Updated At\n';

    // CSV Rows
    orders.forEach(order => {
      csv += `${order.orderNumber},`;
      csv += `${order.user?.name || 'N/A'},`;
      csv += `${order.user?.email || 'N/A'},`;
      csv += `${order.user?.phone || 'N/A'},`;
      csv += `${order.awb || 'N/A'},`;
      csv += `${order.deliveryPartner},`;
      csv += `${order.status},`;
      csv += `${order.orderType},`;
      csv += `${order.pickupDetails?.city || 'N/A'},`;
      csv += `${order.pickupDetails?.pincode || 'N/A'},`;
      csv += `${order.deliveryDetails?.city || 'N/A'},`;
      csv += `${order.deliveryDetails?.pincode || 'N/A'},`;
      csv += `${order.packageDetails?.weight || 0},`;
      csv += `${order.pricing?.totalAmount || 0},`;
      csv += `${order.payment?.status || 'N/A'},`;
      csv += `${order.createdAt.toISOString()},`;
      csv += `${order.updatedAt.toISOString()}\n`;
    });

    return csv;
  }

  /**
   * Generate Revenue Report CSV
   */
  async generateRevenueReport(startDate, endDate) {
    const payments = await Payment.find({
      createdAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    })
    .populate('user', 'name email')
    .sort({ createdAt: -1 });

    // CSV Header
    let csv = 'Transaction ID,User Name,User Email,Type,Amount (₹),Status,Method,';
    csv += 'Description,Created At\n';

    // CSV Rows
    payments.forEach(payment => {
      csv += `${payment.transactionId || 'N/A'},`;
      csv += `${payment.user?.name || 'N/A'},`;
      csv += `${payment.user?.email || 'N/A'},`;
      csv += `${payment.type},`;
      csv += `${payment.amount},`;
      csv += `${payment.status},`;
      csv += `${payment.method || 'N/A'},`;
      csv += `"${payment.description || 'N/A'}",`;
      csv += `${payment.createdAt.toISOString()}\n`;
    });

    // Add summary
    const totalRevenue = payments
      .filter(p => p.status === 'completed' && p.type === 'credit')
      .reduce((sum, p) => sum + p.amount, 0);
    
    const totalRefunds = payments
      .filter(p => p.status === 'completed' && p.type === 'debit')
      .reduce((sum, p) => sum + p.amount, 0);

    csv += '\n\nSummary\n';
    csv += `Total Revenue,${totalRevenue}\n`;
    csv += `Total Refunds,${totalRefunds}\n`;
    csv += `Net Revenue,${totalRevenue - totalRefunds}\n`;

    return csv;
  }

  /**
   * Generate Users Report CSV
   */
  async generateUsersReport(startDate, endDate) {
    const users = await User.find({
      createdAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    }).sort({ createdAt: -1 });

    // CSV Header
    let csv = 'User ID,Name,Email,Phone,Role,KYC Status,Email Verified,';
    csv += 'Wallet Balance (₹),Total Orders,Registered At\n';

    // CSV Rows
    for (const user of users) {
      // Get wallet balance
      const wallet = await Wallet.findOne({ user: user._id });
      
      // Get order count
      const orderCount = await Order.countDocuments({ user: user._id });

      csv += `${user._id},`;
      csv += `${user.name},`;
      csv += `${user.email},`;
      csv += `${user.phone || 'N/A'},`;
      csv += `${user.role},`;
      csv += `${user.kycStatus || 'not_submitted'},`;
      csv += `${user.isEmailVerified ? 'Yes' : 'No'},`;
      csv += `${wallet?.balance || 0},`;
      csv += `${orderCount},`;
      csv += `${user.createdAt.toISOString()}\n`;
    }

    return csv;
  }

  /**
   * Generate Support Tickets Report CSV
   */
  async generateSupportReport(startDate, endDate) {
    const tickets = await SupportTicket.find({
      createdAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    })
    .populate('user', 'name email phone')
    .sort({ createdAt: -1 });

    // CSV Header
    let csv = 'Ticket ID,User Name,User Email,Subject,Category,Priority,Status,';
    csv += 'Created At,Updated At,Resolution Time (hours)\n';

    // CSV Rows
    tickets.forEach(ticket => {
      const resolutionTime = ticket.status === 'resolved' && ticket.updatedAt
        ? Math.round((ticket.updatedAt - ticket.createdAt) / (1000 * 60 * 60))
        : 'N/A';

      csv += `${ticket.ticketId || ticket._id},`;
      csv += `${ticket.user?.name || 'N/A'},`;
      csv += `${ticket.user?.email || 'N/A'},`;
      csv += `"${ticket.subject}",`;
      csv += `${ticket.category},`;
      csv += `${ticket.priority},`;
      csv += `${ticket.status},`;
      csv += `${ticket.createdAt.toISOString()},`;
      csv += `${ticket.updatedAt.toISOString()},`;
      csv += `${resolutionTime}\n`;
    });

    // Add summary
    const totalTickets = tickets.length;
    const resolvedTickets = tickets.filter(t => t.status === 'resolved').length;
    const pendingTickets = tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length;

    csv += '\n\nSummary\n';
    csv += `Total Tickets,${totalTickets}\n`;
    csv += `Resolved Tickets,${resolvedTickets}\n`;
    csv += `Pending Tickets,${pendingTickets}\n`;
    csv += `Resolution Rate,${totalTickets > 0 ? ((resolvedTickets / totalTickets) * 100).toFixed(2) : 0}%\n`;

    return csv;
  }

  /**
   * Generate Performance Report CSV
   */
  async generatePerformanceReport(startDate, endDate) {
    const orders = await Order.find({
      createdAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    });

    // Group by delivery partner
    const partnerStats = {};

    orders.forEach(order => {
      const partner = order.deliveryPartner;
      
      if (!partnerStats[partner]) {
        partnerStats[partner] = {
          total: 0,
          delivered: 0,
          pending: 0,
          cancelled: 0,
          rto: 0,
          totalRevenue: 0
        };
      }

      partnerStats[partner].total++;
      partnerStats[partner].totalRevenue += order.pricing?.totalAmount || 0;

      if (order.status === 'delivered') partnerStats[partner].delivered++;
      else if (order.status === 'pending' || order.status === 'confirmed') partnerStats[partner].pending++;
      else if (order.status === 'cancelled') partnerStats[partner].cancelled++;
      else if (order.status === 'rto') partnerStats[partner].rto++;
    });

    // CSV Header
    let csv = 'Delivery Partner,Total Orders,Delivered,Pending,Cancelled,RTO,';
    csv += 'Delivery Rate (%),Total Revenue (₹),Avg Order Value (₹)\n';

    // CSV Rows
    Object.entries(partnerStats).forEach(([partner, stats]) => {
      const deliveryRate = stats.total > 0 ? ((stats.delivered / stats.total) * 100).toFixed(2) : 0;
      const avgOrderValue = stats.total > 0 ? (stats.totalRevenue / stats.total).toFixed(2) : 0;

      csv += `${partner},`;
      csv += `${stats.total},`;
      csv += `${stats.delivered},`;
      csv += `${stats.pending},`;
      csv += `${stats.cancelled},`;
      csv += `${stats.rto},`;
      csv += `${deliveryRate},`;
      csv += `${stats.totalRevenue.toFixed(2)},`;
      csv += `${avgOrderValue}\n`;
    });

    return csv;
  }

  /**
   * Generate Analytics Report CSV
   */
  async generateAnalyticsReport(startDate, endDate) {
    const orders = await Order.find({
      createdAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    });

    const users = await User.find({
      createdAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    });

    const payments = await Payment.find({
      createdAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      },
      status: 'completed'
    });

    // Calculate metrics
    const totalOrders = orders.length;
    const totalUsers = users.length;
    const totalRevenue = payments
      .filter(p => p.type === 'credit')
      .reduce((sum, p) => sum + p.amount, 0);
    
    const deliveredOrders = orders.filter(o => o.status === 'delivered').length;
    const deliveryRate = totalOrders > 0 ? ((deliveredOrders / totalOrders) * 100).toFixed(2) : 0;
    
    const avgOrderValue = totalOrders > 0 ? (totalRevenue / totalOrders).toFixed(2) : 0;

    // CSV
    let csv = 'Metric,Value\n';
    csv += `Date Range,"${startDate} to ${endDate}"\n`;
    csv += `Total Orders,${totalOrders}\n`;
    csv += `Total Users,${totalUsers}\n`;
    csv += `Total Revenue (₹),${totalRevenue.toFixed(2)}\n`;
    csv += `Delivered Orders,${deliveredOrders}\n`;
    csv += `Delivery Rate (%),${deliveryRate}\n`;
    csv += `Average Order Value (₹),${avgOrderValue}\n`;
    csv += `Orders per User,${totalUsers > 0 ? (totalOrders / totalUsers).toFixed(2) : 0}\n`;

    // Order status breakdown
    csv += '\n\nOrder Status Breakdown\n';
    csv += 'Status,Count,Percentage\n';
    
    const statusCounts = {};
    orders.forEach(order => {
      statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;
    });

    Object.entries(statusCounts).forEach(([status, count]) => {
      const percentage = totalOrders > 0 ? ((count / totalOrders) * 100).toFixed(2) : 0;
      csv += `${status},${count},${percentage}%\n`;
    });

    return csv;
  }
}

module.exports = new ReportsService();
