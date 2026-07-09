const os = require('os');
const db = require('../config/db');

module.exports = {
  // System metrics return helper
  async getMetrics() {
    // RAM calculations
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const ramUsedPercent = (((totalMem - freeMem) / totalMem) * 100).toFixed(1);

    // CPU load averages (1 min, 5 min, 15 min)
    const cpuLoad = os.loadavg();
    const cpuUsagePercent = ((cpuLoad[0] / os.cpus().length) * 100).toFixed(1);

    // Default stats if DB is offline
    let dbSizeMb = '0.00';
    let failedLogins = 0;
    let pendingLeads = 0;

    if (db.isConnected()) {
      try {
        // Fetch Database Size
        const dbStats = await db.query(
          `SELECT SUM(data_length + index_length) / 1024 / 1024 AS size 
           FROM information_schema.TABLES 
           WHERE table_schema = ?`,
          [process.env.DB_NAME || 'wss_db']
        );
        dbSizeMb = parseFloat(dbStats[0]?.size || 0).toFixed(2);

        // Fetch failed login count
        const loginStats = await db.query('SELECT COUNT(*) as count FROM login_logs WHERE status = "Failed"');
        failedLogins = loginStats[0]?.count || 0;

        // Fetch pending leads
        const leadStats = await db.query('SELECT COUNT(*) as count FROM billing_recharges WHERE status = "Pending"');
        const contactStats = await db.query('SELECT COUNT(*) as count FROM contact WHERE status = "Pending"');
        const enquiryStats = await db.query('SELECT COUNT(*) as count FROM enquiry WHERE status = "Pending"');
        pendingLeads = (leadStats[0]?.count || 0) + (contactStats[0]?.count || 0) + (enquiryStats[0]?.count || 0);

      } catch (err) {
        console.warn('⚠️ Stats database queries failed. DB offline or tables empty.');
      }
    }

    return {
      cpu: cpuUsagePercent + '%',
      ram: ramUsedPercent + '%',
      storage: '42.1%', // Simulated static storage disk space usage
      dbSize: dbSizeMb + ' MB',
      apiStatus: 'Active',
      emailStatus: 'Active',
      sslStatus: 'Active',
      failedLogins,
      pendingLeads
    };
  }
};
