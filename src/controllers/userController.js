// ============================================
// 📋 STEP 7: USER CONTROLLER & ROUTES
// ============================================
// Handles user profile, dashboard, role-based access

const pool = require('../config/database');

// Get user profile
const getUserProfile = async (req, res) => {
  try {
    const userId = req.userId; // Set by verifySession middleware
    const conn = await pool.getConnection();

    const [users] = await conn.query(
      'SELECT id, name, email, role, status, profile_picture, created_at FROM users WHERE id = ?',
      [userId]
    );

    conn.release();

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json(users[0]);
  } catch (error) {
    console.error('Error fetching profile:', error);
    return res.status(500).json({ error: 'Failed to fetch profile' });
  }
};

// Get all users (admin only)
const getAllUsers = async (req, res) => {
  try {
    const conn = await pool.getConnection();

    const [users] = await conn.query(
      'SELECT id, name, email, role, status, created_at FROM users'
    );

    conn.release();

    return res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
};

// Approve user account (admin only)
const approveUser = async (req, res) => {
  try {
    const { userId } = req.body;
    const conn = await pool.getConnection();

   await conn.query(
    "UPDATE users SET status = 'approved', role = 'member' WHERE id = ?",
    [userId]
  );

    conn.release();

    return res.json({ message: 'User approved successfully' });
  } catch (error) {
    console.error('Error approving user:', error);
    return res.status(500).json({ error: 'Failed to approve user' });
  }
};

// Update user status (admin only) - for approve/reject
const updateUserStatus = async (req, res) => {
  try {
    const userId = req.params.userId;
    const { status } = req.body;
    
    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const conn = await pool.getConnection();

    // If approving, also set role to member
    if (status === 'approved') {
      await conn.query(
        "UPDATE users SET status = ?, role = 'member' WHERE id = ?",
        [status, userId]
      );
    } else {
      await conn.query(
        "UPDATE users SET status = ? WHERE id = ?",
        [status, userId]
      );
    }

    conn.release();

    return res.json({ message: `User ${status} successfully` });
  } catch (error) {
    console.error('Error updating user status:', error);
    return res.status(500).json({ error: 'Failed to update user status' });
  }
};

const getMyApplications = async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: 'Not logged in' });

    const [rows] = await pool.query(
      `SELECT 
          ea.id,
          ea.event_id,
          ea.role_id,
          ea.status,
          ea.created_at,
          r.role_name,
          e.event_name
       FROM event_applications ea
       JOIN event_roles r ON ea.role_id = r.id
       JOIN events e ON ea.event_id = e.id
       WHERE ea.user_id = ?
       ORDER BY ea.created_at DESC`,
      [userId]
    );

    res.json(rows);
  } catch (err) {
    console.error("getMyApplications error:", err);
    res.status(500).json({ error: "Failed to fetch applications" });
  }
};

// Change user password
const changePassword = async (req, res) => {
  try {
    const userId = req.userId; // From verifySession middleware
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password required' });
    }

    // Password strength validation
    const bcrypt = require('bcryptjs');
    const passwordRegex = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[\W_]).{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({ 
        error: 'Password must be at least 8 characters and include uppercase, lowercase, number, and symbol' 
      });
    }

    const conn = await pool.getConnection();

    // Get current user
    const [users] = await conn.query('SELECT password FROM users WHERE id = ?', [userId]);
    
    if (users.length === 0) {
      conn.release();
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, users[0].password);
    if (!isValid) {
      conn.release();
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await conn.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);

    conn.release();

    return res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    return res.status(500).json({ error: 'Failed to change password' });
  }
};

