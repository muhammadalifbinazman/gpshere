// ============================================
// 📋 NOTIFICATIONS ROUTES
// ============================================

const express = require('express');
const { verifySession, checkRole } = require('../middleware/auth');
const {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  notifyMembersAboutUpcomingEvents
} = require('../controllers/notificationController');

const router = express.Router();

// GET /notifications - Get all notifications for current user
router.get('/', verifySession, getNotifications);

// GET /notifications/unread-count - Get unread notification count
router.get('/unread-count', verifySession, getUnreadCount);

// PUT /notifications/:notificationId/read - Mark notification as read
router.put('/:notificationId/read', verifySession, markAsRead);

// PUT /notifications/read-all - Mark all notifications as read
router.put('/read-all', verifySession, markAllAsRead);

// POST /notifications/notify-upcoming - Notify members about upcoming events (admin only)
router.post('/notify-upcoming', verifySession, checkRole(['admin']), async (req, res) => {
  try {
    await notifyMembersAboutUpcomingEvents();
    return res.json({ message: 'Members notified about upcoming events' });
  } catch (error) {
    console.error('Error in notify-upcoming route:', error);
    return res.status(500).json({ error: 'Failed to notify members' });
  }
});

module.exports = router;

