// ============================================
// 📋 CHATBOT ADMIN ROUTES
// ============================================
// Admin routes for chatbot knowledge management

const express = require('express');
const { verifySession, checkRole } = require('../middleware/auth');
const {
  getAllKnowledge,
  getKnowledgeById,
  createKnowledge,
  updateKnowledge,
  deleteKnowledge,
  toggleKnowledgeStatus
} = require('../controllers/chatbotAdminController');

const router = express.Router();

// All routes require admin authentication
router.use(verifySession);
router.use(checkRole(['admin']));

// GET /api/admin/chatbot - Get all chatbot knowledge entries
router.get('/', getAllKnowledge);

// GET /api/admin/chatbot/:id - Get single knowledge entry
router.get('/:id', getKnowledgeById);

// POST /api/admin/chatbot - Create new knowledge entry
router.post('/', createKnowledge);

// PUT /api/admin/chatbot/:id - Update knowledge entry
router.put('/:id', updateKnowledge);

// DELETE /api/admin/chatbot/:id - Delete knowledge entry
router.delete('/:id', deleteKnowledge);

// PATCH /api/admin/chatbot/:id/toggle - Toggle active status
router.patch('/:id/toggle', toggleKnowledgeStatus);

module.exports = router;

