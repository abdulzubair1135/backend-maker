const rateLimit = require('express-rate-limit');
require('dotenv').config();

const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'); // 15 mins default
const max = parseInt(process.env.RATE_LIMIT_MAX || '300'); // limit each IP

module.exports = {
  apiLimiter: rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests from this IP. Please try again after 15 minutes.' }
  }),

  authLimiter: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 mins
    max: 10, // Limit login/auth attempts to 10 per 15 minutes
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts. Please try again after 15 minutes.' }
  })
};
