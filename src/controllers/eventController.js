// ============================================
// 📋 STEP 9: EVENTS CONTROLLER
// ============================================
// Replaces event management from your PHP files

const pool = require('../config/database');
const { createNotificationsForAllUsers } = require('./notificationController');

const getAllEvents = async (req, res) => {
  try {
    const conn = await pool.getConnection();

    // 1. Fetch events
    const [events] = await conn.query("SELECT * FROM events ORDER BY event_date DESC");

    // 2. Fetch roles + counts for each event
    for (const event of events) {
      const [roles] = await conn.query(
        "SELECT id AS role_id, role_name, slots FROM event_roles WHERE event_id = ?",
        [event.id]
      );

      for (const r of roles) {
        const [approved] = await conn.query(
          "SELECT COUNT(*) AS cnt FROM event_applications WHERE role_id = ? AND status = 'approved'",
          [r.role_id]
        );
        const [pending] = await conn.query(
          "SELECT COUNT(*) AS cnt FROM event_applications WHERE role_id = ? AND status = 'pending'",
          [r.role_id]
        );

        r.approvedCount = approved[0].cnt || 0;
        r.pendingCount = pending[0].cnt || 0;
      }

      event.roles = roles;
    }

    conn.release();
    return res.json(events);

  } catch (error) {
    console.error("Error fetching events:", error);
    return res.status(500).json({ error: "Failed to fetch events" });
  }
};



// Get single event
const getEventById = async (req, res) => {
  try {
    const { eventId } = req.params;
    const conn = await pool.getConnection();

    const [events] = await conn.query(
      'SELECT * FROM events WHERE id = ?',
      [eventId]
    );

    if (events.length === 0) {
      conn.release();
      return res.status(404).json({ error: 'Event not found' });
    }

    // Get event roles
    const [roles] = await conn.query(
      'SELECT * FROM event_roles WHERE event_id = ?',
      [eventId]
    );

    conn.release();

    return res.json({ ...events[0], roles });
  } catch (error) {
    console.error('Error fetching event:', error);
    return res.status(500).json({ error: 'Failed to fetch event' });
  }
};

// Create event (admin only)
const createEvent = async (req, res) => {
  try {
    console.log('📅 CREATE EVENT REQUEST:', req.body);
    const { event_name, description, event_date, event_time, location, roles } = req.body;

    if (!event_name || !event_date) {
      return res.status(400).json({ error: 'Event name and date required' });
    }

    const conn = await pool.getConnection();

    // Get creator from session
    const createdBy = req.session?.email || req.session?.userId;
    console.log('👤 Created by:', createdBy);

    // 1. Insert event basic info
    const [result] = await conn.query(
      `INSERT INTO events 
       (event_name, description, event_date, event_time, location, created_by, status)
       VALUES (?, ?, ?, ?, ?, ?, 'ongoing')`,
      [event_name, description, event_date, event_time, location, createdBy]
    );

    const eventId = result.insertId;

    // 2. Insert roles into event_roles
    if (Array.isArray(roles) && roles.length > 0) {
      console.log('📝 Inserting roles:', roles);
      for (const r of roles) {
        await conn.query(
          `INSERT INTO event_roles (event_id, role_name, slots)
           VALUES (?, ?, ?)`,
          [eventId, r.role_name, r.slots || r.total_needed]
        );
      }
    } else {
      console.log('⚠️ No roles provided or roles is not an array');
    }

    conn.release();

    console.log('✅ Event created successfully with ID:', eventId);
    
    // Create website notifications for all members about the new event
    const notificationTitle = `New Event: ${event_name}`;
    const notificationMessage = description 
      ? `${description.substring(0, 100)}${description.length > 100 ? '...' : ''}`
      : `A new event "${event_name}" has been created. Check it out!`;
    
    createNotificationsForAllUsers(
      'event',
      notificationTitle,
      notificationMessage,
      eventId
    ).catch(err => {
      console.error('❌ Error creating website notifications:', err);
    });
    
    return res.status(201).json({
      message: 'Event created successfully!',
      eventId
    });

  } catch (error) {
    console.error('Error creating event:', error);
    return res.status(500).json({ error: 'Failed to create event' });
  }
};



