// ============================================
// 📋 STEP 1: DATABASE CONFIGURATION
// ============================================
// This replaces your PHP config.php
// This file sets up the MySQL connection pool

const mysql = require('mysql2/promise');
require('dotenv').config();

console.log('Database config:', {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME
});

// Create a connection pool (better than single connection)
const poolConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gpsphere_db',
  port: parseInt(process.env.DB_PORT || '3306'),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  reconnect: true,
  idleTimeout: 60000, // Close idle connections after 60 seconds
  timezone: 'local',
  acquireTimeout: 60000, // Timeout for getting connection from pool
  timeout: 60000 // Query timeout
};

// Enable SSL for cloud databases if DB_SSL is set to 'true'
if (process.env.DB_SSL === 'true') {
  poolConfig.ssl = {
    rejectUnauthorized: false // For most cloud providers
  };
}

const pool = mysql.createPool(poolConfig);

// Test connection
pool.getConnection()
  .then(conn => {
    console.log('✅ Connected to MySQL database');
    conn.release();
  })
  .catch(err => {
    console.error('❌ Database connection failed:', err.message);
    console.error('💡 Troubleshooting tips:');
    console.error('   1. Make sure MySQL/XAMPP is running');
    console.error('   2. Check your .env file exists in GSphere/ directory');
    console.error('   3. Verify DB_HOST, DB_USER, DB_PASSWORD, DB_PORT, and DB_NAME');
    console.error('   4. Run: npm run init-db (from root) or node scripts/initDb.js (from GSphere/)');
    console.error('   5. If using XAMPP, default port is 3306 (not 3307)');
    // Don't exit in development - allow server to start and show error
    // process.exit(1);
  });

module.exports = pool;
