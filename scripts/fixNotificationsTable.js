// ============================================
// Fix Notifications Table - Add Missing Columns
// ============================================

const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixNotificationsTable() {
  let conn;
  try {
    conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'gpsphere_db',
      port: parseInt(process.env.DB_PORT || '3306')
    });

    console.log('🔧 Fixing notifications table...\n');

    // Check if columns exist and add them if they don't
    const [columns] = await conn.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'notifications'",
      [process.env.DB_NAME || 'gpsphere_db']
    );

    const existingColumns = columns.map(c => c.COLUMN_NAME);
    console.log('Existing columns:', existingColumns.join(', '));

    // Add type column if it doesn't exist
    if (!existingColumns.includes('type')) {
      await conn.query(`
        ALTER TABLE notifications 
        ADD COLUMN type VARCHAR(50) NOT NULL DEFAULT 'event' AFTER user_id
      `);
      console.log('✅ Added "type" column');
    } else {
      console.log('ℹ️  "type" column already exists');
    }

    // Add title column if it doesn't exist
    if (!existingColumns.includes('title')) {
      await conn.query(`
        ALTER TABLE notifications 
        ADD COLUMN title VARCHAR(200) NOT NULL DEFAULT 'Notification' AFTER type
      `);
      console.log('✅ Added "title" column');
    } else {
      console.log('ℹ️  "title" column already exists');
    }

    // Add related_id column if it doesn't exist
    if (!existingColumns.includes('related_id')) {
      await conn.query(`
        ALTER TABLE notifications 
        ADD COLUMN related_id INT NULL AFTER message
      `);
      console.log('✅ Added "related_id" column');
    } else {
      console.log('ℹ️  "related_id" column already exists');
    }

    // Add indexes if they don't exist
    try {
      await conn.query(`
        CREATE INDEX IF NOT EXISTS idx_user_read ON notifications(user_id, is_read)
      `);
      console.log('✅ Added index idx_user_read');
    } catch (err) {
      if (err.code !== 'ER_DUP_KEYNAME') {
        throw err;
      }
      console.log('ℹ️  Index idx_user_read already exists');
    }

    try {
      await conn.query(`
        CREATE INDEX IF NOT EXISTS idx_created_at ON notifications(created_at)
      `);
      console.log('✅ Added index idx_created_at');
    } catch (err) {
      if (err.code !== 'ER_DUP_KEYNAME') {
        throw err;
      }
      console.log('ℹ️  Index idx_created_at already exists');
    }

    // Show final structure
    const [finalStructure] = await conn.query('DESCRIBE notifications');
    console.log('\n📋 Final notifications table structure:');
    finalStructure.forEach(col => {
      console.log(`   ${col.Field} - ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Default ? `DEFAULT ${col.Default}` : ''}`);
    });

    await conn.end();
    console.log('\n✅ Notifications table fixed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (conn) await conn.end();
    process.exit(1);
  }
}

fixNotificationsTable();

