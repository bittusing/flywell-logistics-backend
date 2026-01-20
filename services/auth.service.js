const User = require('../models/User.model');
const Wallet = require('../models/Wallet.model');
const generateToken = require('../utils/generateToken');
const AppError = require('../utils/AppError');

/**
 * Auth Service - Business logic for authentication
 */
class AuthService {
  /**
   * Register a new user
   * @param {Object} userData - User registration data
   * @returns {Object} User and token
   */
  async signup(userData) {
    const { name, email, phone, password, termsAccepted } = userData;

    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ email: email.toLowerCase() }, { phone }] 
    });

    if (existingUser) {
      throw new AppError('User already exists with this email or phone number', 400);
    }

    // Create user
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      phone,
      password,
      termsAccepted: termsAccepted === true || termsAccepted === 'true'
    });

    // Create wallet for user
    const wallet = await Wallet.create({
      user: user._id,
      balance: 0
    });

    // Update user with wallet reference
    user.wallet = wallet._id;
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    return {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        wallet: wallet._id
      },
      token
    };
  }

  /**
   * Login user (email only)
   * @param {Object} credentials - Login credentials
   * @returns {Object} User and token
   */
  async login(credentials) {
    const { email, password } = credentials;

    if (!email) {
      throw new AppError('Email is required', 400);
    }

    // Find user with password field
    const user = await User.findOne({ email: email.toLowerCase() })
      .select('+password')
      .populate('wallet');

    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }

    // Check if user is active
    if (!user.isActive) {
      throw new AppError('Your account has been deactivated. Please contact support.', 401);
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new AppError('Invalid email or password', 401);
    }

    // Generate token
    const token = generateToken(user._id);

    return {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        wallet: user.wallet?._id || null,
        role: user.role,
        kycStatus: user.kycStatus
      },
      token
    };
  }

  /**
   * Get current user details
   * @param {String} userId - User ID
   * @returns {Object} User details
   */
  async getCurrentUser(userId) {
    const user = await User.findById(userId).populate('wallet');

    if (!user) {
      throw new AppError('User not found', 404);
    }

    return {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      wallet: user.wallet?._id || null,
      role: user.role,
      kycStatus: user.kycStatus,
      balance: user.wallet?.balance || 0
    };
  }
}

module.exports = new AuthService();
