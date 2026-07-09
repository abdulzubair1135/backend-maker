const express = require('express');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple token-based authentication middleware for admin routes
const ADMIN_TOKEN = 'websoft-solution-admin-token-2026';

function requireAdmin(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (authHeader === `Bearer ${ADMIN_TOKEN}` || req.query.token === ADMIN_TOKEN) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized. Admin access required.' });
  }
}

// ----------------------------------------------------
// Public API Routes (Invoked by the static website)
// ----------------------------------------------------

app.post('/api/contact', (req, res) => {
  const { name, email, phone, subject, message, services } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ error: 'Name and phone are required.' });
  }
  const lead = db.addLead('contact', { name, email, phone, subject, message, services });
  res.status(201).json({ success: true, lead });
});

app.post('/api/request-audit', (req, res) => {
  const { name, company, email, phone, division, details, requestType } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ error: 'Name and phone are required.' });
  }
  const lead = db.addLead('audit', { name, company, email, phone, division, details, requestType });
  res.status(201).json({ success: true, lead });
});

app.post('/api/dish-billing', (req, res) => {
  const { name, phone, email, address, vcNumber, plan } = req.body;
  if (!name || !phone || !vcNumber) {
    return res.status(400).json({ error: 'Name, phone, and VC number are required.' });
  }
  const lead = db.addLead('dish_billing', { name, phone, email, address, vcNumber, plan });
  res.status(201).json({ success: true, lead });
});

app.post('/api/ott-billing', (req, res) => {
  const { name, phone, email, address, amount, packName, paymentMethod } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ error: 'Name and phone are required.' });
  }
  const lead = db.addLead('ott_billing', { name, phone, email, address, amount, packName, paymentMethod });
  res.status(201).json({ success: true, lead });
});

// ----------------------------------------------------
// Admin API Routes (Control Panel)
// ----------------------------------------------------

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  const admin = db.authenticateAdmin(username, password);
  if (admin) {
    res.json({ success: true, token: ADMIN_TOKEN });
  } else {
    res.status(401).json({ success: false, error: 'Invalid username or password' });
  }
});

app.get('/api/admin/stats', requireAdmin, (req, res) => {
  res.json(db.getStats());
});

app.get('/api/admin/leads', requireAdmin, (req, res) => {
  const contacts = db.getLeads('contact').map(l => ({ ...l, category: 'Contact Inquiry' }));
  const audits = db.getLeads('audit').map(l => ({ ...l, category: 'Audit Request' }));
  const dish = db.getLeads('dish_billing').map(l => ({ ...l, category: 'DishTV Billing' }));
  const ott = db.getLeads('ott_billing').map(l => ({ ...l, category: 'OTT Subscription' }));

  const allLeads = [...contacts, ...audits, ...dish, ...ott];
  // Sort by date descending
  allLeads.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.json(allLeads);
});

app.put('/api/admin/leads/:type/:id', requireAdmin, (req, res) => {
  const { type, id } = req.params;
  const { status, notes } = req.body;
  const updated = db.updateLead(type, id, { status, notes });
  if (updated) {
    res.json({ success: true, lead: updated });
  } else {
    res.status(404).json({ error: 'Lead not found' });
  }
});

app.delete('/api/admin/leads/:type/:id', requireAdmin, (req, res) => {
  const { type, id } = req.params;
  const deleted = db.deleteLead(type, id);
  if (deleted) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Lead not found' });
  }
});

// ----------------------------------------------------
// Static Files & Page Fallbacks
// ----------------------------------------------------

// Serve Admin Panel at /admin route
app.use('/admin', express.static(path.join(__dirname, 'public', 'admin')));

// Serve main static site
app.use(express.static(path.join(__dirname, 'wssbhuj.in')));

// Catch-all route to serve the React SPA for paths like /plans, /ott, etc.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'wssbhuj.in', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`  Websoft Solutions Backend & Control Panel Ready  `);
  console.log(`  Local Server: http://localhost:${PORT}          `);
  console.log(`  Admin Control Panel: http://localhost:${PORT}/admin `);
  console.log(`==================================================`);
});
