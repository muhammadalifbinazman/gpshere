// ============================================
// 📋 NOTIFICATIONS CONTROLLER
// ============================================

const pool = require('../config/database');

// Get all notifications for the current user
const getNotifications = async (req, res) => {
  try {
    const userId = req.session?.userId || req.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Not logged in' });
    }

    const conn = await pool.getConnection();
    
    try {
      const [notifications] = await conn.query(
        `SELECT id, type, title, message, related_id, is_read, created_at
         FROM notifications
         WHERE user_id = ?
         ORDER BY created_at DESC
         LIMIT 50`,
        [userId]
      );

      conn.release();
      return res.json(notifications);
    } catch (tableError) {
      conn.release();
      if (tableError.code === 'ER_NO_SUCH_TABLE') {
        return res.status(500).json({ 
          error: 'Notifications table not found. Please contact administrator.'
        });
      }
      throw tableError;
    }
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

// Get unread notification count
const getUnreadCount = async (req, res) => {
  try {
    const userId = req.session?.userId || req.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Not logged in' });
    }

    const conn = await pool.getConnection();
    
    try {
      const [result] = await conn.query(
        'SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = FALSE',
        [userId]
      );

      conn.release();
      return res.json({ count: result[0].count || 0 });
    } catch (tableError) {
      conn.release();
      if (tableError.code === 'ER_NO_SUCH_TABLE') {
        return res.json({ count: 0 });
      }
      throw tableError;
    }
  } catch (error) {
    console.error('Error fetching unread count:', error);
    return res.status(500).json({ error: 'Failed to fetch unread count' });
  }
};

// Mark notification as read
const markAsRead = async (req, res) => {
  try {
    const userId = req.session?.userId || req.userId;
    const { notificationId } = req.params;
    
    if (!userId) {
      return res.status(401).json({ error: 'Not logged in' });
    }

    const conn = await pool.getConnection();
    
    const [notifications] = await conn.query(
      'SELECT id FROM notifications WHERE id = ? AND user_id = ?',
      [notificationId, userId]
    );

    if (notifications.length === 0) {
      conn.release();
      return res.status(404).json({ error: 'Notification not found' });
    }

    await conn.query(
      'UPDATE notifications SET is_read = TRUE WHERE id = ?',
      [notificationId]
    );

    conn.release();
    return res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return res.status(500).json({ error: 'Failed to mark notification as read' });
  }
};

// Mark all notifications as read
const markAllAsRead = async (req, res) => {
  try {
    const userId = req.session?.userId || req.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Not logged in' });
    }

    const conn = await pool.getConnection();
    
    await conn.query(
      'UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE',
      [userId]
    );

    conn.release();
    return res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
};

// Create notification (internal helper function)
const createNotification = async (userId, type, title, message, relatedId = null) => {
  try {
    const conn = await pool.getConnection();
    
    await conn.query(
      `INSERT INTO notifications (user_id, type, title, message, related_id, is_read)
       VALUES (?, ?, ?, ?, ?, FALSE)`,
      [userId, type, title, message, relatedId]
    );

    conn.release();
  } catch (error) {
    console.error('Error creating notification:', error);
  }
};

