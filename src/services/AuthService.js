const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { ConflictError, UnauthorizedError } = require('../utils/ApiError');

/**
 * AuthService encapsulates all authentication business logic, independent
 * of Express. Keeping this framework-agnostic is what makes it unit
 * testable without spinning up a server or a real MongoDB connection --
 * tests mock the `User` model directly (see tests/unit/authService.test.js).
 */
class AuthService {
  constructor({ userModel = User, jwtSecret = process.env.JWT_SECRET, jwtExpiresIn = '7d' } = {}) {
    this.User = userModel;
    this.jwtSecret = jwtSecret;
    this.jwtExpiresIn = jwtExpiresIn;
  }

  async register({ name, email, password }) {
    const existing = await this.User.findOne({ email: email.toLowerCase() });
    if (existing) {
      throw new ConflictError('An account with this email already exists');
    }

    const user = await this.User.create({ name, email, password });
    const token = this._signToken(user._id);
    return { user, token };
  }

  async login({ email, password }) {
    const user = await this.User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const passwordMatches = await user.comparePassword(password);
    if (!passwordMatches) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const token = this._signToken(user._id);
    return { user, token };
  }

  verifyToken(token) {
    return jwt.verify(token, this.jwtSecret);
  }

  _signToken(userId) {
    if (!this.jwtSecret) {
      throw new Error('JWT_SECRET is not configured');
    }
    return jwt.sign({ sub: userId.toString() }, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn,
    });
  }
}

module.exports = AuthService;
