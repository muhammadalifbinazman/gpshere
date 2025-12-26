// ============================================
// 📋 AI CHATBOT CONTROLLER
// ============================================
// Enhanced chatbot with AI-like responses and conversation handling
// Now uses database-backed knowledge with fallback to hardcoded responses

const pool = require('../config/database');

// Helper function to calculate match score for a keyword
const calculateMatchScore = (message, keyword) => {
  const lowerMessage = message.toLowerCase().trim();
  const lowerKeyword = keyword.toLowerCase().trim();
  
  // Exact match gets highest score
  if (lowerMessage === lowerKeyword) {
    return 100;
  }
  
  // Word boundary matches (exact word match)
  const wordBoundaryRegex = new RegExp(`\\b${lowerKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  if (wordBoundaryRegex.test(lowerMessage)) {
    return 80;
  }
  
  // Starts with keyword
  if (lowerMessage.startsWith(lowerKeyword + ' ')) {
    return 70;
  }
  
  // Ends with keyword
  if (lowerMessage.endsWith(' ' + lowerKeyword)) {
    return 60;
  }
  
  // Contains keyword as whole word (with spaces)
  if (lowerMessage.includes(' ' + lowerKeyword + ' ')) {
    return 50;
  }
  
  // Partial match (contains keyword anywhere)
  if (lowerMessage.includes(lowerKeyword)) {
    // Longer keywords get higher score for partial matches
    return Math.min(40, lowerKeyword.length * 2);
  }
  
  return 0;
};

// Helper function to find matching knowledge from database
const findMatchingKnowledge = async (message) => {
  try {
    // Get all active knowledge entries, ordered by priority
    const [knowledgeEntries] = await pool.query(
      "SELECT * FROM chatbot_knowledge WHERE is_active = TRUE ORDER BY priority DESC"
    );

    if (!knowledgeEntries || knowledgeEntries.length === 0) {
      return null;
    }

    const lowerMessage = message.toLowerCase().trim();
    let bestMatch = null;
    let bestScore = 0;

    // Check each knowledge entry for keyword matches
    for (const entry of knowledgeEntries) {
      if (!entry.keywords) continue;
      
      const keywords = entry.keywords.split(',').map(k => k.trim()).filter(k => k.length > 0);
      
      // Check each keyword and find the best match score for this entry
      let entryBestScore = 0;
      for (const keyword of keywords) {
        const score = calculateMatchScore(lowerMessage, keyword);
        if (score > entryBestScore) {
          entryBestScore = score;
        }
      }
      
      // If we found a match, consider priority in the final score
      if (entryBestScore > 0) {
        // Combine match score with priority (priority adds up to 10 points)
        const finalScore = entryBestScore + (entry.priority || 0);
        
        // Only update if this is a better match
        if (finalScore > bestScore) {
          bestScore = finalScore;
          bestMatch = entry;
        }
      }
    }

    // Only return if we have a reasonable match (score > 30)
    return bestScore > 30 ? bestMatch : null;
  } catch (error) {
    console.error('Error fetching chatbot knowledge:', error);
    return null;
  }
};

// Helper function to parse suggestions string
const parseSuggestions = (suggestionsString) => {
  if (!suggestionsString || !suggestionsString.trim()) {
    return [];
  }
  return suggestionsString.split('|').map(s => s.trim()).filter(s => s.length > 0);
};

// Fallback hardcoded responses (used when database is unavailable or no match found)
const getFallbackResponse = (lowerMessage) => {
  let response = '';
  let suggestions = [];

  // Greetings and casual conversation - check first for exact matches
  if (lowerMessage.match(/^(hi|hello|hey|greetings|good morning|good afternoon|good evening)/i)) {
    response = '👋 Hello! I\'m the GPS UTM Assistant. How can I help you today?';
    suggestions = ['What is GPS UTM?', 'How do I register?', 'Tell me about events'];
  }
  // GPS UTM Information
  else if (lowerMessage.match(/\b(gps|gps utm|gerakan pengguna siswa|what is gps)\b/i)) {
    response = '🌍 **GPS UTM** (Gerakan Pengguna Siswa) is the Student Consumer Movement at Universiti Teknologi Malaysia.\n\n' +
               'We empower students to become smart, ethical, and responsible consumers through:\n' +
               '• Educational workshops\n' +
               '• Consumer rights awareness\n' +
               '• Community events\n' +
               '• Student advocacy\n\n' +
               'GPSphere is our digital platform for managing members, events, and activities!';
    suggestions = ['How do I join?', 'What events are available?', 'How do I register?'];
  }
  // Registration
  else if (lowerMessage.match(/\b(register|sign up|create account|how to register|registration)\b/i)) {
    response = '📝 **Registration Process:**\n\n' +
               '1. Click on "Register" or go to the registration page\n' +
               '2. Fill in your details (name, email, password)\n' +
               '3. Make sure your password is strong (8+ characters, uppercase, lowercase, number, symbol)\n' +
               '4. Submit your registration\n' +
               '5. Wait for admin approval (usually 1-2 business days)\n' +
               '6. You\'ll receive an email notification once approved!\n\n' +
               'Once approved, you\'ll become a GPS member and can participate in events!';
    suggestions = ['What is TAC?', 'How do I login?', 'What happens after registration?'];
  }
  // Login and TAC
  else if (lowerMessage.match(/\b(login|sign in|tac|authentication code|time authentication code)\b/i)) {
    response = '🔐 **Login & TAC System:**\n\n' +
               '**TAC** stands for "Time Authentication Code" - it\'s a 6-digit security code sent to your email.\n\n' +
               '**Login Steps:**\n' +
               '1. Enter your email and password\n' +
               '2. Click "Login"\n' +
               '3. Check your email for the TAC code\n' +
               '4. Enter the TAC code (expires in 15 minutes)\n' +
               '5. You\'re in! 🎉\n\n' +
               '**Note:** In test mode, the TAC appears on screen instead of email.';
    suggestions = ['I didn\'t receive TAC', 'Forgot password', 'How to change password?'];
  }
  // Thank you
  else if (lowerMessage.match(/^(thanks|thank you|ty|appreciate|grateful)/i)) {
    response = '😊 You\'re welcome! Is there anything else I can help you with?';
    suggestions = ['Tell me about events', 'How to register?', 'Contact information'];
  }
  // Goodbye
  else if (lowerMessage.match(/^(bye|goodbye|see you|farewell|exit|quit)/i)) {
    response = '👋 Goodbye! Feel free to come back if you have any questions. Have a great day!';
    suggestions = [];
  }
  // Default - AI-like response
  else {
    if (lowerMessage.match(/\b(how|what|when|where|why|who)\b/i)) {
      response = '🤔 I understand you\'re asking about something. Let me help you!\n\n' +
                 'I can assist you with:\n' +
                 '• GPS UTM information\n' +
                 '• Registration process\n' +
                 '• Login and TAC\n' +
                 '• Events and activities\n' +
                 '• Joining events\n' +
                 '• Contact information\n\n' +
                 'Could you rephrase your question or try one of the suggestions below?';
    } else {
      response = '🤖 I\'m the GPS UTM Assistant! I can help you with:\n\n' +
                 '📌 **Information:**\n' +
                 '• What is GPS UTM?\n' +
                 '• How to register\n' +
                 '• Login and TAC system\n\n' +
                 '📅 **Events:**\n' +
                 '• Available events\n' +
                 '• How to join events\n' +
                 '• Event roles\n\n' +
                 '💬 **Support:**\n' +
                 '• Contact information\n' +
                 '• Account status\n' +
                 '• Password help\n\n' +
                 'What would you like to know?';
    }
    suggestions = ['What is GPS UTM?', 'How do I register?', 'Tell me about events', 'Contact information'];
  }

  return { response, suggestions };
};

const getChatbotResponse = async (req, res) => {
  try {
    const { message, conversationId } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message required' });
    }

    const lowerMessage = message.toLowerCase().trim();
    let response = '';
    let suggestions = [];

    // Special handling for events - check knowledge base first, then fetch real events
    const isEventQuery = lowerMessage.match(/\b(event|events|activities|upcoming|what events|event schedule)\b/i);
    
    if (isEventQuery) {
      // First try knowledge base for event-related responses
      const knowledge = await findMatchingKnowledge(message);
      
      if (knowledge && knowledge.category === 'events') {
        // Use knowledge base response, but enhance with real events if available
        response = knowledge.response;
        suggestions = parseSuggestions(knowledge.suggestions);
        
        // Try to fetch real events to enhance the response
        try {
          const [events] = await pool.query(
            "SELECT event_name, description, event_date, location FROM events WHERE status = 'ongoing' ORDER BY event_date ASC LIMIT 5"
          );
          
          if (events.length > 0) {
            response = '📅 **Upcoming Events:**\n\n';
            events.forEach((event, index) => {
              const date = event.event_date ? new Date(event.event_date).toLocaleDateString() : 'TBA';
              response += `${index + 1}. **${event.event_name}**\n`;
              if (event.description) response += `   ${event.description.substring(0, 100)}...\n`;
              response += `   📍 ${event.location || 'TBA'}\n`;
              response += `   📆 ${date}\n\n`;
            });
            response += 'Visit your dashboard to see all events and apply for roles!';
          }
        } catch (err) {
          console.error('Error fetching events:', err);
          // Keep the knowledge base response
        }
      } else {
        // No knowledge base match, try to fetch real events
        try {
          const [events] = await pool.query(
            "SELECT event_name, description, event_date, location FROM events WHERE status = 'ongoing' ORDER BY event_date ASC LIMIT 5"
          );
          
          if (events.length > 0) {
            response = '📅 **Upcoming Events:**\n\n';
            events.forEach((event, index) => {
              const date = event.event_date ? new Date(event.event_date).toLocaleDateString() : 'TBA';
              response += `${index + 1}. **${event.event_name}**\n`;
              if (event.description) response += `   ${event.description.substring(0, 100)}...\n`;
              response += `   📍 ${event.location || 'TBA'}\n`;
              response += `   📆 ${date}\n\n`;
            });
            response += 'Visit your dashboard to see all events and apply for roles!';
            suggestions = ['How do I join an event?', 'What roles are available?', 'How to apply?'];
          } else {
            // No events, use knowledge base or fallback
            if (knowledge) {
              response = knowledge.response;
              suggestions = parseSuggestions(knowledge.suggestions);
            } else {
              response = '📅 Currently, there are no upcoming events scheduled.\n\n' +
                         'Check back later or visit your dashboard to see when new events are posted!\n\n' +
                         'Events typically include:\n' +
                         '• Workshops and training sessions\n' +
                         '• Consumer awareness campaigns\n' +
                         '• Community service activities\n' +
                         '• Networking events';
              suggestions = ['How do I join an event?', 'What roles are available?', 'How to apply?'];
            }
          }
        } catch (err) {
          console.error('Error fetching events:', err);
          // Use knowledge base or fallback
          if (knowledge) {
            response = knowledge.response;
            suggestions = parseSuggestions(knowledge.suggestions);
          } else {
            response = '📅 You can view all available events on your dashboard after logging in!\n\n' +
                       'Events include workshops, competitions, and community activities.';
            suggestions = ['How do I join an event?', 'What roles are available?', 'How to apply?'];
          }
        }
      }
      
      // Ensure suggestions are set
      if (suggestions.length === 0) {
        suggestions = ['How do I join an event?', 'What roles are available?', 'How to apply?'];
      }
    } else {
      // For non-event queries, try knowledge base first
      const knowledge = await findMatchingKnowledge(message);
      
      if (knowledge) {
        // Use database response
        response = knowledge.response;
        suggestions = parseSuggestions(knowledge.suggestions);
      } else {
        // Fallback to hardcoded responses
        const fallback = getFallbackResponse(lowerMessage);
        response = fallback.response;
        suggestions = fallback.suggestions;
      }
    }

    // Add a small delay to simulate AI thinking (optional)
    await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 500));

    return res.json({ 
      reply: response,
      suggestions: suggestions,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Chatbot error:', error);
    
    // Final fallback on error
    const lowerMessage = (req.body.message || '').toLowerCase().trim();
    const fallback = getFallbackResponse(lowerMessage);
    
    return res.status(500).json({ 
      error: 'Sorry, I encountered an error. Please try again or contact support.',
      reply: fallback.response || '❌ I\'m having trouble processing that. Could you try rephrasing your question?',
      suggestions: fallback.suggestions || ['What is GPS UTM?', 'How do I register?', 'Tell me about events']
    });
  }
};

module.exports = {
  getChatbotResponse
};
