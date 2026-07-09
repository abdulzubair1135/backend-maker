const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');

const db = require('./config/db');
const apiRoutes = require('./routes/api');
const { apiLimiter } = require('./middleware/rateLimiter');
const { xssProtection, sqlInjectionProtection, csrfProtection } = require('./middleware/security');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8000;

// Security Middlewares
app.use(helmet({
  contentSecurityPolicy: false, // Turn off CSP for local testing and iframe embeds
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: true, // Allow all origins for API calls
  credentials: true
}));

app.use(cookieParser());
app.use(express.json({ limit: '10mb' })); // Support larger base64 file uploads
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Sanitization & Security middlewares
app.use(xssProtection);
app.use(sqlInjectionProtection);
app.use(csrfProtection);

// Seeding Default Database Data (Roles and User check on startup)
async function seedDefaultDatabase() {
  if (!db.isConnected()) return;

  try {
    // 1. Check and seed Roles
    const roles = await db.query('SELECT COUNT(*) as count FROM roles');
    if (roles[0].count === 0) {
      await db.query('INSERT INTO roles (id, name, permissions) VALUES (1, "Super Admin", \'["all"]\')');
      await db.query('INSERT INTO roles (id, name, permissions) VALUES (2, "Admin", \'["dashboard.view", "cms.edit", "leads.manage", "media.manage"]\')');
      console.log('Seeded Roles table successfully.');
    }

    // 2. Check and seed default Super Admin (admin / admin123)
    const users = await db.query('SELECT COUNT(*) as count FROM users WHERE username = "admin"');
    if (users[0].count === 0) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('admin123', salt);
      await db.query(
        'INSERT INTO users (username, email, password, role_id, status) VALUES ("admin", "admin@websoft.in", ?, 1, "Active")',
        [hashedPassword]
      );
      console.log('✅ Seeded default Super Admin user: admin / admin123');
    }
  } catch (err) {
    console.error('Error during auto-seeding:', err.message);
  }
}

// Check database connection and seed defaults
setTimeout(seedDefaultDatabase, 2000);

// Serving static files from Uploads directory
app.use('/uploads', express.static(path.join(__dirname, '..', 'Uploads')));

// Apply rate limiter to API routes
app.use('/api', apiLimiter);

// Mount API routes
app.use('/api', apiRoutes);

// Serve Admin Panel at /admin route
app.use('/admin', express.static(path.join(__dirname, '..', 'Admin')));

// Serve Main Static Website at root
app.use(express.static(path.join(__dirname, '..', 'Frontend', 'wssbhuj.in')));

// Catch-all route to serve the React SPA for paths like /plans, /ott, etc.
app.get('*', (req, res) => {
  const adminMatch = req.url.startsWith('/admin');
  if (adminMatch) {
    // SPA fallback for admin sub-routes if any, otherwise login.html
    res.sendFile(path.join(__dirname, '..', 'Admin', 'login.html'));
  } else {
    // Frontend React SPA fallback
    res.sendFile(path.join(__dirname, '..', 'Frontend', 'wssbhuj.in', 'index.html'));
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`========================================================`);
  console.log(`  🚀 Professional CMS & API Core System Started`);
  console.log(`  PORT: ${PORT} | Environment: ${process.env.NODE_ENV || 'production'}`);
  console.log(`  Frontend Site: http://localhost:${PORT}`);
  console.log(`  Admin Control Panel: http://localhost:${PORT}/admin`);
  console.log(`========================================================`);
});