// Update event (admin only)
const updateEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { event_name, description, event_date, event_time, location, status, roles } = req.body;

    if (!event_name || !event_date) {
      return res.status(400).json({ error: 'Event name and date are required' });
    }

    const conn = await pool.getConnection();

    // 1. Update event basic info
    await conn.query(
      'UPDATE events SET event_name = ?, description = ?, event_date = ?, event_time = ?, location = ?, status = ? WHERE id = ?',
      [event_name, description, event_date, event_time, location, status || 'ongoing', eventId]
    );

    // 2. Update roles if provided
    if (Array.isArray(roles) && roles.length > 0) {
      // Get existing roles to check which ones to delete
      const [existingRoles] = await conn.query(
        'SELECT id FROM event_roles WHERE event_id = ?',
        [eventId]
      );

      const existingRoleIds = existingRoles.map(r => r.id);
      const providedRoleIds = roles.filter(r => r.id).map(r => r.id);

      // Delete roles that are no longer in the provided list
      const rolesToDelete = existingRoleIds.filter(id => !providedRoleIds.includes(id));
      if (rolesToDelete.length > 0) {
        await conn.query(
          'DELETE FROM event_roles WHERE id IN (?)',
          [rolesToDelete]
        );
      }

      // Update or insert roles
      for (const role of roles) {
        if (role.id) {
          // Update existing role
          await conn.query(
            'UPDATE event_roles SET role_name = ?, slots = ? WHERE id = ?',
            [role.role_name, role.slots || role.total_needed, role.id]
          );
        } else {
          // Insert new role
          await conn.query(
            'INSERT INTO event_roles (event_id, role_name, slots) VALUES (?, ?, ?)',
            [eventId, role.role_name, role.slots || role.total_needed]
          );
        }
      }
    }

    conn.release();

    return res.json({ message: 'Event updated successfully' });
  } catch (error) {
    console.error('Error updating event:', error);
    return res.status(500).json({ error: 'Failed to update event' });
  }
};

// Delete event (admin only)
const deleteEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const conn = await pool.getConnection();

    await conn.query('DELETE FROM events WHERE id = ?', [eventId]);

    conn.release();

    return res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Error deleting event:', error);
    return res.status(500).json({ error: 'Failed to delete event' });
  }
};

// Member apply for event role
const applyForRole = async (req, res) => {
  try {
    const eventId = parseInt(req.params.eventId, 10);
    const { role_id } = req.body;
    const userId = req.session?.userId;

    if (!userId) return res.status(401).json({ error: 'Not logged in' });
    if (!role_id) return res.status(400).json({ error: 'role_id required' });

    const conn = await pool.getConnection();

    // Ensure approved member
    const [users] = await conn.query('SELECT role, status FROM users WHERE id = ?', [userId]);
    const u = users[0];
    if (!u || u.role !== 'member' || u.status !== 'approved') {
      conn.release();
      return res.status(403).json({ error: 'Only approved members can apply' });
    }

    // Ensure role belongs to event
    const [roles] = await conn.query(
      'SELECT id, slots FROM event_roles WHERE id = ? AND event_id = ?',
      [role_id, eventId]
    );
    if (roles.length === 0) {
      conn.release();
      return res.status(404).json({ error: 'Role not found in event' });
    }

    // Check if already applied (only block if pending or approved)
    // Allow re-application if previously rejected
    const [existing] = await conn.query(
      "SELECT id, status FROM event_applications WHERE event_id = ? AND user_id = ? AND role_id = ? AND status IN ('pending','approved')",
      [eventId, userId, role_id]
    );
    if (existing.length > 0) {
      conn.release();
      return res.status(400).json({ error: 'Already applied for this role in this event' });
    }
    
    // If there's a rejected application for this role, allow re-application by creating a new one
    // (We don't update the old one, we create a new application)

    // Create application
    await conn.query(
      "INSERT INTO event_applications (event_id, role_id, user_id, status) VALUES (?, ?, ?, 'pending')",
      [eventId, role_id, userId]
    );

    conn.release();
    return res.status(201).json({ message: 'Application submitted' });

    } catch (err) {
      console.error('applyForRole error:', err);
      return res.status(500).json({ error: 'Failed to apply for role' });
    }
};

