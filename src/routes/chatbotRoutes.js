// ============================================
// 📋 STEP 14: CHATBOT ROUTES
// ============================================

const express = require('express');
const { getChatbotResponse } = require('../controllers/chatbotController');

const router = express.Router();

// POST /api/chatbot - Send message to chatbot
router.post('/', getChatbotResponse);

module.exports = router;