// Create notifications for all members about upcoming events
const notifyMembersAboutUpcomingEvents = async () => {
  let conn = null;
  try {
    conn = await pool.getConnection();
    
    // Check if notifications table exists
    try {
      await conn.query('SELECT 1 FROM notifications LIMIT 1');
    } catch (tableError) {
      if (tableError.code === 'ER_NO_SUCH_TABLE') {
        console.error('❌ Notifications table does not exist! Please run: node scripts/initDb.js');
        if (conn) conn.release();
        return;
      }
      throw tableError;
    }
    
    // Get upcoming events (events happening in the next 7 days)
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    
    const [upcomingEvents] = await conn.query(
      `SELECT id, event_name, description, event_date, event_time, location
       FROM events
       WHERE event_date >= ? AND event_date <= ? AND status = 'ongoing'
       ORDER BY event_date ASC`,
      [today.toISOString().split('T')[0], nextWeek.toISOString().split('T')[0]]
    );
    
    if (upcomingEvents.length === 0) {
      console.log('ℹ️  No upcoming events in the next 7 days');
      if (conn) conn.release();
      return;
    }
    
    // Get all members (approved members only)
    const [members] = await conn.query(
      "SELECT id, name, email FROM users WHERE role = 'member' AND status = 'approved'"
    );
    
    if (members.length === 0) {
      console.log('ℹ️  No approved members found');
      if (conn) conn.release();
      return;
    }
    
    console.log(`📅 Found ${upcomingEvents.length} upcoming event(s) in the next 7 days`);
    console.log(`👥 Notifying ${members.length} members about upcoming events`);
    
    let totalNotifications = 0;
    
    // Create notifications for each upcoming event
    for (const event of upcomingEvents) {
      const eventDate = new Date(event.event_date);
      const daysUntil = Math.ceil((eventDate - today) / (1000 * 60 * 60 * 24));
      
      let title, message;
      
      if (daysUntil === 0) {
        title = `🎉 Event Today: ${event.event_name}`;
        message = `Don't miss it! "${event.event_name}" is happening today${event.event_time ? ` at ${event.event_time}` : ''}${event.location ? ` at ${event.location}` : ''}.`;
      } else if (daysUntil === 1) {
        title = `📅 Event Tomorrow: ${event.event_name}`;
        message = `Reminder: "${event.event_name}" is happening tomorrow${event.event_time ? ` at ${event.event_time}` : ''}${event.location ? ` at ${event.location}` : ''}.`;
      } else {
        title = `📅 Upcoming Event: ${event.event_name}`;
        message = `"${event.event_name}" is happening in ${daysUntil} days${event.event_time ? ` at ${event.event_time}` : ''}${event.location ? ` at ${event.location}` : ''}.`;
      }
      
      if (event.description) {
        const shortDesc = event.description.length > 100 
          ? event.description.substring(0, 100) + '...' 
          : event.description;
        message += ` ${shortDesc}`;
      }
      
      // Check if notification already exists for this event (to avoid duplicates)
      for (const member of members) {
        const [existing] = await conn.query(
          `SELECT id FROM notifications 
           WHERE user_id = ? AND type = 'upcoming_event' AND related_id = ? 
           AND DATE(created_at) = CURDATE()`,
          [member.id, event.id]
        );
        
        if (existing.length === 0) {
          await conn.query(
            `INSERT INTO notifications (user_id, type, title, message, related_id, is_read)
             VALUES (?, 'upcoming_event', ?, ?, ?, FALSE)`,
            [member.id, title, message, event.id]
          );
          totalNotifications++;
        }
      }
    }
    
    if (conn) conn.release();
    console.log(`✅ Created ${totalNotifications} notifications for upcoming events`);
    
  } catch (error) {
    console.error('❌ Error notifying members about upcoming events:', error);
    if (conn) conn.release();
  }
};

// Create notifications for all users (internal helper function)
const createNotificationsForAllUsers = async (type, title, message, relatedId = null) => {
  let conn = null;
  try {
    conn = await pool.getConnection();
    
    // Check if notifications table exists
    try {
      await conn.query('SELECT 1 FROM notifications LIMIT 1');
    } catch (tableError) {
      if (tableError.code === 'ER_NO_SUCH_TABLE') {
        console.error('❌ Notifications table does not exist! Please run: node scripts/initDb.js');
        if (conn) conn.release();
        return;
      }
      throw tableError;
    }
    
    // Fetch all users (or just members if type is 'event')
    let users;
    if (type === 'event') {
      // For events, notify all members
      [users] = await conn.query(
        "SELECT id, name, email, role FROM users WHERE role = 'member' AND status = 'approved'"
      );
    } else {
      // For other types, notify all users
      [users] = await conn.query('SELECT id, name, email, role FROM users');
    }
    
    if (users.length === 0) {
      console.log('⚠️ No users found to send notifications to');
      if (conn) conn.release();
      return;
    }
    
    console.log(`📧 Creating notifications for ${users.length} users (type: ${type}, title: ${title})`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const user of users) {
      try {
        await conn.query(
          `INSERT INTO notifications (user_id, type, title, message, related_id, is_read)
           VALUES (?, ?, ?, ?, ?, FALSE)`,
          [user.id, type, title, message, relatedId]
        );
        successCount++;
      } catch (insertError) {
        errorCount++;
        console.error(`❌ Failed to create notification for user ${user.id} (${user.email}):`, insertError.message);
      }
    }

    if (conn) conn.release();
    console.log(`✅ Created ${successCount} notifications successfully, ${errorCount} failed`);
  } catch (error) {
    console.error('❌ Error creating notifications for all users:', error);
    if (conn) conn.release();
  }
};

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  createNotification,
  createNotificationsForAllUsers,
  notifyMembersAboutUpcomingEvents
};