// Update user profile (name, email, and profile picture - members can edit their own profile)
const updateProfile = async (req, res) => {
  try {
    const userId = req.userId; // From verifySession middleware
    const name = req.body.name;
    const email = req.body.email;
    const profilePicture = req.file ? `/uploads/profile-pictures/${req.file.filename}` : null;

    // Validate name if provided
    if (name !== undefined) {
      if (!name || name.trim().length < 2) {
        // Delete uploaded file if validation fails
        if (req.file) {
          const fs = require('fs');
          const path = require('path');
          const filePath = path.join(__dirname, '../../public', profilePicture);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }
        return res.status(400).json({ error: 'Name must be at least 2 characters' });
      }
    }

    // Validate email if provided
    if (email !== undefined) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        // Delete uploaded file if validation fails
        if (req.file) {
          const fs = require('fs');
          const path = require('path');
          const filePath = path.join(__dirname, '../../public', profilePicture);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }
        return res.status(400).json({ error: 'Invalid email format' });
      }
    }

    const conn = await pool.getConnection();

    // Get current user data
    const [currentUser] = await conn.query(
      'SELECT name, email, profile_picture FROM users WHERE id = ?',
      [userId]
    );

    if (currentUser.length === 0) {
      conn.release();
      // Delete uploaded file if user not found
      if (req.file) {
        const fs = require('fs');
        const path = require('path');
        const filePath = path.join(__dirname, '../../public', profilePicture);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if email is already taken by another user (if email is being changed)
    if (email !== undefined && email !== currentUser[0].email) {
      const [existingEmail] = await conn.query(
        'SELECT id FROM users WHERE email = ? AND id != ?',
        [email, userId]
      );

      if (existingEmail.length > 0) {
        conn.release();
        // Delete uploaded file if validation fails
        if (req.file) {
          const fs = require('fs');
          const path = require('path');
          const filePath = path.join(__dirname, '../../public', profilePicture);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }
        return res.status(400).json({ error: 'Email is already in use by another account' });
      }
    }

    // Prepare update fields
    const updateFields = [];
    const updateValues = [];

    if (name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(name.trim());
    }

    if (email !== undefined) {
      updateFields.push('email = ?');
      updateValues.push(email.trim());
    }

    if (profilePicture) {
      // Delete old profile picture if it exists
      if (currentUser[0].profile_picture) {
        const fs = require('fs');
        const path = require('path');
        const oldFilePath = path.join(__dirname, '../../public', currentUser[0].profile_picture);
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      }
      updateFields.push('profile_picture = ?');
      updateValues.push(profilePicture);
    }

    if (updateFields.length === 0) {
      conn.release();
      // Delete uploaded file if no updates
      if (req.file) {
        const fs = require('fs');
        const path = require('path');
        const filePath = path.join(__dirname, '../../public', profilePicture);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateValues.push(userId);

    // Update profile
    await conn.query(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    conn.release();

    return res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Error updating profile:', error);
    // Delete uploaded file on error
    if (req.file) {
      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(__dirname, '../../public', `/uploads/profile-pictures/${req.file.filename}`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    return res.status(500).json({ error: 'Failed to update profile' });
  }
};

// Delete user (admin only)
const deleteUser = async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const adminId = req.userId; // Current admin's ID

    if (!userId || isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    // Prevent admin from deleting themselves
    if (userId === adminId) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }

    const conn = await pool.getConnection();

    // Get user info to delete profile picture if exists
    const [users] = await conn.query(
      'SELECT id, profile_picture FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      conn.release();
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[0];

    // Delete profile picture if exists
    if (user.profile_picture) {
      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(__dirname, '../../public', user.profile_picture);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          console.error('Error deleting profile picture:', err);
          // Continue with user deletion even if picture deletion fails
        }
      }
    }

    // Delete user (cascade will handle related records in event_applications and event_feedback)
    await conn.query('DELETE FROM users WHERE id = ?', [userId]);

    conn.release();

    return res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    
    // Handle foreign key constraint errors
    if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.code === '23000') {
      return res.status(400).json({ 
        error: 'Cannot delete user. User has associated records that must be removed first.' 
      });
    }
    
    return res.status(500).json({ error: 'Failed to delete user' });
  }
};

module.exports = {
  getUserProfile,
  getAllUsers,
  approveUser,
  updateUserStatus,
  getMyApplications,
  changePassword,
  updateProfile,
  deleteUser
};
