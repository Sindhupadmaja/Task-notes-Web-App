const AuthService = require('../services/AuthService');
const { UnauthorizedError } = require('../utils/ApiError');

// Constructed lazily on first use, not at module-require time -- AuthService
// reads process.env.JWT_SECRET in its constructor, and module-load order
// (this file could be required before dotenv.config() runs, e.g. from a
// test importing app.js directly) must not silently bake in an undefined
// secret. Lazy construction means it always picks up whatever JWT_SECRET is
// set by the time a request actually comes in.
let authService = null;
function getAuthService() {
  if (!authService) {
    authService = new AuthService();
  }
  return authService;
}

/**
 * Verifies the Bearer token on the Authorization header and attaches
 * `req.userId` for downstream handlers. Any failure (missing header,
 * malformed token, expired token) becomes the same generic 401 -- we don't
 * want to tell an attacker *why* their token was rejected.
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(new UnauthorizedError('Missing or malformed Authorization header'));
  }

  try {
    const payload = getAuthService().verifyToken(token);
    req.userId = payload.sub;
    return next();
  } catch (err) {
    return next(new UnauthorizedError('Invalid or expired token'));
  }
}

module.exports = { requireAuth };
