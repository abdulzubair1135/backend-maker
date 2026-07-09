const fs = require('fs');
const path = require('path');
const db = require('../config/db');

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'Uploads');

module.exports = {
  // 1. List uploaded files
  async listMedia(req, res) {
    try {
      if (db.isConnected()) {
        const mediaList = await db.query('SELECT * FROM media ORDER BY created_at DESC');
        return res.json(mediaList.map(item => ({
          id: item.id,
          filename: item.filename,
          mime_type: item.mime_type,
          file_size: item.file_size,
          file_url: item.file_url,
          created_at: item.created_at
        })));
      }

      // Fallback: Read local directory
      if (!fs.existsSync(UPLOADS_DIR)) {
        fs.mkdirSync(UPLOADS_DIR, { recursive: true });
      }
      const files = fs.readdirSync(UPLOADS_DIR);
      const fallbackList = files.map(file => {
        const stats = fs.statSync(path.join(UPLOADS_DIR, file));
        return {
          id: file,
          filename: file,
          mime_type: file.endsWith('.png') ? 'image/png' : 'image/jpeg',
          file_size: stats.size,
          file_url: `/uploads/${file}`,
          created_at: stats.birthtime
        };
      });
      res.json(fallbackList);
    } catch (err) {
      console.error('List media error:', err);
      res.status(500).json({ error: 'Media files load karne me fail ho gaya.' });
    }
  },

  // 2. Upload file (supports BOTH multer multipart and base64 body)
  async uploadMedia(req, res) {
    try {
      let filename, mimeType, fileSize, fileUrl;

      // Check if uploaded via multer (multipart)
      if (req.file) {
        filename = req.file.filename;
        mimeType = req.file.mimetype;
        fileSize = req.file.size;
        fileUrl = `/uploads/${filename}`;
      } else {
        // Fallback: Check if uploaded via base64 body (from admin.js)
        const { filename: base64Name, base64Data } = req.body;
        if (!base64Name || !base64Data) {
          return res.status(400).json({ error: 'Filename aur content dono bhejni jaruri hai boss!' });
        }

        // Clean names
        const cleanName = base64Name.replace(/[^a-z0-9._-]/gi, '_');
        const uniqueName = Date.now() + '-' + cleanName;
        const filePath = path.join(UPLOADS_DIR, uniqueName);
        
        // Convert and write
        const base64Content = base64Data.replace(/^data:[^;]+;base64,/, "");
        const buffer = Buffer.from(base64Content, 'base64');
        fs.writeFileSync(filePath, buffer);

        filename = uniqueName;
        mimeType = base64Data.substring(base64Data.indexOf(":") + 1, base64Data.indexOf(";")) || 'image/jpeg';
        fileSize = buffer.length;
        fileUrl = `/uploads/${uniqueName}`;
      }

      // Save to database
      if (db.isConnected()) {
        const result = await db.query(
          'INSERT INTO media (filename, mime_type, file_size, file_url) VALUES (?, ?, ?, ?)',
          [filename, mimeType, fileSize, fileUrl]
        );
        
        // Log action
        if (req.user) {
          await db.query('INSERT INTO activity_logs (admin_id, action, details) VALUES (?, ?, ?)',
            [req.user.id, 'Upload Media', `File upload ki: ${filename}`]);
        }

        return res.status(201).json({
          success: true,
          id: result.insertId,
          filename,
          file_url: fileUrl
        });
      }

      // Database offline fallback response
      res.status(201).json({
        success: true,
        filename,
        file_url: fileUrl
      });

    } catch (err) {
      console.error('Upload media error:', err);
      res.status(500).json({ error: err.message });
    }
  },

  // 3. Delete media
  async deleteMedia(req, res) {
    const { filename } = req.params;
    try {
      const safeName = filename.replace(/\.\./g, ''); // prevent directory traversal
      const filePath = path.join(UPLOADS_DIR, safeName);
      
      // Delete from physical disk
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      // Delete from database
      if (db.isConnected()) {
        await db.query('DELETE FROM media WHERE filename = ?', [safeName]);
        
        if (req.user) {
          await db.query('INSERT INTO activity_logs (admin_id, action, details) VALUES (?, ?, ?)',
            [req.user.id, 'Delete Media', `File delete ki: ${safeName}`]);
        }
      }

      res.json({ success: true });
    } catch (err) {
      console.error('Delete media error:', err);
      res.status(500).json({ error: err.message });
    }
  }
};
