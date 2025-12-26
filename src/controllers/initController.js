// ============================================
// 📋 DATABASE INITIALIZATION CONTROLLER - PostgreSQL
// ============================================
// One-time database initialization endpoint
// SECURITY: Only allow in development or with secret token

const bcrypt = require('bcryptjs');
const pool = require('../config/database');

async function initializeDatabase(req, res) {
  // Security check: Only allow if INIT_SECRET matches or in development
  const providedSecret = req.query.secret || req.body.secret;
  const requiredSecret = process.env.INIT_SECRET;
  const isDevelopment = process.env.NODE_ENV !== 'production';

  if (!isDevelopment && (!requiredSecret || providedSecret !== requiredSecret)) {
    return res.status(403).json({ 
      error: 'Unauthorized. Provide ?secret=YOUR_INIT_SECRET or set INIT_SECRET env var.' 
    });
  }

  let conn;
  try {
    console.log('🔄 Starting database initialization via API...');
    
    // Get connection from pool (PostgreSQL compatibility wrapper)
    conn = await pool.getConnection();

    // Helper function to check if column exists
    async function columnExists(tableName, columnName) {
      const [result] = await conn.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = $1 AND column_name = $2
      `, [tableName, columnName]);
      return result && result.length > 0;
    }

    const results = [];

    // 1. Create users table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'student' CHECK (role IN ('student', 'member', 'admin')),
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved')),
        tac_code VARCHAR(10),
        tac_expiry TIMESTAMP,
        reset_code VARCHAR(10),
        reset_expiry TIMESTAMP,
        profile_picture VARCHAR(255) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    results.push('✅ Table users created or exists');

    // Ensure reset columns exist
    if (!(await columnExists('users', 'reset_code'))) {
      await conn.query('ALTER TABLE users ADD COLUMN reset_code VARCHAR(10)');
    }
    if (!(await columnExists('users', 'reset_expiry'))) {
      await conn.query('ALTER TABLE users ADD COLUMN reset_expiry TIMESTAMP');
    }
    results.push('✅ Reset columns ensured on users table');

    // Ensure profile_picture column exists
    if (!(await columnExists('users', 'profile_picture'))) {
      await conn.query('ALTER TABLE users ADD COLUMN profile_picture VARCHAR(255) DEFAULT NULL');
    }
    results.push('✅ Profile picture column ensured on users table');

    // 2. Create events table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        event_name VARCHAR(200) NOT NULL,
        description TEXT,
        event_date DATE,
        event_time TIME,
        location VARCHAR(150),
        director_needed INT DEFAULT 1,
        helper_needed INT DEFAULT 5,
        status VARCHAR(20) DEFAULT 'ongoing' CHECK (status IN ('ongoing', 'finished')),
        created_by VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    results.push('✅ Table events created or exists');

    // 3. Create event_roles table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS event_roles (
        id SERIAL PRIMARY KEY,
        event_id INT NOT NULL,
        role_name VARCHAR(100) NOT NULL,
        slots INT DEFAULT 1,
        FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
      )
    `);
    results.push('✅ Table event_roles created or exists');

    // 4. Create event_applications table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS event_applications (
        id SERIAL PRIMARY KEY,
        event_id INT NOT NULL,
        role_id INT NOT NULL,
        user_id INT NOT NULL,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
        FOREIGN KEY (role_id) REFERENCES event_roles(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    results.push('✅ Table event_applications created or exists');

    // 5. Create event_feedback table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS event_feedback (
        id SERIAL PRIMARY KEY,
        event_id INT NOT NULL,
        user_id INT NOT NULL,
        rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE (event_id, user_id)
      )
    `);
    results.push('✅ Table event_feedback created or exists');

    // 6. Create notifications table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL,
        type VARCHAR(50) NOT NULL DEFAULT 'event',
        title VARCHAR(200) NOT NULL,
        message TEXT,
        related_id INT,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    results.push('✅ Table notifications created or exists');

    // Create indexes for notifications
    await conn.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read)
    `);
    await conn.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at)
    `);
    results.push('✅ Indexes created for notifications table');

    // 7. Create chatbot_knowledge table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS chatbot_knowledge (
        id SERIAL PRIMARY KEY,
        category VARCHAR(100) NOT NULL,
        keywords TEXT NOT NULL,
        response TEXT NOT NULL,
        suggestions TEXT,
        priority INT DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    results.push('✅ Table chatbot_knowledge created or exists');

    // Create indexes for chatbot_knowledge
    await conn.query(`
      CREATE INDEX IF NOT EXISTS idx_chatbot_category ON chatbot_knowledge(category)
    `);
    await conn.query(`
      CREATE INDEX IF NOT EXISTS idx_chatbot_active ON chatbot_knowledge(is_active)
    `);
    await conn.query(`
      CREATE INDEX IF NOT EXISTS idx_chatbot_priority ON chatbot_knowledge(priority)
    `);
    results.push('✅ Indexes created for chatbot_knowledge table');

    // Create trigger function for updated_at (PostgreSQL equivalent of ON UPDATE CURRENT_TIMESTAMP)
    await conn.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    // Create trigger for chatbot_knowledge updated_at
    await conn.query(`
      DROP TRIGGER IF EXISTS update_chatbot_knowledge_updated_at ON chatbot_knowledge;
      CREATE TRIGGER update_chatbot_knowledge_updated_at
      BEFORE UPDATE ON chatbot_knowledge
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    `);
    results.push('✅ Trigger created for chatbot_knowledge updated_at');

    // 8. Insert default admin if not exists
    const [admins] = await conn.query(
      "SELECT * FROM users WHERE email = $1",
      ['admin@gpsphere.com']
    );

    if (admins.length === 0) {
      const hashedPassword = await bcrypt.hash('Admin123!', 10);
      await conn.query(
        "INSERT INTO users (name, email, password, role, status) VALUES ($1, $2, $3, $4, $5)",
        ['System Admin', 'admin@gpsphere.com', hashedPassword, 'admin', 'approved']
      );
      results.push('✅ Default admin created (Email: admin@gpsphere.com | Password: Admin123!)');
    } else {
      results.push('ℹ️  Admin account already exists');
    }

    // 9. Populate initial chatbot knowledge if empty
    const [knowledgeCount] = await conn.query("SELECT COUNT(*) as count FROM chatbot_knowledge");
    
    if (parseInt(knowledgeCount[0].count) === 0) {
      const initialKnowledge = [
        {
          category: 'greeting',
          keywords: 'hi,hello,hey,greetings,good morning,good afternoon,good evening',
          response: '👋 Hello! I\'m the GPS UTM Assistant. How can I help you today?',
          suggestions: 'What is GPS UTM?|How do I register?|Tell me about events',
          priority: 10
        },
        {
          category: 'gps_info',
          keywords: 'gps,what is gps,gps utm,gerakan pengguna siswa',
          response: '🌍 **GPS UTM** (Gerakan Pengguna Siswa) is the Student Consumer Movement at Universiti Teknologi Malaysia.\n\nWe empower students to become smart, ethical, and responsible consumers through:\n• Educational workshops\n• Consumer rights awareness\n• Community events\n• Student advocacy\n\nGPSphere is our digital platform for managing members, events, and activities!',
          suggestions: 'How do I join?|What events are available?|How do I register?',
          priority: 9
        },
        {
          category: 'registration',
          keywords: 'register,sign up,create account,how to register',
          response: '📝 **Registration Process:**\n\n1. Click on "Register" or go to the registration page\n2. Fill in your details (name, email, password)\n3. Make sure your password is strong (8+ characters, uppercase, lowercase, number, symbol)\n4. Submit your registration\n5. Wait for admin approval (usually 1-2 business days)\n6. You\'ll receive an email notification once approved!\n\nOnce approved, you\'ll become a GPS member and can participate in events!',
          suggestions: 'What is TAC?|How do I login?|What happens after registration?',
          priority: 8
        },
        {
          category: 'login_tac',
          keywords: 'login,sign in,tac,authentication code',
          response: '🔐 **Login & TAC System:**\n\n**TAC** stands for "Time Authentication Code" - it\'s a 6-digit security code sent to your email.\n\n**Login Steps:**\n1. Enter your email and password\n2. Click "Login"\n3. Check your email for the TAC code\n4. Enter the TAC code (expires in 15 minutes)\n5. You\'re in! 🎉\n\n**Note:** In test mode, the TAC appears on screen instead of email.',
          suggestions: 'I didn\'t receive TAC|Forgot password|How to change password?',
          priority: 8
        },
        {
          category: 'events',
          keywords: 'event,activities,what events,upcoming',
          response: '📅 You can view all available events on your dashboard after logging in!\n\nEvents include workshops, competitions, and community activities.',
          suggestions: 'How do I join an event?|What roles are available?|How to apply?',
          priority: 7
        },
        {
          category: 'join_event',
          keywords: 'join,apply,participate,how to join event',
          response: '🎉 **How to Join an Event:**\n\n1. **Login** to your member dashboard\n2. **Browse** available events\n3. **Select** an event you\'re interested in\n4. **Choose** a role (Director, Helper, Technical Crew, etc.)\n5. **Click** "Apply" on your desired role\n6. **Wait** for admin approval\n7. You\'ll be notified once approved! ✅\n\n**Note:** You must be an approved member to join events.',
          suggestions: 'What roles are available?|How long does approval take?|Can I apply for multiple roles?',
          priority: 7
        },
        {
          category: 'roles',
          keywords: 'role,position,crew,director,helper',
          response: '💼 **Available Event Roles:**\n\nEvents typically have various roles you can apply for:\n\n• **Director** - Overall event coordination\n• **Secretary** - Documentation and administration\n• **Technical Crew** - Setup and technical support\n• **Helper** - General assistance and support\n• **Publicity** - Marketing and promotion\n\nEach event may have different roles and requirements. Check the event details for specific roles available!',
          suggestions: 'How do I apply?|What are the requirements?|Can I apply for multiple roles?',
          priority: 6
        },
        {
          category: 'contact',
          keywords: 'contact,help,support,email,phone',
          response: '📞 **Contact GPS UTM:**\n\nYou can reach us through:\n\n• **Email:** info@gpsphere.com\n• **GPS Room:** Visit the GPS office at UTM\n• **Social Media:** Follow our official pages\n• **Website:** Use the contact form\n\nFor urgent matters, please visit the GPS room during office hours.',
          suggestions: 'Where is the GPS room?|What are office hours?|How to report an issue?',
          priority: 6
        },
        {
          category: 'status',
          keywords: 'status,approval,pending,approved,when will',
          response: '⏳ **Account Status:**\n\nAfter registration, your account status is "Pending" until an admin reviews and approves it.\n\n**Timeline:**\n• Registration submitted → Pending\n• Admin review → Usually 1-2 business days\n• Approval → You become a member! ✅\n\nYou can check your status on your dashboard. You\'ll also receive an email notification when approved!',
          suggestions: 'How long does it take?|What if I\'m rejected?|How to check status?',
          priority: 5
        },
        {
          category: 'password',
          keywords: 'password,forgot password,reset password',
          response: '🔑 **Password Help:**\n\n**Password Requirements:**\n• At least 8 characters\n• One uppercase letter\n• One lowercase letter\n• One number\n• One special symbol\n\n**If you forgot your password:**\nPlease contact the admin or visit the GPS room for password reset assistance.',
          suggestions: 'How to change password?|Contact admin|What if I\'m locked out?',
          priority: 5
        },
        {
          category: 'thanks',
          keywords: 'thanks,thank you,ty,appreciate,grateful',
          response: '😊 You\'re welcome! Is there anything else I can help you with?',
          suggestions: 'Tell me about events|How to register?|Contact information',
          priority: 4
        },
        {
          category: 'goodbye',
          keywords: 'bye,goodbye,see you,farewell,exit,quit',
          response: '👋 Goodbye! Feel free to come back if you have any questions. Have a great day!',
          suggestions: '',
          priority: 3
        }
      ];

      for (const knowledge of initialKnowledge) {
        await conn.query(
          "INSERT INTO chatbot_knowledge (category, keywords, response, suggestions, priority) VALUES ($1, $2, $3, $4, $5)",
          [knowledge.category, knowledge.keywords, knowledge.response, knowledge.suggestions, knowledge.priority]
        );
      }
      results.push(`✅ Inserted ${initialKnowledge.length} chatbot knowledge entries`);
    } else {
      results.push('ℹ️  Chatbot knowledge already exists');
    }

    conn.release();

    res.json({
      success: true,
      message: 'Database initialized successfully!',
      results: results
    });

  } catch (error) {
    if (conn) conn.release();
    console.error('❌ Database initialization error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.code
    });
  }
}

module.exports = { initializeDatabase };