//Member cancel for pending role application
const cancelApplication = async (req, res) => {
  try {
    const applicationId = parseInt(req.params.applicationId, 10);
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: 'Not logged in' });

    const conn = await pool.getConnection();

    // Verify application exists, belongs to user and is pending
    const [rows] = await conn.query(
      'SELECT id, user_id, status FROM event_applications WHERE id = ?',
      [applicationId]
    );

    if (rows.length === 0) {
      conn.release();
      return res.status(404).json({ error: 'Application not found' });
    }

    const app = rows[0];
    if (app.user_id !== userId) {
      conn.release();
      return res.status(403).json({ error: 'Not allowed to cancel this application' });
    }

    if (app.status !== 'pending') {
      conn.release();
      return res.status(400).json({ error: 'Only pending applications can be cancelled' });
    }

    // Mark as rejected (acts as cancelled)
    await conn.query("UPDATE event_applications SET status = 'rejected' WHERE id = ?", [applicationId]);

    conn.release();
    return res.json({ message: 'Application cancelled' });
  } catch (err) {
    console.error('cancelApplication error:', err);
    return res.status(500).json({ error: 'Failed to cancel application' });
  }
};

  // MEMBER: SUBMIT EVENT FEEDBACK
  const submitFeedback = async (req, res) => {
  const userId = req.session.userId;
  const eventId = parseInt(req.params.eventId, 10);
  const { rating, comment } = req.body;
  
  if (!userId) {
    return res.status(401).json({ error: 'Not logged in' });
  }
  
  if (!eventId || isNaN(eventId)) {
    return res.status(400).json({ error: 'Invalid event ID' });
  }

  // Convert rating to number and validate
  const ratingNum = parseInt(rating, 10);
  if (!rating || isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return res.status(400).json({ error: 'Rating must be between 1 and 5' });
  }

  try {
    const conn = await pool.getConnection();

    // Prevent duplicate feedback
    const [existing] = await conn.query(
      'SELECT id FROM event_feedback WHERE event_id = ? AND user_id = ?',
      [eventId, userId]
    );

    if (existing.length > 0) {
      conn.release();
      return res.status(400).json({ error: 'Feedback already submitted' });
    }

    await conn.query(
      'INSERT INTO event_feedback (event_id, user_id, rating, comment) VALUES (?, ?, ?, ?)',
      [eventId, userId, ratingNum, comment || null]
    );

    conn.release();
    res.json({ message: 'Feedback submitted successfully' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
};

// Get ALL applications across all events (admin only)
const getAllApplications = async (req, res) => {
  try {
    const conn = await pool.getConnection();

    const [applications] = await conn.query(
      `SELECT 
        ea.id, 
        ea.status, 
        ea.created_at,
        u.name AS user_name, 
        u.email,
        e.event_name,
        er.role_name,
        e.event_date
       FROM event_applications ea
       JOIN users u ON ea.user_id = u.id
       JOIN event_roles er ON ea.role_id = er.id
       JOIN events e ON er.event_id = e.id
       ORDER BY ea.created_at DESC`
    );

    conn.release();
    return res.json(applications);

  } catch (err) {
    console.error('getAllApplications error:', err);
    return res.status(500).json({ error: 'Failed to fetch applications' });
  }
};

// Admin view applications for event roles
const getApplicationsForEvent = async (req, res) => {
  try {
    const eventId = parseInt(req.params.eventId, 10);
    const conn = await pool.getConnection();

    // 1. Fetch roles for the event
    const [roles] = await conn.query(
      "SELECT id AS role_id, role_name, slots FROM event_roles WHERE event_id = ?",
      [eventId]
    );

    const results = [];

    // 2. For each role, fetch applications + approved count
    for (const r of roles) {
      const [apps] = await conn.query(
        `SELECT ea.id, ea.status, ea.created_at,
                u.name, u.email, u.id AS user_id
         FROM event_applications ea
         JOIN users u ON ea.user_id = u.id
         WHERE ea.role_id = ?
         ORDER BY ea.created_at ASC`,
        [r.role_id]
      );

      const [approvedCount] = await conn.query(
        "SELECT COUNT(*) AS cnt FROM event_applications WHERE role_id = ? AND status='approved'",
        [r.role_id]
      );

      results.push({
        role_id: r.role_id,
        role_name: r.role_name,
        slots: r.slots,
        approvedCount: approvedCount[0].cnt || 0,
        applications: apps
      });
    }

    conn.release();
    return res.json({ eventId, roles: results });

  } catch (err) {
    console.error('getApplicationsForEvent error:', err);
    return res.status(500).json({ error: 'Failed to fetch applications' });
  }
};


//Admin approve for event role application
const approveApplication = async (req, res) => {
  try {
    const applicationId = parseInt(req.params.applicationId, 10);
    const conn = await pool.getConnection();

    const [apps] = await conn.query(
      `SELECT ea.role_id, r.slots
       FROM event_applications ea
       JOIN event_roles r ON ea.role_id = r.id
       WHERE ea.id = ?`,
      [applicationId]
    );

    if (apps.length === 0) {
      conn.release();
      return res.status(404).json({ error: 'Application not found' });
    }

    const { role_id, slots } = apps[0];

    // Count approved
    const [count] = await conn.query(
      "SELECT COUNT(*) AS cnt FROM event_applications WHERE role_id = ? AND status='approved'",
      [role_id]
    );

    if (count[0].cnt >= slots) {
      conn.release();
      return res.status(400).json({ error: 'No slots available' });
    }

    // Approve
    await conn.query("UPDATE event_applications SET status='approved' WHERE id=?", [applicationId]);

    conn.release();
    return res.json({ message: 'Application approved' });

  } catch (err) {
    console.error('approveApplication error:', err);
    return res.status(500).json({ error: 'Failed to approve' });
  }
};

//Admin reject for event role application
const rejectApplication = async (req, res) => {
  try {
    const applicationId = parseInt(req.params.applicationId, 10);
    const conn = await pool.getConnection();

    await conn.query("UPDATE event_applications SET status='rejected' WHERE id=?", [applicationId]);

    conn.release();
    return res.json({ message: 'Application rejected' });

  } catch (err) {
    console.error('rejectApplication error:', err);
    return res.status(500).json({ error: 'Failed to reject application' });
  }
};

// Update application status (admin only) - flexible endpoint for approve/reject
const updateApplicationStatus = async (req, res) => {
  try {
    const applicationId = parseInt(req.params.applicationId, 10);
    const { status } = req.body;

    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const conn = await pool.getConnection();

    // If approving, check slot availability
    if (status === 'approved') {
      const [apps] = await conn.query(
        `SELECT ea.role_id, r.slots
         FROM event_applications ea
         JOIN event_roles r ON ea.role_id = r.id
         WHERE ea.id = ?`,
        [applicationId]
      );

      if (apps.length === 0) {
        conn.release();
        return res.status(404).json({ error: 'Application not found' });
      }

      const { role_id, slots } = apps[0];

      // Count approved
      const [count] = await conn.query(
        "SELECT COUNT(*) AS cnt FROM event_applications WHERE role_id = ? AND status='approved'",
        [role_id]
      );

      if (count[0].cnt >= slots) {
        conn.release();
        return res.status(400).json({ error: 'No slots available for this role' });
      }
    }

    // Update status
    await conn.query(
      'UPDATE event_applications SET status = ? WHERE id = ?',
      [status, applicationId]
    );

    conn.release();
    return res.json({ message: `Application ${status} successfully` });

  } catch (err) {
    console.error('updateApplicationStatus error:', err);
    return res.status(500).json({ error: 'Failed to update application status' });
  }
};

// ADMIN: VIEW EVENT FEEDBACK
const getEventFeedback = async (req, res) => {
  const eventId = parseInt(req.params.eventId, 10);

  if (!eventId || isNaN(eventId)) {
    return res.status(400).json({ error: 'Invalid event ID' });
  }

  try {
    const conn = await pool.getConnection();

    // Verify event exists
    const [events] = await conn.query(
      'SELECT id FROM events WHERE id = ?',
      [eventId]
    );

    if (events.length === 0) {
      conn.release();
      return res.status(404).json({ error: 'Event not found' });
    }

    const [feedback] = await conn.query(`
      SELECT u.name, f.rating, f.comment, f.created_at
      FROM event_feedback f
      JOIN users u ON f.user_id = u.id
      WHERE f.event_id = ?
      ORDER BY f.created_at DESC
    `, [eventId]);

    const [avg] = await conn.query(
      'SELECT AVG(rating) AS averageRating FROM event_feedback WHERE event_id = ?',
      [eventId]
    );

    conn.release();

    res.json({
      averageRating: avg[0].averageRating ? parseFloat(avg[0].averageRating) : 0,
      totalFeedback: feedback.length,
      feedback
    });

  } catch (err) {
    console.error('getEventFeedback error:', err);
    res.status(500).json({ error: 'Failed to load feedback' });
  }
};




module.exports = {
  getAllEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  applyForRole,
  getAllApplications,
  getApplicationsForEvent,
  approveApplication,
  rejectApplication,
  cancelApplication,
  updateApplicationStatus,
  submitFeedback,
  getEventFeedback
};
