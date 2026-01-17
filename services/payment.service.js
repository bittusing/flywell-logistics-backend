const Razorpay = require('razorpay');
const crypto = require('crypto');
const AppError = require('../utils/AppError');
const Payment = require('../models/Payment.model');

/**
 * Payment Service - Handles Razorpay payment gateway integration
 */
class PaymentService {
  constructor() {
    // Don't initialize Razorpay here if credentials are not available
    // Initialize lazily in createRazorpayOrder method
    this.razorpay = null;
  }

  /**
   * Create Razorpay order for wallet recharge
   * @param {String} userId - User ID
   * @param {Number} amount - Amount in rupees
   * @returns {Object} Razorpay order details
   */
  async createRazorpayOrder(userId, amount) {
    try {
      // Check if Razorpay credentials are configured
      if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
        throw new AppError(
          'Razorpay credentials not configured. Please add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to your .env file.',
          500
        );
      }

      if (amount < 1) {
        throw new AppError('Minimum recharge amount is ₹1', 400);
      }

      // Initialize Razorpay if not already initialized
      if (!this.razorpay) {
        this.razorpay = new Razorpay({
          key_id: process.env.RAZORPAY_KEY_ID,
          key_secret: process.env.RAZORPAY_KEY_SECRET
        });
      }

      // Create Razorpay order
      // Receipt must be max 40 characters
      const timestamp = Date.now().toString();
      const userIdStr = userId.toString();
      // Format: WR_<userId_last6>_<timestamp_last8> (max 40 chars)
      // WR = Wallet Recharge, then last 6 chars of userId, then last 8 chars of timestamp
      const receipt = `WR_${userIdStr.slice(-6)}_${timestamp.slice(-8)}`;
      
      const options = {
        amount: amount * 100, // Convert to paise
        currency: 'INR',
        receipt: receipt, // Max 40 characters
        notes: {
          userId: userId.toString(),
          paymentType: 'wallet_recharge',
          fullReceipt: `wallet_recharge_${userId}_${timestamp}` // Full receipt in notes
        }
      };

      let razorpayOrder;
      try {
        razorpayOrder = await this.razorpay.orders.create(options);
      } catch (razorpayError) {
        // Handle Razorpay specific errors
        const errorMessage = razorpayError?.error?.description || 
                            razorpayError?.error?.reason || 
                            razorpayError?.message || 
                            razorpayError?.toString() ||
                            'Failed to create Razorpay order';
        
        console.error('Razorpay API Error:', razorpayError);
        throw new AppError(`Razorpay error: ${errorMessage}`, 500);
      }

      // Save payment record
      const payment = await Payment.create({
        user: userId,
        razorpayOrderId: razorpayOrder.id,
        amount: amount,
        currency: 'INR',
        paymentType: 'wallet_recharge',
        status: 'pending',
        metadata: {
          razorpayOrder: razorpayOrder
        }
      });

      return {
        orderId: razorpayOrder.id,
        amount: razorpayOrder.amount / 100, // Convert back to rupees
        currency: razorpayOrder.currency,
        key: process.env.RAZORPAY_KEY_ID,
        paymentId: payment._id
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      
      // Better error handling for unknown errors
      const errorMessage = error?.message || 
                          error?.error?.description || 
                          error?.toString() || 
                          'Unknown payment gateway error';
      
      console.error('Payment Service Error:', error);
      throw new AppError(`Payment gateway error: ${errorMessage}`, 500);
    }
  }

  /**
   * Verify Razorpay payment signature
   * @param {String} razorpayOrderId - Razorpay order ID
   * @param {String} razorpayPaymentId - Razorpay payment ID
   * @param {String} razorpaySignature - Razorpay signature
   * @returns {Boolean} Verification result
   */
  verifyPayment(razorpayOrderId, razorpayPaymentId, razorpaySignature) {
    try {
      const generatedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');

      return generatedSignature === razorpaySignature;
    } catch (error) {
      return false;
    }
  }

  /**
   * Verify and complete payment
   * @param {String} paymentId - Payment document ID
   * @param {Object} razorpayData - Razorpay payment data
   * @returns {Object} Payment details
   */
  async verifyAndCompletePayment(paymentId, razorpayData) {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = razorpayData;

      // Find payment record
      const payment = await Payment.findById(paymentId);
      if (!payment) {
        throw new AppError('Payment not found', 404);
      }

      if (payment.status === 'completed') {
        return payment;
      }

      // Verify signature
      const isValid = this.verifyPayment(
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature
      );

      if (!isValid) {
        payment.status = 'failed';
        payment.metadata.verificationError = 'Invalid signature';
        await payment.save();
        throw new AppError('Invalid payment signature', 400);
      }

      // Verify order ID matches
      if (payment.razorpayOrderId !== razorpay_order_id) {
        payment.status = 'failed';
        payment.metadata.verificationError = 'Order ID mismatch';
        await payment.save();
        throw new AppError('Order ID mismatch', 400);
      }

      // Update payment record
      payment.razorpayPaymentId = razorpay_payment_id;
      payment.razorpaySignature = razorpay_signature;
      payment.status = 'completed';
      payment.metadata.razorpayPayment = razorpayData;
      await payment.save();

      return payment;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(`Payment verification error: ${error.message}`, 500);
    }
  }

  /**
   * Get payment by ID
   * @param {String} paymentId - Payment ID
   * @returns {Object} Payment details
   */
  async getPaymentById(paymentId) {
    const payment = await Payment.findById(paymentId)
      .populate('user', 'name email phone')
      .populate('orderId');

    if (!payment) {
      throw new AppError('Payment not found', 404);
    }

    return payment;
  }

  /**
   * Get user payments
   * @param {String} userId - User ID
   * @param {Object} filters - Filter options
   * @returns {Array} Payment list
   */
  async getUserPayments(userId, filters = {}) {
    const query = { user: userId };

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.paymentType) {
      query.paymentType = filters.paymentType;
    }

    const payments = await Payment.find(query)
      .sort({ createdAt: -1 })
      .limit(filters.limit || 50)
      .skip(filters.skip || 0);

    return payments;
  }
}

module.exports = new PaymentService();
