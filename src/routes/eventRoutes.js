// ============================================
// 📋 STEP 10: EVENTS ROUTES
// ============================================

const express = require('express');
const { verifySession, checkRole } = require('../middleware/auth');
const { 
  getAllEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  applyForRole,
  getApplicationsForEvent,
  approveApplication,
  rejectApplication,
  cancelApplication,
  updateApplicationStatus,
  submitFeedback,
  getEventFeedback
} = require('../controllers/eventController');

const router = express.Router();
// GET /events - Get all events
router.get('/', getAllEvents);

// POST /events - Create event (admin)
router.post('/', verifySession, checkRole(['admin']), createEvent);

// POST /events/applications/:applicationId/approve
router.post('/applications/:applicationId/approve', verifySession, checkRole(['admin']), approveApplication);

// POST /events/applications/:applicationId/reject
router.post('/applications/:applicationId/reject', verifySession, checkRole(['admin']), rejectApplication);

// PUT /events/applications/:applicationId
router.put('/applications/:applicationId', verifySession, checkRole(['admin']), updateApplicationStatus);

// DELETE /events/applications/:applicationId
router.delete('/applications/:applicationId', verifySession, checkRole(['member']), cancelApplication);

// GET /events/:eventId/applications (must come before /:eventId)
router.get('/:eventId/applications', verifySession, checkRole(['admin']), getApplicationsForEvent);

// POST /events/:eventId/apply (must come before /:eventId)
router.post('/:eventId/apply', verifySession, checkRole(['member']), applyForRole);

// GET /events/:eventId/feedback (must come before /:eventId)
router.get('/:eventId/feedback', verifySession, checkRole(['admin']), getEventFeedback);

// POST /events/:eventId/feedback (must come before /:eventId)
router.post('/:eventId/feedback', verifySession, checkRole(['member']), submitFeedback);

// GET /events/:eventId - Get single event (must come last to avoid matching specific routes)
router.get('/:eventId', getEventById);

// PUT /events/:eventId - Update event (admin)
router.put('/:eventId', verifySession, checkRole(['admin']), updateEvent);

// DELETE /events/:eventId - Delete event (admin)
router.delete('/:eventId', verifySession, checkRole(['admin']), deleteEvent);

module.exports = router;
