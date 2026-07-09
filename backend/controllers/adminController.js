const db = require('../config/db');
const bcrypt = require('bcryptjs');
const statsHelper = require('../utils/systemStats');

module.exports = {
  // 1. Dashboard Stats
  async getDashboardStats(req, res) {
    try {
      const systemStats = await statsHelper.getMetrics();
      
      let usersCount = 0;
      let totalLeads = 0;
      let recentActivities = [];
      let categories = [
        { category: 'contact', count: 0 },
        { category: 'audit', count: 0 },
        { category: 'dish_billing', count: 0 },
        { category: 'ott_billing', count: 0 }
      ];

      if (db.isConnected()) {
        const uCount = await db.query('SELECT COUNT(*) as count FROM users');
        usersCount = uCount[0].count;

        const cCount = await db.query('SELECT COUNT(*) as count FROM contact');
        const eCount = await db.query('SELECT COUNT(*) as count FROM enquiry');
        const bCount = await db.query('SELECT COUNT(*) as count FROM billing_recharges');
        
        totalLeads = cCount[0].count + eCount[0].count + bCount[0].count;

        // Group counts
        categories = [
          { category: 'contact', count: cCount[0].count },
          { category: 'audit', count: eCount[0].count },
          { category: 'dish_billing', count: (await db.query('SELECT COUNT(*) as count FROM billing_recharges WHERE category = "dish"'))[0].count },
          { category: 'ott_billing', count: (await db.query('SELECT COUNT(*) as count FROM billing_recharges WHERE category = "ott"'))[0].count }
        ];

        recentActivities = await db.query(
          `SELECT a.*, u.username 
           FROM activity_logs a 
           LEFT JOIN users u ON a.user_id = u.id 
           ORDER BY a.created_at DESC LIMIT 5`
        );
      }

      res.json({
        stats: {
          users: usersCount,
          leads: totalLeads,
          pending: systemStats.pendingLeads,
          contacted: 0, // calculated client side or not needed
          completed: 0,
          ...systemStats
        },
        categories,
        recentActivities
      });
    } catch (err) {
      console.error('Stats fail error:', err.message);
      res.status(500).json({ error: 'Stats load karne me error ho gaya bhai!' });
    }
  },

  // 2. User Management
  async listUsers(req, res) {
    try {
      if (!db.isConnected()) {
        return res.json([{ id: 1, username: 'admin', email: 'admin@websoft.in', status: 'Active', roleName: 'Super Admin', roleId: 1 }]);
      }
      const users = await db.query(
        `SELECT u.id, u.username, u.email, u.status, u.two_factor_enabled, u.created_at, 
                r.id as roleId, r.name as roleName 
         FROM users u 
         LEFT JOIN roles r ON u.role_id = r.id`
      );
      res.json(users);
    } catch (err) {
      res.status(500).json({ error: 'User list load karne me fail ho gaya.' });
    }
  },

  async createUser(req, res) {
    const { username, email, password, roleId } = req.body;
    try {
      if (!username || !email || !password || !roleId) {
        return res.status(400).json({ error: 'Username, email, password, aur role ID sab daalna jaruri hai bhai.' });
      }

      if (!db.isConnected()) {
        return res.status(400).json({ error: 'Database connect nahi hai, offline mode me user create nahi ho sakta!' });
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const result = await db.query(
        'INSERT INTO users (username, email, password, role_id) VALUES (?, ?, ?, ?)',
        [username, email, hashedPassword, roleId]
      );

      if (req.user) {
        await db.query('INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)',
          [req.user.id, 'Create User', `Naya user banaya: ${username}`]);
      }

      res.status(201).json({ success: true, userId: result.insertId });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ error: 'Username ya email pehle se exist karta hai bhai!' });
      }
      res.status(500).json({ error: err.message });
    }
  },

  async updateUser(req, res) {
    const { id } = req.params;
    const { email, roleId, status, password } = req.body;
    try {
      if (!db.isConnected()) {
        return res.status(400).json({ error: 'Database offline hai!' });
      }

      let queryStr = 'UPDATE users SET email = ?, role_id = ?, status = ?';
      const params = [email, roleId, status];

      if (password) {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        queryStr += ', password = ?';
        params.push(hashedPassword);
      }

      queryStr += ' WHERE id = ?';
      params.push(id);

      await db.query(queryStr, params);

      if (req.user) {
        await db.query('INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)',
          [req.user.id, 'Update User', `User settings badla, ID: ${id}`]);
      }

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async deleteUser(req, res) {
    const { id } = req.params;
    try {
      if (parseInt(id) === 1) {
        return res.status(400).json({ error: 'Arre bhai, main admin account delete mat karo!' });
      }
      if (!db.isConnected()) {
        return res.status(400).json({ error: 'DB offline!' });
      }
      await db.query('DELETE FROM users WHERE id = ?', [id]);

      if (req.user) {
        await db.query('INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)',
          [req.user.id, 'Delete User', `User uda diya, ID: ${id}`]);
      }

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // 3. Role Management
  async listRoles(req, res) {
    try {
      if (!db.isConnected()) {
        return res.json([{ id: 1, name: 'Super Admin', permissions: '["all"]' }]);
      }
      const roles = await db.query('SELECT * FROM roles');
      res.json(roles);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async updateRolePermissions(req, res) {
    const { id } = req.params;
    const { permissions } = req.body;
    const permissionsStr = JSON.stringify(permissions || []);

    try {
      await db.query('UPDATE roles SET permissions = ? WHERE id = ?', [permissionsStr, id]);

      if (req.user) {
        await db.query('INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)',
          [req.user.id, 'Update Role Permissions', `Role ${id} ke permissions update kiye`]);
      }

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // 4. Activity Logs & Login Logs
  async getActivityLogs(req, res) {
    try {
      if (!db.isConnected()) {
        return res.json([]);
      }
      const logs = await db.query(
        `SELECT a.*, u.username 
         FROM activity_logs a 
         LEFT JOIN users u ON a.user_id = u.id 
         ORDER BY a.created_at DESC LIMIT 200`
      );
      res.json(logs);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async getLoginLogs(req, res) {
    try {
      if (!db.isConnected()) {
        return res.json([]);
      }
      const logs = await db.query('SELECT * FROM login_logs ORDER BY created_at DESC LIMIT 200');
      res.json(logs);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // 5. Unified Leads List
  async listLeads(req, res) {
    try {
      if (!db.isConnected()) {
        return res.json([]);
      }
      const contacts = await db.query('SELECT id, name, email, phone, "contact" as category, status, message as details, notes, created_at FROM contact');
      const enquiries = await db.query('SELECT id, name, email, phone, "audit" as category, status, details, notes, created_at FROM enquiry');
      const billings = await db.query('SELECT id, customer_name as name, customer_email as email, customer_phone as phone, IF(category="dish","dish_billing","ott_billing") as category, status, JSON_OBJECT("amount", amount, "packName", pack_name, "vcNumber", vc_number, "paymentMethod", payment_method) as details, notes, created_at FROM billing_recharges');

      const allLeads = [...contacts, ...enquiries, ...billings];
      allLeads.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      // Parse JSON details if string
      const formatted = allLeads.map(l => {
        if (typeof l.details === 'string') {
          try {
            l.details = JSON.parse(l.details);
          } catch(e) {}
        }
        return l;
      });

      res.json(formatted);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async updateLead(req, res) {
    const { id } = req.params;
    const { status, notes, category } = req.body;
    try {
      if (category === 'contact') {
        await db.query('UPDATE contact SET status = ?, notes = ? WHERE id = ?', [status, notes, id]);
      } else if (category === 'audit') {
        await db.query('UPDATE enquiry SET status = ?, notes = ? WHERE id = ?', [status, notes, id]);
      } else if (category === 'dish_billing' || category === 'ott_billing') {
        await db.query('UPDATE billing_recharges SET status = ?, notes = ? WHERE id = ?', [status, notes, id]);
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async deleteLead(req, res) {
    const { id } = req.params;
    const { category } = req.query;
    try {
      if (category === 'contact') {
        await db.query('DELETE FROM contact WHERE id = ?', [id]);
      } else if (category === 'audit') {
        await db.query('DELETE FROM enquiry WHERE id = ?', [id]);
      } else if (category === 'dish_billing' || category === 'ott_billing') {
        await db.query('DELETE FROM billing_recharges WHERE id = ?', [id]);
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
};
