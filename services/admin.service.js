const User = require('../models/User.model');
const Order = require('../models/Order.model');
const Payment = require('../models/Payment.model');
const Wallet = require('../models/Wallet.model');
const AppError = require('../utils/AppError');

/**
 * Admin Service - Business logic for admin operations
 */
class AdminService {
  /**
   * Get dashboard statistics
   */
  async getDashboardStats() {
    const [
      totalUsers,
      totalOrders,
      totalRevenue,
      pendingOrders,
      deliveredOrders,
      activeUsers,
      todayOrders,
      todayRevenue
    ] = await Promise.all([
      // Total users
      User.countDocuments({ role: 'user' }),
      
      // Total orders
      Order.countDocuments(),
      
      // Total revenue from payments
      Payment.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      
      // Pending orders
      Order.countDocuments({ 
        status: { $in: ['pending', 'processing', 'in_transit'] } 
      }),
      
      // Delivered orders
      Order.countDocuments({ status: 'delivered' }),
      
      // Active users (logged in last 30 days)
      User.countDocuments({
        role: 'user',
        updatedAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      }),
      
      // Today's orders
      Order.countDocuments({
        createdAt: { 
          $gte: new Date(new Date().setHours(0, 0, 0, 0)) 
        }
      }),
      
      // Today's revenue
      Payment.aggregate([
        {
          $match: {
            status: 'completed',
            createdAt: { 
              $gte: new Date(new Date().setHours(0, 0, 0, 0)) 
            }
          }
        },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ])
    ]);

    return {
      users: {
        total: totalUsers,
        active: activeUsers
      },
      orders: {
        total: totalOrders,
        pending: pendingOrders,
        delivered: deliveredOrders,
        today: todayOrders
      },
      revenue: {
        total: totalRevenue[0]?.total || 0,
        today: todayRevenue[0]?.total || 0
      }
    };
  }

  /**
   * Get revenue analytics
   */
  async getRevenueAnalytics(period = '30days') {
    const days = period === '7days' ? 7 : period === '90days' ? 90 : 30;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const revenueByDay = await Payment.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          revenue: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const profitByDay = await Order.aggregate([
      {
        $match: {
          status: 'delivered',
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          profit: { $sum: { $subtract: ['$totalAmount', '$shippingCost'] } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    return {
      period,
      revenue: revenueByDay,
      profit: profitByDay
    };
  }

  /**
   * Get order analytics
   */
  async getOrderAnalytics(period = '30days') {
    const days = period === '7days' ? 7 : period === '90days' ? 90 : 30;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const ordersByDay = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            status: '$status'
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.date': 1 } }
    ]);

    const ordersByStatus = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    return {
      period,
      ordersByDay,
      ordersByStatus
    };
  }

  /**
   * Get all users with pagination
   */
  async getAllUsers({ page, limit, search, kycStatus }) {
    const query = { role: 'user' };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    if (kycStatus) {
      query.kycStatus = kycStatus;
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .populate('wallet')
        .select('-password')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      User.countDocuments(query)
    ]);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get user details
   */
  async getUserDetails(userId) {
    const user = await User.findById(userId)
      .populate('wallet')
      .select('-password');

    if (!user) {
      throw new AppError('User not found', 404);
    }

    const [orders, payments] = await Promise.all([
      Order.find({ user: userId })
        .sort({ createdAt: -1 })
        .limit(10),
      Payment.find({ user: userId })
        .sort({ createdAt: -1 })
        .limit(10)
    ]);

    return {
      user,
      orders,
      payments
    };
  }

  /**
   * Update user status
   */
  async updateUserStatus(userId, isActive) {
    const user = await User.findByIdAndUpdate(
      userId,
      { isActive },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      throw new AppError('User not found', 404);
    }

    return user;
  }

  /**
   * Get all orders with pagination
   */
  async getAllOrders({ page, limit, status, search, startDate, endDate }) {
    const query = {};

    if (status) {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { awbNumber: { $regex: search, $options: 'i' } },
        { orderId: { $regex: search, $options: 'i' } }
      ];
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate('user', 'name email phone')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Order.countDocuments(query)
    ]);

    return {
      orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get order details
   */
  async getOrderDetails(orderId) {
    const order = await Order.findById(orderId)
      .populate('user', 'name email phone');

    if (!order) {
      throw new AppError('Order not found', 404);
    }

    return order;
  }

  /**
   * Get recent activities
   */
  async getRecentActivities(limit) {
    const [recentOrders, recentPayments, recentUsers] = await Promise.all([
      Order.find()
        .populate('user', 'name email')
        .sort({ createdAt: -1 })
        .limit(limit / 3)
        .select('orderId status createdAt user'),
      
      Payment.find()
        .populate('user', 'name email')
        .sort({ createdAt: -1 })
        .limit(limit / 3)
        .select('transactionId amount status createdAt user'),
      
      User.find({ role: 'user' })
        .sort({ createdAt: -1 })
        .limit(limit / 3)
        .select('name email createdAt')
    ]);

    const activities = [
      ...recentOrders.map(order => ({
        type: 'order',
        description: `New order ${order.orderId}`,
        user: order.user,
        status: order.status,
        createdAt: order.createdAt
      })),
      ...recentPayments.map(payment => ({
        type: 'payment',
        description: `Payment of ₹${payment.amount}`,
        user: payment.user,
        status: payment.status,
        createdAt: payment.createdAt
      })),
      ...recentUsers.map(user => ({
        type: 'user',
        description: `New user registered`,
        user: { name: user.name, email: user.email },
        status: 'active',
        createdAt: user.createdAt
      }))
    ];

    return activities.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
  }

  /**
   * Get top customers
   */
  async getTopCustomers(limit) {
    const topCustomers = await Order.aggregate([
      {
        $group: {
          _id: '$user',
          totalOrders: { $sum: 1 },
          totalSpent: { $sum: '$totalAmount' }
        }
      },
      { $sort: { totalSpent: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $project: {
          name: '$user.name',
          email: '$user.email',
          phone: '$user.phone',
          totalOrders: 1,
          totalSpent: 1
        }
      }
    ]);

    return topCustomers;
  }

  /**
   * Get payment transactions
   */
  async getPaymentTransactions({ page, limit, status }) {
    const query = {};

    if (status) {
      query.status = status;
    }

    const [payments, total] = await Promise.all([
      Payment.find(query)
        .populate('user', 'name email phone')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Payment.countDocuments(query)
    ]);

    return {
      payments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }
}

module.exports = new AdminService();
