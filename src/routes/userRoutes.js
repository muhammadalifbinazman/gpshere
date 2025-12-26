// ============================================
// 📋 STEP 8: USER ROUTES
// ============================================

const express = require('express');
const { verifySession, checkRole } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { 
  getUserProfile, 
  getAllUsers, 
  approveUser,
  updateUserStatus,
  getMyApplications,
  changePassword,
  updateProfile,
  deleteUser
} = require('../controllers/userController');
const { getAllApplications } = require('../controllers/eventController');

const router = express.Router();

// GET /user/profile - Get logged-in user profile
router.get('/profile', verifySession, getUserProfile);

// PUT /user/profile - Update logged-in user profile (name, email, and profile picture)
router.put('/profile', verifySession, upload.single('profilePicture'), updateProfile);

// GET /user/all - Get all users (admin only)
router.get('/all', verifySession, checkRole(['admin']), getAllUsers);

// POST /user/approve - Approve user (admin only)
router.post('/approve', verifySession, checkRole(['admin']), approveUser);

// PUT /user/:userId - Update user status (admin only)
router.put('/:userId', verifySession, checkRole(['admin']), updateUserStatus);

// DELETE /user/:userId - Delete user (admin only)
router.delete('/:userId', verifySession, checkRole(['admin']), deleteUser);

// GET /user/applications - Get my applications
router.get('/applications', verifySession, getMyApplications);

// GET /user/admin/applications - Get all applications (admin only)
router.get('/admin/applications', verifySession, checkRole(['admin']), getAllApplications);

// POST /user/change-password - Change user password
router.post('/change-password', verifySession, changePassword);

module.exports = router;
