const AuthService = require('../services/AuthService');

// lazy singleton -- see authMiddleware.js for why (JWT_SECRET must be read
// at first-use time, not module-require time)
let authService = null;
function getAuthService() {
  if (!authService) authService = new AuthService();
  return authService;
}

async function register(req, res, next) {
  try {
    const { user, token } = await getAuthService().register(req.body);
    res.status(201).json({ user, token });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { user, token } = await getAuthService().login(req.body);
    res.status(200).json({ user, token });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login };
