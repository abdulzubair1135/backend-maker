const crypto = require('crypto');

// Simple XSS sanitization helper
function cleanInput(val) {
  if (typeof val === 'string') {
    return val
      .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '') // remove script tags
      .replace(/on\w+="[^"]*"/gi, '') // remove inline events
      .replace(/javascript:[^\s]*/gi, ''); // remove javascript links
  }
  if (Array.isArray(val)) {
    return val.map(cleanInput);
  }
  if (typeof val === 'object' && val !== null) {
    const cleaned = {};
    for (const key of Object.keys(val)) {
      cleaned[key] = cleanInput(val[key]);
    }
    return cleaned;
  }
  return val;
}

module.exports = {
  // Strip XSS scripts from body, query and params
  xssProtection(req, res, next) {
    if (req.body) req.body = cleanInput(req.body);
    if (req.query) req.query = cleanInput(req.query);
    if (req.params) req.params = cleanInput(req.params);
    next();
  },

  // Lightweight SQL injection patterns checker (additional layers)
  sqlInjectionProtection(req, res, next) {
    const sqlRegex = /\b(union|select|insert|update|delete|drop|alter|where|truncate)\b/gi;
    
    const checkValue = (val) => {
      if (typeof val === 'string' && (val.includes("'") || val.includes('"') || val.includes('--') || val.includes('/*'))) {
        if (sqlRegex.test(val)) {
          console.warn(`⚠️ Potential SQL injection detected and blocked: "${val}"`);
          return true;
        }
      }
      return false;
    };

    const hasPotentialInjection = 
      Object.values(req.query).some(checkValue) || 
      Object.values(req.params).some(checkValue);

    if (hasPotentialInjection) {
      return res.status(400).json({ error: 'Request rejected due to potential malicious characters.' });
    }
    next();
  },

  // Simple double-submit CSRF protection middleware
  csrfProtection(req, res, next) {
    // Skip CSRF check for GET, HEAD, OPTIONS
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      // Set CSRF token in cookie if not exists
      if (!req.cookies || !req.cookies.csrfToken) {
        const csrfToken = crypto.randomBytes(24).toString('hex');
        res.cookie('csrfToken', csrfToken, {
          httpOnly: false, // Accessible by frontend JS to set header
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict'
        });
      }
      return next();
    }

    // Skip CSRF verification for tracking endpoint
    if (req.path.endsWith('/track')) {
      return next();
    }

    // Verify token for POST, PUT, DELETE
    const cookieToken = req.cookies ? req.cookies.csrfToken : null;
    const headerToken = req.headers['x-csrf-token'];

    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      return res.status(403).json({ error: 'CSRF token mismatch or missing. Action rejected.' });
    }
    next();
  }
};
