const express = require('express');
const router = express.Router();

const auth = require('../controllers/authController');
const cms = require('../controllers/cmsController');
const admin = require('../controllers/adminController');
const media = require('../controllers/mediaController');
const backup = require('../controllers/backupController');

const { requireAuth, requirePermission } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

// ----------------------------------------------------
// Public APIs
// ----------------------------------------------------
router.post('/auth/login', authLimiter, auth.login);
router.post('/auth/refresh', auth.refresh);
router.post('/auth/logout', auth.logout);

// CMS Public View API
router.get('/cms/pages/:name', cms.getPage);
router.get('/cms/sliders', cms.getSliders);
router.get('/cms/gallery', cms.getGallery);
router.get('/cms/menu', cms.getMenu);
router.get('/cms/news', cms.getNews);
router.get('/cms/events', cms.getEvents);
router.get('/cms/faculty', cms.getFaculty);
router.get('/cms/departments', cms.getDepartments);
router.get('/cms/downloads', cms.getDownloads);

// Lead submission endpoints to match frontend patch
router.post('/contact', (req, res) => {
  req.body.category = 'contact';
  req.body.details = { subject: req.body.subject, message: req.body.message, services: req.body.services };
  cms.submitLead(req, res);
});

router.post('/request-audit', (req, res) => {
  req.body.category = 'audit';
  req.body.details = { company: req.body.company, division: req.body.division, details: req.body.details, requestType: req.body.requestType };
  cms.submitLead(req, res);
});

router.post('/dish-billing', (req, res) => {
  req.body.category = 'dish_billing';
  req.body.details = { vcNumber: req.body.vcNumber, plan: req.body.plan, address: req.body.address };
  cms.submitLead(req, res);
});

router.post('/ott-billing', (req, res) => {
  req.body.category = 'ott_billing';
  req.body.details = { amount: req.body.amount, packName: req.body.packName, paymentMethod: req.body.paymentMethod, address: req.body.address };
  cms.submitLead(req, res);
});

router.post('/leads/submit', cms.submitLead);

// ----------------------------------------------------
// Protected Admin Dashboard & Configuration APIs
// ----------------------------------------------------
router.use(requireAuth); // Check JWT Token for all routes below

// 2FA config
router.post('/auth/setup-2fa', auth.setup2FA);

// Admin dashboard stats
router.get('/admin/stats', admin.getDashboardStats);

// CMS Modification API
router.put('/cms/pages/:name', requirePermission('cms.edit'), cms.updatePage);

// Sliders config
router.post('/cms/sliders', requirePermission('cms.edit'), cms.addSlider);
router.put('/cms/sliders/:id', requirePermission('cms.edit'), cms.updateSlider);
router.delete('/cms/sliders/:id', requirePermission('cms.edit'), cms.deleteSlider);

// Gallery config
router.post('/cms/gallery', requirePermission('cms.edit'), cms.addGalleryItem);
router.delete('/cms/gallery/:id', requirePermission('cms.edit'), cms.deleteGalleryItem);

// Menu config
router.put('/cms/menu', requirePermission('cms.edit'), cms.updateMenu);

// News config
router.post('/cms/news', requirePermission('cms.edit'), cms.addNews);
router.delete('/cms/news/:id', requirePermission('cms.edit'), cms.deleteNews);

// Events config
router.post('/cms/events', requirePermission('cms.edit'), cms.addEvent);
router.delete('/cms/events/:id', requirePermission('cms.edit'), cms.deleteEvent);

// Faculty config
router.post('/cms/faculty', requirePermission('cms.edit'), cms.addFaculty);
router.delete('/cms/faculty/:id', requirePermission('cms.edit'), cms.deleteFaculty);

// Department config
router.post('/cms/departments', requirePermission('cms.edit'), cms.addDepartment);
router.delete('/cms/departments/:id', requirePermission('cms.edit'), cms.deleteDepartment);

// Downloads config
router.post('/cms/downloads', requirePermission('cms.edit'), cms.addDownload);
router.delete('/cms/downloads/:id', requirePermission('cms.edit'), cms.deleteDownload);

// Leads config
router.get('/admin/leads', requirePermission('leads.manage'), admin.listLeads);
router.put('/admin/leads/:id', requirePermission('leads.manage'), admin.updateLead);
router.delete('/admin/leads/:id', requirePermission('leads.manage'), admin.deleteLead);

// User Management config
router.get('/admin/users', requirePermission('all'), admin.listUsers);
router.post('/admin/users', requirePermission('all'), admin.createUser);
router.put('/admin/users/:id', requirePermission('all'), admin.updateUser);
router.delete('/admin/users/:id', requirePermission('all'), admin.deleteUser);

// Role config
router.get('/admin/roles', requirePermission('all'), admin.listRoles);
router.put('/admin/roles/:id', requirePermission('all'), admin.updateRolePermissions);

// Logs
router.get('/admin/logs/activity', requirePermission('all'), admin.getActivityLogs);
router.get('/admin/logs/login', requirePermission('all'), admin.getLoginLogs);

// Media Manager
router.get('/media', requirePermission('media.manage'), media.listMedia);
router.post('/media/upload', requirePermission('media.manage'), media.uploadMedia);
router.delete('/media/:filename', requirePermission('media.manage'), media.deleteMedia);

// Backup Manager
router.get('/backup', requirePermission('all'), backup.listBackups);
router.post('/backup', requirePermission('all'), backup.createBackup);
router.post('/backup/restore', requirePermission('all'), backup.restoreBackup);
router.delete('/backup/:filename', requirePermission('all'), backup.deleteBackup);

module.exports = router;
