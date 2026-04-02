const crypto = require('crypto');
const User = require('../models/User.model');
const Wallet = require('../models/Wallet.model');
const generateToken = require('../utils/generateToken');
const AppError = require('../utils/AppError');
const verifyGoogleIdToken = require('../utils/verifyGoogleIdToken');
const emailService = require('./email.service');

/**
 * Best display name from Google ID token payload (name, given/family, or email local part).
 * @param {Record<string, unknown>} p
 */
function buildGoogleDisplayName(p) {
  if (p.name && String(p.name).trim()) {
    return String(p.name).trim();
  }
  const gn = p.given_name && String(p.given_name).trim();
  const fn = p.family_name && String(p.family_name).trim();
  if (gn && fn) return `${gn} ${fn}`;
  if (gn) return gn;
  if (fn) return fn;
  if (p.email) return p.email.split('@')[0];
  return 'User';
}

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
        wallet: wallet._id,
        kycStatus: user.kycStatus || 'not_started',
        authProvider: user.authProvider || 'local'
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

    if (user.authProvider === 'google') {
      throw new AppError(
        'This account uses Google sign-in. Please use "Continue with Google" on the login page.',
        401
      );
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
        kycStatus: user.kycStatus,
        authProvider: user.authProvider
      },
      token
    };
  }

  /**
   * Sign in or register via Google ID token (client obtains token from Google Identity Services).
   * @param {{ idToken: string }} payload
   */
  async googleAuth(payload) {
    const { idToken } = payload;
    if (!idToken) {
      throw new AppError('Google credential is required', 400);
    }

    let googlePayload;
    try {
      googlePayload = await verifyGoogleIdToken(idToken);
    } catch (err) {
      console.error('[AuthService] Google ID token verification failed:', err.message);
      throw new AppError('Invalid or expired Google sign-in. Please try again.', 401);
    }

    const googleId = googlePayload.sub;
    const email = (googlePayload.email || '').toLowerCase();
    const displayName = buildGoogleDisplayName(googlePayload);

    if (!email) {
      throw new AppError('Your Google account must have an email address', 400);
    }

    let user = await User.findOne({ googleId }).populate('wallet');

    if (!user) {
      const existingByEmail = await User.findOne({ email }).populate('wallet');

      if (existingByEmail) {
        if (existingByEmail.googleId && existingByEmail.googleId !== googleId) {
          throw new AppError('This email is linked to a different Google account', 400);
        }

        existingByEmail.googleId = googleId;
        if (displayName) {
          existingByEmail.name = displayName;
        }
        await existingByEmail.save();
        user = await User.findById(existingByEmail._id).populate('wallet');
      } else {
        const randomPassword = crypto.randomBytes(32).toString('hex');
        user = await User.create({
          name: displayName,
          email,
          phone: undefined,
          password: randomPassword,
          googleId,
          authProvider: 'google',
          termsAccepted: true
        });

        const wallet = await Wallet.create({
          user: user._id,
          balance: 0
        });

        user.wallet = wallet._id;
        await user.save();
        user = await User.findById(user._id).populate('wallet');
      }
    } else if (displayName && user.name !== displayName) {
      user.name = displayName;
      await user.save();
      user = await User.findById(user._id).populate('wallet');
    }

    if (!user.isActive) {
      throw new AppError('Your account has been deactivated. Please contact support.', 401);
    }

    const token = generateToken(user._id);

    return {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        wallet: user.wallet?._id || null,
        role: user.role,
        kycStatus: user.kycStatus,
        authProvider: user.authProvider
      },
      token
    };
  }

  /**
   * Request password reset email (always responds with generic message for privacy).
   * @param {{ email: string }} param0
   */
  async forgotPassword({ email }) {
    const genericMessage =
      'If an account exists for this email, you will receive password reset instructions shortly.';

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user || !user.isActive) {
      return { message: genericMessage };
    }

    if (user.authProvider === 'google') {
      return { message: genericMessage };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashed = crypto.createHash('sha256').update(resetToken).digest('hex');

    user.passwordResetToken = hashed;
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save({ validateBeforeSave: false });

    const baseUrl =
      process.env.PUBLIC_APP_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetUrl = `${String(baseUrl).replace(/\/$/, '')}/reset-password?token=${resetToken}`;

    await emailService.sendPasswordResetEmail(user.email, resetUrl);

    return { message: genericMessage };
  }

  /**
   * Reset password using token from email link.
   * @param {{ token: string, password: string }} param0
   */
  async resetPassword({ token, password }) {
    if (!token || !password) {
      throw new AppError('Token and new password are required', 400);
    }

    const hashed = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashed,
      passwordResetExpires: { $gt: new Date() }
    }).select('+passwordResetToken +passwordResetExpires');

    if (!user) {
      throw new AppError('Invalid or expired reset link. Please request a new password reset.', 400);
    }

    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.authProvider = 'local';
    await user.save();

    return { message: 'Password updated successfully. You can sign in with your new password.' };
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
      balance: user.wallet?.balance || 0,
      authProvider: user.authProvider || 'local'
    };
  }
}

module.exports = new AuthService();
