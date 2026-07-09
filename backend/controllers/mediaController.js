const fs = require('fs');
const path = require('path');

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'Uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

module.exports = {
  // List all uploaded media files
  async listMedia(req, res) {
    try {
      const files = fs.readdirSync(UPLOADS_DIR);
      const list = files.map(file => {
        const filePath = path.join(UPLOADS_DIR, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          size: stats.size,
          url: `/uploads/${file}`,
          createdAt: stats.birthtime
        };
      });
      res.json(list);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // Upload file (receives base64 encoded file for instant API capability)
  async uploadMedia(req, res) {
    const { name, content } = req.body;
    if (!name || !content) {
      return res.status(400).json({ error: 'Filename and base64 content are required' });
    }

    try {
      const safeName = name.replace(/[^a-z0-9._-]/gi, '_');
      const filePath = path.join(UPLOADS_DIR, safeName);
      
      // Remove data:image/...;base64, prefix if it exists
      const base64Data = content.replace(/^data:[^;]+;base64,/, "");
      
      fs.writeFileSync(filePath, base64Data, 'base64');
      
      res.status(201).json({
        success: true,
        file: {
          name: safeName,
          url: `/uploads/${safeName}`
        }
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // Delete a media file
  async deleteMedia(req, res) {
    const { filename } = req.params;
    try {
      const safeName = filename.replace(/\.\./g, ''); // prevent directory traversal
      const filePath = path.join(UPLOADS_DIR, safeName);
      
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return res.json({ success: true });
      }
      res.status(404).json({ error: 'File not found' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
};
