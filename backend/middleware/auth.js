const jwt = require('jsonwebtoken');
const db = require('../config/db');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'websoft_solutions_secure_token_secret_2026_xyz';

module.exports = {
  // Middleware to authenticate JWT access tokens
  async requireAuth(req, res, next) {
    try {
      const authHeader = req.headers['authorization'];
      let token = authHeader && authHeader.split(' ')[1];

      // Fallback to cookie
      if (!token && req.cookies) {
        token = req.cookies.accessToken;
      }

      // Check if token exists
      if (!token) {
        return res.status(401).json({ error: 'Authentication token is required.' });
      }

      // Verify token
      const decoded = jwt.verify(token, JWT_SECRET);
      
      let users = [];
      let isDbOffline = !db.isConnected();

      try {
        users = await db.query('SELECT u.id, u.username, u.email, u.status, r.name as roleName, r.permissions FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.id = ?', [decoded.id]);
      } catch (dbErr) {
        console.warn('⚠️ Authentication query failed. Using offline fallback admin details.');
        isDbOffline = true;
      }

      // Offline Admin details override
      if (isDbOffline && decoded.username === 'admin') {
        users = [{
          id: 1,
          username: 'admin',
          email: 'admin@websoft.in',
          status: 'Active',
          roleName: 'Super Admin',
          permissions: '["all"]'
        }];
      }

      if (users.length === 0) {
        return res.status(401).json({ error: 'User session no longer exists.' });
      }

      const user = users[0];
      if (user.status !== 'Active') {
        return res.status(403).json({ error: 'Your account has been suspended.' });
      }

      // Format user object
      req.user = {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.roleName,
        permissions: typeof user.permissions === 'string' ? JSON.parse(user.permissions || '[]') : (user.permissions || [])
      };

      next();
    } catch (err) {
      console.error('JWT Auth Error:', err.message);
      return res.status(401).json({ error: 'Invalid or expired authentication token.' });
    }
  },

  // Role verification helper
  requireRole(allowedRoles) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized.' });
      }
      
      if (req.user.role === 'Super Admin') {
        return next(); // Super admin bypasses all role checks
      }

      if (allowedRoles.includes(req.user.role)) {
        next();
      } else {
        res.status(403).json({ error: 'Access denied. Insufficient role permissions.' });
      }
    };
  },

  // Fine-grained permission verification helper
  requirePermission(permission) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized.' });
      }

      const userPermissions = req.user.permissions;
      if (userPermissions.includes('all') || userPermissions.includes(permission)) {
        next();
      } else {
        res.status(403).json({ error: `Access denied. Requires permission: ${permission}` });
      }
    };
  }
};
