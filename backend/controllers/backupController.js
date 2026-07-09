const fs = require('fs');
const path = require('path');
const db = require('../config/db');

const BACKUPS_DIR = path.join(__dirname, '..', '..', 'Backups');

if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

module.exports = {
  // List all available backups
  async listBackups(req, res) {
    try {
      const files = fs.readdirSync(BACKUPS_DIR);
      const list = files.map(file => {
        const filePath = path.join(BACKUPS_DIR, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          size: stats.size,
          createdAt: stats.birthtime
        };
      });
      res.json(list);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // Perform a full DB backup as a JSON structure (works on any MySQL setup without mysqldump binary)
  async createBackup(req, res) {
    try {
      if (!db.isConnected()) {
        return res.status(500).json({ error: 'Database is not connected. Cannot perform backup.' });
      }

      const tables = [
        'roles', 'users', 'cms_pages', 'cms_slider', 'cms_gallery', 
        'cms_menu', 'cms_news', 'cms_events', 'cms_faculty', 
        'cms_departments', 'cms_downloads', 'leads', 'login_logs', 'activity_logs'
      ];

      const backupData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        tables: {}
      };

      for (const table of tables) {
        try {
          const rows = await db.query(`SELECT * FROM ${table}`);
          backupData.tables[table] = rows;
        } catch (e) {
          console.warn(`Could not backup table: ${table}. Skipping.`);
        }
      }

      const filename = `backup_${Date.now()}.json`;
      const filePath = path.join(BACKUPS_DIR, filename);
      fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2), 'utf8');

      if (req.user) {
        await db.query('INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)',
          [req.user.id, 'Create DB Backup', `Created database backup: ${filename}`]);
      }

      res.status(201).json({ success: true, filename });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // Restore Database from JSON backup
  async restoreBackup(req, res) {
    const { filename } = req.body;
    if (!filename) return res.status(400).json({ error: 'Filename is required' });

    try {
      const safeName = filename.replace(/\.\./g, '');
      const filePath = path.join(BACKUPS_DIR, safeName);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Backup file not found' });
      }

      const backupContent = fs.readFileSync(filePath, 'utf8');
      const backupData = JSON.parse(backupContent);

      // Disable foreign keys temporary
      await db.query('SET FOREIGN_KEY_CHECKS = 0');

      for (const [table, rows] of Object.entries(backupData.tables)) {
        // Clear table
        await db.query(`TRUNCATE TABLE ${table}`);
        if (rows.length === 0) continue;

        // Create insert queries
        for (const row of rows) {
          const keys = Object.keys(row);
          const values = Object.values(row);
          const placeholders = keys.map(() => '?').join(', ');
          
          await db.query(
            `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`,
            values
          );
        }
      }

      // Re-enable foreign keys
      await db.query('SET FOREIGN_KEY_CHECKS = 1');

      if (req.user) {
        await db.query('INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)',
          [req.user.id, 'Restore DB Backup', `Restored database from backup: ${filename}`]);
      }

      res.json({ success: true, message: 'Database restored successfully' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // Delete backup
  async deleteBackup(req, res) {
    const { filename } = req.params;
    try {
      const safeName = filename.replace(/\.\./g, '');
      const filePath = path.join(BACKUPS_DIR, safeName);
      
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return res.json({ success: true });
      }
      res.status(404).json({ error: 'Backup not found' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
};
