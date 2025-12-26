// ============================================
// 📋 STEP 5: AUTHENTICATION CONTROLLER
// ============================================
// This replaces login.php and register.php
// Contains all authentication logic

const pool = require('../config/database');
const bcrypt = require('bcryptjs');
const { sendTACEmail, sendWelcomeEmail, sendResetEmail } = require('../utils/email');
require('dotenv').config();

// ========== REGISTER USER ==========
const register = async (req, res) => {
  try {
    const { name, email, password, confirm } = req.body;

    // Validation
    if (!name || !email || !password || !confirm) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Password match check
    if (password !== confirm) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    // Password strength validation
    const passwordRegex = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[\W_]).{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({ 
        error: 'Password must be at least 8 characters and include uppercase, lowercase, number, and symbol' 
      });
    }

    // Get connection from pool
    const conn = await pool.getConnection();

    // Check if email already exists
    const [rows] = await conn.query('SELECT id FROM users WHERE email = ?', [email]);
    if (rows.length > 0) {
      conn.release();
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new user
    await conn.query(
      'INSERT INTO users (name, email, password, role, status) VALUES (?, ?, ?, ?, ?)',
      [name, email, hashedPassword, 'student', 'pending']
    );

    conn.release();

    // Send welcome email
    await sendWelcomeEmail(email, name);

    return res.status(201).json({ 
      message: 'Registration successful! Your account is pending admin approval.' 
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Registration failed' });
  }
};

// ========== LOGIN - STEP 1: VERIFY EMAIL & PASSWORD ==========
const login = async (req, res) => {
  let conn;
  try {
    console.log('🔐 LOGIN REQUEST RECEIVED:', { body: req.body, path: req.path, method: req.method });
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Get connection from pool with retry logic
    let retries = 3;
    while (retries > 0) {
      try {
        conn = await pool.getConnection();
        break;
      } catch (err) {
        retries--;
        if (retries === 0) throw err;
        console.log(`⚠️ Connection failed, retrying... (${3 - retries}/3)`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Find user by email
    const [users] = await conn.query('SELECT * FROM users WHERE email = ?', [email]);
    console.log("🟩 Login Request Body:", req.body);
    console.log("🟩 DB User Lookup Result:", users);

    if (users.length > 0) {
      console.log("🟩 Password entered:", password);
      console.log("🟩 Stored hash:", users[0].password);
      console.log("🟩 bcrypt.compare result:", await bcrypt.compare(password, users[0].password));
    }

    if (users.length === 0) {
      if (conn) conn.release();
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const user = users[0];

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      if (conn) conn.release();
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    // Check if account is approved
    if (user.status !== 'approved') {
      if (conn) conn.release();
      return res.status(403).json({ 
        error: 'Your account is pending admin approval. Please contact the administrator.' 
      });
    }

    // Generate 6-digit TAC code
    const tacCode = Math.floor(100000 + Math.random() * 900000);
    const tacExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes from now

    // Save TAC in database
    await conn.query(
      'UPDATE users SET tac_code = ?, tac_expiry = ? WHERE id = ?',
      [tacCode, tacExpiry, user.id]
    );

    conn.release();

    // Send TAC via email
    const result =  await sendTACEmail(email, tacCode);

     // TEST MODE → Return TAC directly (no email)
    if (result.test) {
    return res.json({
    message: "TAC generated (TEST MODE). No email sent.",
    requireTAC: true,
    tac: result.tac  // for easy testing
  });
}

    // (Normal) Return message (don't send token yet - user must verify TAC)
    return res.json({ 
      message: 'TAC code sent to your email. Please verify to complete login.',
      requiresTAC: true
    });
  } catch (error) {
    console.error('Login error:', error);
    // Ensure connection is released even on error
    if (conn) {
      try {
        conn.release();
      } catch (releaseError) {
        console.error('Error releasing connection:', releaseError);
      }
    }
    
    // Provide more specific error messages
    if (error.code === 'ECONNRESET' || error.code === 'ECONNREFUSED') {
      return res.status(503).json({ 
        error: 'Database connection error. Please try again in a moment.',
        details: 'The database connection was reset. This may be temporary.'
      });
    }
    
    return res.status(500).json({ 
      error: 'Login failed. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ========== FORGOT PASSWORD - SEND RESET CODE ==========
const forgotPassword = async (req, res) => {
  let conn;
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    conn = await pool.getConnection();

    // Find user
    const [users] = await conn.query('SELECT id, name FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      conn.release();
      // Do not reveal if email exists
      return res.json({ message: 'If an account exists, a reset code has been sent.' });
    }

    const user = users[0];

    // Generate reset code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const resetExpiry = new Date(Date.now() + 15 * 60 * 1000);

    // Save reset code
    await conn.query(
      'UPDATE users SET reset_code = ?, reset_expiry = ? WHERE id = ?',
      [resetCode, resetExpiry, user.id]
    );

    conn.release();

    // Send reset email (or return code in test mode)
    const result = await sendResetEmail(email, resetCode);
    if (result.test) {
      return res.json({
        message: 'Reset code generated (TEST MODE). No email sent.',
        resetCode
      });
    }

    return res.json({ message: 'Password reset code sent to your email.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    if (conn) {
      try { conn.release(); } catch (_) {}
    }
    return res.status(500).json({ error: 'Failed to process password reset request.' });
  }
};

// ========== RESET PASSWORD ==========
const resetPassword = async (req, res) => {
  let conn;
  try {
    const { email, code, newPassword, confirm } = req.body;

    if (!email || !code || !newPassword || !confirm) {
      return res.status(400).json({ error: 'Email, code, and new password are required.' });
    }

    if (newPassword !== confirm) {
      return res.status(400).json({ error: 'Passwords do not match.' });
    }

    // Password strength validation
    const passwordRegex = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[\W_]).{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters and include uppercase, lowercase, number, and symbol'
      });
    }

    conn = await pool.getConnection();

    // Fetch user and reset code
    const [users] = await conn.query(
      'SELECT id, reset_code, reset_expiry FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      conn.release();
      return res.status(400).json({ error: 'Invalid email or code.' });
    }

    const user = users[0];

    // Validate code
    if (!user.reset_code || user.reset_code !== code) {
      conn.release();
      return res.status(400).json({ error: 'Invalid reset code.' });
    }

    // Validate expiry
    if (!user.reset_expiry || new Date(user.reset_expiry) < new Date()) {
      conn.release();
      return res.status(400).json({ error: 'Reset code has expired.' });
    }

    // Update password and clear reset code
    const hashed = await bcrypt.hash(newPassword, 10);
    await conn.query(
      'UPDATE users SET password = ?, reset_code = NULL, reset_expiry = NULL WHERE id = ?',
      [hashed, user.id]
    );

    conn.release();

    return res.json({ message: 'Password reset successful. You can now log in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    if (conn) {
      try { conn.release(); } catch (_) {}
    }

    if (error.code === 'ECONNRESET' || error.code === 'ECONNREFUSED') {
      return res.status(503).json({
        error: 'Database connection error. Please try again shortly.'
      });
    }

    return res.status(500).json({ error: 'Failed to reset password.' });
  }
};

// ========== VERIFY TAC - STEP 2: COMPLETE LOGIN ==========
const verifyTAC = async (req, res) => {
  try {
    const { email, tac_code } = req.body;

    if (!email || !tac_code) {
      return res.status(400).json({ error: 'Email and TAC code required' });
    }

    const conn = await pool.getConnection();

    // Find user and verify TAC
    const [users] = await conn.query(
      'SELECT * FROM users WHERE email = ? AND tac_code = ?',
      [email, tac_code]
    );

    if (users.length === 0) {
      conn.release();
      return res.status(400).json({ error: 'Invalid TAC code' });
    }

    const user = users[0];

    // Check if TAC expired
    if (new Date() > new Date(user.tac_expiry)) {
      conn.release();
      return res.status(400).json({ error: 'TAC code expired. Please login again.' });
    }

    // TAC verified - clear TAC
    await conn.query(
      'UPDATE users SET tac_code = NULL, tac_expiry = NULL WHERE id = ?',
      [user.id]
    );

    conn.release();

    // Store user in session (like PHP: $_SESSION['userId'] = user.id)
    req.session.userId = user.id;
    req.session.email = user.email;
    req.session.role = user.role;
    req.session.name = user.name;

    return res.json({ 
      message: 'Login successful',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('TAC verification error:', error);
    return res.status(500).json({ error: 'TAC verification failed' });
  }
};

//LOGOUT USER
const logout = (req, res) => {
  try {
    if (req.session) {
      req.session.destroy(err => {
        if (err) {
          console.error("Logout error:", err);
          return res.status(500).json({ error: "Logout failed" });
        }

        // Remove session cookie
        res.clearCookie("connect.sid");
        return res.json({ message: "Logged out successfully" });
      });
    } else {
      return res.status(200).json({ message: "No active session" });
    }
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json({ error: "Logout failed" });
  }
};


module.exports = {
  register,
  login,
  verifyTAC,
  logout,
  forgotPassword,
  resetPassword
};
