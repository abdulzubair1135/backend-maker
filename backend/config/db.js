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
    pool = mysql.createPool(dbConfig);
    const conn = await pool.getConnection();
    console.log(`✅ Database connection connect ho gaya hai boss! MySQL is active on: ${dbConfig.host}:${dbConfig.port}`);
    conn.release();
    isConnected = true;
  } catch (err) {
    console.error('❌ Arre yaar! Database connection fail ho gaya. Check karo MySQL chal raha hai ya nahi.');
    console.error('Error ka details ye hai:', err.message);
    console.log('⚠️ Server abhi offline/disconnected mode me chalega. Bina MySQL ke data insert nahi ho payega.');
    isConnected = false;
  }
}

initDb();

module.exports = {
  async query(sql, params) {
    if (!pool) {
      pool = mysql.createPool(dbConfig);
    }
    try {
      const [results] = await pool.query(sql, params);
      return results;
    } catch (err) {
      console.error(`❌ Query error aa gaya bhai: ${sql}`);
      console.error(err);
      throw err;
    }
  },
  
  getPool() {
    return pool;
  },

  isConnected() {
    return isConnected;
  }
};
