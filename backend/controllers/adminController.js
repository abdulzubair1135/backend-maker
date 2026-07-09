const db = require('../config/db');
const bcrypt = require('bcryptjs');

module.exports = {
  // 1. Dashboard Stats
  async getDashboardStats(req, res) {
    try {
      const usersCount = await db.query('SELECT COUNT(*) as count FROM users');
      const leadsCount = await db.query('SELECT COUNT(*) as count FROM leads');
      const pendingLeads = await db.query("SELECT COUNT(*) as count FROM leads WHERE status = 'Pending'");
      const contactedLeads = await db.query("SELECT COUNT(*) as count FROM leads WHERE status = 'Contacted'");
      const completedLeads = await db.query("SELECT COUNT(*) as count FROM leads WHERE status = 'Completed'");

      // Group leads by category
      const categories = await db.query('SELECT category, COUNT(*) as count FROM leads GROUP BY category');

      // Latest 5 activity logs
      const recentActivities = await db.query(
        `SELECT a.*, u.username 
         FROM activity_logs a 
         LEFT JOIN users u ON a.user_id = u.id 
         ORDER BY a.created_at DESC LIMIT 5`
      );

      res.json({
        stats: {
          users: usersCount[0].count,
          leads: leadsCount[0].count,
          pending: pendingLeads[0].count,
          contacted: contactedLeads[0].count,
          completed: completedLeads[0].count
        },
        categories,
        recentActivities
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // 2. User Management
  async listUsers(req, res) {
    try {
      const users = await db.query(
        `SELECT u.id, u.username, u.email, u.status, u.two_factor_enabled, u.created_at, 
                r.id as roleId, r.name as roleName 
         FROM users u 
         LEFT JOIN roles r ON u.role_id = r.id`
      );
      res.json(users);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async createUser(req, res) {
    const { username, email, password, roleId } = req.body;
    try {
      if (!username || !email || !password || !roleId) {
        return res.status(400).json({ error: 'Username, email, password, and role ID are required.' });
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const result = await db.query(
        'INSERT INTO users (username, email, password, role_id) VALUES (?, ?, ?, ?)',
        [username, email, hashedPassword, roleId]
      );

      if (req.user) {
        await db.query('INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)',
          [req.user.id, 'Create User', `Created user account: ${username}`]);
      }

      res.status(201).json({ success: true, userId: result.insertId });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ error: 'Username or email already exists.' });
      }
      res.status(500).json({ error: err.message });
    }
  },

  async updateUser(req, res) {
    const { id } = req.params;
    const { email, roleId, status, password } = req.body;
    try {
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
          [req.user.id, 'Update User', `Updated user ID: ${id}`]);
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
        return res.status(400).json({ error: 'Cannot delete default Super Admin account.' });
      }
      await db.query('DELETE FROM users WHERE id = ?', [id]);

      if (req.user) {
        await db.query('INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)',
          [req.user.id, 'Delete User', `Deleted user ID: ${id}`]);
      }

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // 3. Role Management
  async listRoles(req, res) {
    try {
      const roles = await db.query('SELECT * FROM roles');
      res.json(roles);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async updateRolePermissions(req, res) {
    const { id } = req.params;
    const { permissions } = req.body; // Array of permission strings
    const permissionsStr = JSON.stringify(permissions || []);

    try {
      await db.query('UPDATE roles SET permissions = ? WHERE id = ?', [permissionsStr, id]);

      if (req.user) {
        await db.query('INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)',
          [req.user.id, 'Update Role Permissions', `Updated permissions for role ID: ${id}`]);
      }

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // 4. Activity & Login Logs
  async getActivityLogs(req, res) {
    try {
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
      const logs = await db.query('SELECT * FROM login_logs ORDER BY created_at DESC LIMIT 200');
      res.json(logs);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // 5. Leads Management
  async listLeads(req, res) {
    try {
      const leads = await db.query('SELECT * FROM leads ORDER BY created_at DESC');
      // Format details back to JSON object if needed
      const formattedLeads = leads.map(l => {
        try {
          l.details = JSON.parse(l.details);
        } catch (e) {}
        return l;
      });
      res.json(formattedLeads);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async updateLead(req, res) {
    const { id } = req.params;
    const { status, notes } = req.body;
    try {
      await db.query('UPDATE leads SET status = ?, notes = ? WHERE id = ?', [status, notes, id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async deleteLead(req, res) {
    const { id } = req.params;
    try {
      await db.query('DELETE FROM leads WHERE id = ?', [id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
};
