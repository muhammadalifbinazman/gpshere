// ============================================
// 📋 STEP 1: DATABASE CONFIGURATION
// ============================================
// This replaces your PHP config.php
// This file sets up the MySQL connection pool
// Configured for external MySQL services (PlanetScale, Railway, etc.)

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
  acquireTimeout: 30000, // Timeout for getting connection from pool (30 seconds)
  timeout: 30000, // Query timeout (30 seconds)
  connectTimeout: 30000 // Connection timeout (30 seconds) - important for cloud databases
};

// Enable SSL for cloud databases if DB_SSL is set to 'true'
if (process.env.DB_SSL === 'true') {
  poolConfig.ssl = {
    rejectUnauthorized: false // For most cloud providers (PlanetScale, Railway, etc.)
  };
  console.log('🔒 SSL enabled for database connection');
}

const pool = mysql.createPool(poolConfig);

// Test connection with better error handling
pool.getConnection()
  .then(conn => {
    console.log('✅ Connected to MySQL database');
    console.log(`   Host: ${poolConfig.host}:${poolConfig.port}`);
    console.log(`   Database: ${poolConfig.database}`);
    conn.release();
  })
  .catch(err => {
    console.error('❌ Database connection failed:', err.message);
    console.error('   Error code:', err.code);
    console.error('   Error type:', err.errno);
    
    // Show current configuration (without password)
    console.error('\n📋 Current Database Configuration:');
    console.error(`   Host: ${poolConfig.host || 'NOT SET'}`);
    console.error(`   Port: ${poolConfig.port || 'NOT SET'}`);
    console.error(`   User: ${poolConfig.user || 'NOT SET'}`);
    console.error(`   Database: ${poolConfig.database || 'NOT SET'}`);
    console.error(`   SSL: ${poolConfig.ssl ? 'Enabled' : 'Disabled'}`);
    
    console.error('\n💡 Troubleshooting tips:');
    
    if (err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED') {
      console.error('   ⚠️  Connection timeout/refused - This usually means:');
      console.error('   1. Database host is incorrect or unreachable');
      console.error('   2. Database is not running or not accessible from Render');
      console.error('   3. Firewall is blocking the connection');
      console.error('   4. Wrong port number (MySQL uses 3306)');
      console.error('   5. SSL required but not enabled (set DB_SSL=true)');
      console.error('\n   For External MySQL Services:');
      console.error('   - PlanetScale: Use connection string, ensure SSL enabled');
      console.error('   - Railway: Check connection string format');
      console.error('   - Aiven: Verify service is running, check connection details');
      console.error('   - Ensure DB_SSL=true is set for cloud databases');
    } else if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('   ⚠️  Access denied - Check DB_USER and DB_PASSWORD');
    } else if (err.code === 'ER_BAD_DB_ERROR') {
      console.error('   ⚠️  Database does not exist - Run initialization script');
    }
    
    console.error('\n   General steps:');
    console.error('   1. Verify all DB_* environment variables in Render dashboard');
    console.error('   2. Check database is running and accessible');
    console.error('   3. For cloud databases, ensure DB_SSL=true');
    console.error('   4. Initialize database: Visit /api/init-db?secret=YOUR_SECRET');
    
    // Don't exit in development - allow server to start and show error
    // process.exit(1);
  });

module.exports = pool;
