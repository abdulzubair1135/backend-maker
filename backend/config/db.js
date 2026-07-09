const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'wss_db',
  port: parseInt(process.env.DB_PORT || '3306'),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

let pool;
let isConnected = false;

async function initDb() {
  try {
    // Test connection
    pool = mysql.createPool(dbConfig);
    const conn = await pool.getConnection();
    console.log(`✅ Database Connected successfully to MySQL (${dbConfig.host}:${dbConfig.port}/${dbConfig.database})`);
    conn.release();
    isConnected = true;
  } catch (err) {
    console.error('❌ Database connection failed. Please check if your MySQL server is running.');
    console.error('Error Details:', err.message);
    console.log('⚠️ Running in disconnected mode. Dynamic queries will fail until MySQL is started.');
    isConnected = false;
  }
}

// Automatic initialization
initDb();

module.exports = {
  // Query helper with error handling
  async query(sql, params) {
    if (!pool) {
      pool = mysql.createPool(dbConfig);
    }
    try {
      const [results] = await pool.query(sql, params);
      return results;
    } catch (err) {
      console.error(`Database query error: ${sql}`);
      console.error(err);
      throw err;
    }
  },
  
  // Direct pool access
  getPool() {
    return pool;
  },

  isConnected() {
    return isConnected;
  }
};
