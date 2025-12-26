// ============================================
// 📋 SESSION-BASED AUTHENTICATION
// ============================================
// Like PHP: req.session['user_id'] = user.id
// Session stored server-side, cookie sent to browser

// Middleware to verify session
const verifySession = (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Not logged in' });
  }
  req.userId = req.session.userId;
  req.userRole = req.session.role;
  next();
};

// Middleware to check user role (for admin, member access)
const checkRole = (requiredRoles) => {
  return async (req, res, next) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'Not logged in' });
    }

    // Refresh role from database to ensure it's up-to-date
    try {
      const pool = require('../config/database');
      const conn = await pool.getConnection();
      const [users] = await conn.query(
        'SELECT role, status FROM users WHERE id = ?',
        [req.session.userId]
      );
      conn.release();

      if (users.length > 0) {
        // Update session with current role from database
        req.session.role = users[0].role;
        req.userRole = users[0].role;
      }
    } catch (error) {
      console.error('Error refreshing user role:', error);
      // Continue with existing session role if refresh fails
    }

    // Check if user's role matches required roles
    if (!requiredRoles.includes(req.session.role)) {
      return res.status(403).json({ 
        error: 'Access denied - insufficient permissions',
        required: requiredRoles,
        current: req.session.role
      });
    }

    next();
  };
};

module.exports = {
  verifySession,
  checkRole
};
