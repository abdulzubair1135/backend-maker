const db = require('../config/db');

module.exports = {
  // 1. Pages (About, Contact, Settings, SEO)
  async getPage(req, res) {
    const { name } = req.params;
    try {
      const pages = await db.query('SELECT * FROM cms_pages WHERE name = ?', [name]);
      if (pages.length === 0) {
        return res.status(404).json({ error: 'Page not found' });
      }
      const page = pages[0];
      // Try parsing content if it's JSON string
      try {
        page.content = JSON.parse(page.content);
      } catch (e) {}
      res.json(page);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async updatePage(req, res) {
    const { name } = req.params;
    const { title, content, meta_title, meta_description } = req.body;
    const contentStr = typeof content === 'object' ? JSON.stringify(content) : content;

    try {
      await db.query(
        `INSERT INTO cms_pages (name, title, content, meta_title, meta_description) 
         VALUES (?, ?, ?, ?, ?) 
         ON DUPLICATE KEY UPDATE title = ?, content = ?, meta_title = ?, meta_description = ?`,
        [name, title, contentStr, meta_title, meta_description, title, contentStr, meta_title, meta_description]
      );

      // Audit log
      if (req.user) {
        await db.query('INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)',
          [req.user.id, 'Update CMS Page', `Updated page content for: ${name}`]);
      }

      res.json({ success: true, message: 'Page content updated successfully' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // 2. Sliders
  async getSliders(req, res) {
    try {
      const sliders = await db.query('SELECT * FROM cms_slider ORDER BY sort_order ASC');
      res.json(sliders);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async addSlider(req, res) {
    const { title, subtitle, image_url, link_url, sort_order } = req.body;
    try {
      const result = await db.query(
        'INSERT INTO cms_slider (title, subtitle, image_url, link_url, sort_order) VALUES (?, ?, ?, ?, ?)',
        [title, subtitle, image_url, link_url, sort_order || 0]
      );
      res.status(201).json({ success: true, id: result.insertId });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async updateSlider(req, res) {
    const { id } = req.params;
    const { title, subtitle, image_url, link_url, sort_order, active } = req.body;
    try {
      await db.query(
        'UPDATE cms_slider SET title=?, subtitle=?, image_url=?, link_url=?, sort_order=?, active=? WHERE id=?',
        [title, subtitle, image_url, link_url, sort_order, active, id]
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async deleteSlider(req, res) {
    const { id } = req.params;
    try {
      await db.query('DELETE FROM cms_slider WHERE id=?', [id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // 3. Gallery
  async getGallery(req, res) {
    try {
      const items = await db.query('SELECT * FROM cms_gallery ORDER BY created_at DESC');
      res.json(items);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async addGalleryItem(req, res) {
    const { title, image_url, category } = req.body;
    try {
      const result = await db.query(
        'INSERT INTO cms_gallery (title, image_url, category) VALUES (?, ?, ?)',
        [title, image_url, category || 'General']
      );
      res.status(201).json({ success: true, id: result.insertId });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async deleteGalleryItem(req, res) {
    const { id } = req.params;
    try {
      await db.query('DELETE FROM cms_gallery WHERE id=?', [id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // 4. Menu
  async getMenu(req, res) {
    try {
      const menus = await db.query('SELECT * FROM cms_menu ORDER BY sort_order ASC');
      res.json(menus);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async updateMenu(req, res) {
    const { items } = req.body; // Array of menu links
    try {
      // Re-create menu items
      await db.query('DELETE FROM cms_menu');
      for (let i = 0; i < items.length; i++) {
        await db.query(
          'INSERT INTO cms_menu (title, link_url, sort_order) VALUES (?, ?, ?)',
          [items[i].title, items[i].link_url, i + 1]
        );
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // 5. News & Events
  async getNews(req, res) {
    try {
      const news = await db.query('SELECT * FROM cms_news ORDER BY published_at DESC');
      res.json(news);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async addNews(req, res) {
    const { title, content, image_url } = req.body;
    try {
      const result = await db.query(
        'INSERT INTO cms_news (title, content, image_url) VALUES (?, ?, ?)',
        [title, content, image_url]
      );
      res.status(201).json({ success: true, id: result.insertId });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async deleteNews(req, res) {
    const { id } = req.params;
    try {
      await db.query('DELETE FROM cms_news WHERE id=?', [id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // 6. Events
  async getEvents(req, res) {
    try {
      const events = await db.query('SELECT * FROM cms_events ORDER BY event_date ASC');
      res.json(events);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async addEvent(req, res) {
    const { title, description, event_date, location } = req.body;
    try {
      const result = await db.query(
        'INSERT INTO cms_events (title, description, event_date, location) VALUES (?, ?, ?, ?)',
        [title, description, event_date, location]
      );
      res.status(201).json({ success: true, id: result.insertId });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async deleteEvent(req, res) {
    const { id } = req.params;
    try {
      await db.query('DELETE FROM cms_events WHERE id=?', [id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // 7. Faculty & Department
  async getFaculty(req, res) {
    try {
      const list = await db.query('SELECT * FROM cms_faculty ORDER BY name ASC');
      res.json(list);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async addFaculty(req, res) {
    const { name, designation, department, image_url, bio } = req.body;
    try {
      const result = await db.query(
        'INSERT INTO cms_faculty (name, designation, department, image_url, bio) VALUES (?, ?, ?, ?, ?)',
        [name, designation, department, image_url, bio]
      );
      res.status(201).json({ success: true, id: result.insertId });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async deleteFaculty(req, res) {
    const { id } = req.params;
    try {
      await db.query('DELETE FROM cms_faculty WHERE id=?', [id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // Departments
  async getDepartments(req, res) {
    try {
      const list = await db.query('SELECT * FROM cms_departments ORDER BY name ASC');
      res.json(list);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async addDepartment(req, res) {
    const { name, description, code } = req.body;
    try {
      const result = await db.query(
        'INSERT INTO cms_departments (name, description, code) VALUES (?, ?, ?)',
        [name, description, code]
      );
      res.status(201).json({ success: true, id: result.insertId });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async deleteDepartment(req, res) {
    const { id } = req.params;
    try {
      await db.query('DELETE FROM cms_departments WHERE id=?', [id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // 8. Downloads
  async getDownloads(req, res) {
    try {
      const list = await db.query('SELECT * FROM cms_downloads ORDER BY created_at DESC');
      res.json(list);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async addDownload(req, res) {
    const { title, file_url, category } = req.body;
    try {
      const result = await db.query(
        'INSERT INTO cms_downloads (title, file_url, category) VALUES (?, ?, ?)',
        [title, file_url, category]
      );
      res.status(201).json({ success: true, id: result.insertId });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async deleteDownload(req, res) {
    const { id } = req.params;
    try {
      await db.query('DELETE FROM cms_downloads WHERE id=?', [id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // 9. Lead Submissions (Contact form, Audit request, Recharge bookings)
  async submitLead(req, res) {
    const { name, email, phone, category, details } = req.body;
    const detailsObj = typeof details === 'string' ? JSON.parse(details || '{}') : (details || {});

    try {
      if (!name || !phone || !category) {
        return res.status(400).json({ error: 'Name, phone aur category teenon bhejni jaruri hai bhai!' });
      }

      if (!db.isConnected()) {
        console.warn('⚠️ Server disconnected mode me hai, lead backup locally log ho rahi hai.');
        console.log('Lead Details:', { name, email, phone, category, detailsObj });
        return res.status(201).json({
          success: true,
          message: 'Lead backup recorded locally (offline mode active)'
        });
      }

      let result;
      if (category === 'contact') {
        result = await db.query(
          'INSERT INTO contact (name, email, phone, subject, message) VALUES (?, ?, ?, ?, ?)',
          [name, email, phone, detailsObj.subject || 'General Inquiry', detailsObj.message || '']
        );
      } else if (category === 'audit') {
        result = await db.query(
          'INSERT INTO enquiry (name, email, phone, company, service_type, details) VALUES (?, ?, ?, ?, ?, ?)',
          [name, email, phone, detailsObj.company || 'N/A', detailsObj.division || 'General', detailsObj.details || '']
        );
      } else if (category === 'dish_billing' || category === 'ott_billing') {
        const dbCategory = category === 'dish_billing' ? 'dish' : 'ott';
        result = await db.query(
          `INSERT INTO billing_recharges 
           (customer_name, customer_phone, customer_email, category, pack_name, amount, vc_number, payment_method) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            name, 
            phone, 
            email || null, 
            dbCategory, 
            detailsObj.packName || detailsObj.plan || 'Subscription', 
            parseFloat(detailsObj.amount || 0), 
            detailsObj.vcNumber || null, 
            detailsObj.paymentMethod || 'UPI'
          ]
        );
      }

      res.status(201).json({
        success: true,
        message: 'Lead data dynamic database me successfully connect aur insert ho gayi hai boss! ✅',
        id: result ? result.insertId : null
      });
    } catch (err) {
      console.error('Lead submit error:', err.message);
      res.status(500).json({ error: 'Lead data submit nahi ho paaya, internal error.' });
    }
  }
};
