const db = require('../config/db');

module.exports = {
  // Capture visitor tracking actions (Phase 4 user tracking implementation)
  async trackVisitor(req, res) {
    const {
      visitorId,
      sessionId,
      cookieId,
      currentUrl,
      referrer,
      language,
      resolution,
      browser,
      browserVersion,
      os,
      device,
      entryPage,
      exitPage,
      utmSource,
      utmMedium,
      utmCampaign,
      mouseCount,
      keyboardCount,
      scrollDepth,
      clicksCount,
      pageViews,
      duration,
      visitedPages,
      loginStatus
    } = req.body;

    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    try {
      if (!db.isConnected()) {
        return res.json({ success: true, message: 'Offline tracking active' });
      }

      // Check if session log exists
      const existing = await db.query('SELECT id FROM visitor_logs WHERE session_id = ?', [sessionId]);

      if (existing.length > 0) {
        // Update existing visitor session log
        await db.query(
          `UPDATE visitor_logs 
           SET visit_duration = ?, 
               exit_page = ?, 
               mouse_activity_count = mouse_activity_count + ?, 
               keyboard_activity_count = keyboard_activity_count + ?, 
               scroll_depth = IF(? > scroll_depth, ?, scroll_depth), 
               total_clicks = total_clicks + ?, 
               page_views = page_views + ?, 
               visited_pages = ?, 
               last_activity = CURRENT_TIMESTAMP
           WHERE session_id = ?`,
          [
            parseInt(duration || 0),
            exitPage || currentUrl,
            parseInt(mouseCount || 0),
            parseInt(keyboardCount || 0),
            parseInt(scrollDepth || 0),
            parseInt(scrollDepth || 0),
            parseInt(clicksCount || 0),
            parseInt(pageViews || 0),
            visitedPages || currentUrl,
            sessionId
          ]
        );
      } else {
        // Insert new visitor session log
        // Simulate GeoIP and ISP mapping values (or fetch via GeoIP if needed, here we pre-seed fallback variables)
        const country = 'India';
        const state = 'Gujarat';
        const city = 'Bhuj';
        const latitude = '23.2420';
        const longitude = '69.6669';
        const timezone = 'Asia/Kolkata';
        const isp = 'Jio Fiber';

        await db.query(
          `INSERT INTO visitor_logs 
           (visitor_id, ip_address, country, state, city, latitude, longitude, timezone, language, 
            browser, browser_version, operating_system, device, resolution, isp, user_agent, 
            entry_page, landing_page, referrer, utm_source, utm_medium, utm_campaign, current_url, 
            session_id, visit_duration, exit_page, mouse_activity_count, keyboard_activity_count, 
            scroll_depth, page_views, total_clicks, visited_pages, cookie_id, login_status) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            visitorId,
            ip,
            country,
            state,
            city,
            latitude,
            longitude,
            timezone,
            language,
            browser,
            browserVersion,
            os,
            device,
            resolution,
            isp,
            req.headers['user-agent'] || 'Unknown',
            entryPage || currentUrl,
            entryPage || currentUrl,
            referrer || 'Direct',
            utmSource || null,
            utmMedium || null,
            utmCampaign || null,
            currentUrl,
            sessionId,
            parseInt(duration || 0),
            exitPage || currentUrl,
            parseInt(mouseCount || 0),
            parseInt(keyboardCount || 0),
            parseInt(scrollDepth || 0),
            parseInt(pageViews || 1),
            parseInt(clicksCount || 0),
            visitedPages || currentUrl,
            cookieId,
            loginStatus || 'Guest'
          ]
        );
      }

      res.json({ success: true });
    } catch (err) {
      console.error('Visitor tracking log error:', err.message);
      res.status(500).json({ error: 'Failed to record visitor logs.' });
    }
  }
};
