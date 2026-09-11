const { ApiError } = require('../utils/ApiError');

/**
 * Central error handler -- every route funnels errors here via
 * `next(err)` instead of each handler formatting its own error response.
 * Operational errors (ApiError subclasses) return their intended status
 * code and message; anything else is treated as a bug and returns a
 * generic 500 so internal details never leak to the client.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  if (err.name === 'ValidationError') {
    // mongoose schema validation error
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ error: messages.join(', ') });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({ error: `Invalid ${err.path}: ${err.value}` });
  }

  if (err.code === 11000) {
    return res.status(409).json({ error: 'Duplicate value violates a unique constraint' });
  }

  console.error('Unexpected error:', err);
  return res.status(500).json({ error: 'Internal server error' });
}

function notFoundHandler(req, res) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
}

module.exports = { errorHandler, notFoundHandler };
