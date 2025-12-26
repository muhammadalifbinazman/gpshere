// ============================================
// 📋 STEP 11: MAIN SERVER FILE
// ============================================
// This is your application entry point (like index.php in PHP)
// Starts Express server and sets up all routes

const express = require('express');
const session = require('express-session');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({
  origin: true, // Allow all origins (for development)
  credentials: true // Allow credentials (cookies, sessions)
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session middleware (like PHP: session_start())
app.use(session({
  secret: process.env.JWT_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Force homepage.html to be the default landing page
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/homepage.html');
});

// Serve static files (CSS, JS)
app.use(express.static('public'));

// Import routes
const authRoutes = require('./src/routes/authRoutes');
const userRoutes = require('./src/routes/userRoutes');
const eventRoutes = require('./src/routes/eventRoutes');
const chatbotRoutes = require('./src/routes/chatbotRoutes');
const notificationRoutes = require('./src/routes/notificationRoutes');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running ✅' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Scheduled job to notify members about upcoming events (runs daily at 9 AM)
const { notifyMembersAboutUpcomingEvents } = require('./src/controllers/notificationController');

// Function to schedule daily notifications
function scheduleUpcomingEventNotifications() {
  // Calculate milliseconds until next 9 AM
  const now = new Date();
  const next9AM = new Date();
  next9AM.setHours(9, 0, 0, 0);
  
  // If it's already past 9 AM today, schedule for tomorrow
  if (now >= next9AM) {
    next9AM.setDate(next9AM.getDate() + 1);
  }
  
  const msUntil9AM = next9AM - now;
  
  setTimeout(() => {
    console.log('📅 Running scheduled notification for upcoming events...');
    notifyMembersAboutUpcomingEvents();
    
    // Schedule next run (24 hours later)
    setInterval(() => {
      console.log('📅 Running scheduled notification for upcoming events...');
      notifyMembersAboutUpcomingEvents();
    }, 24 * 60 * 60 * 1000); // 24 hours
  }, msUntil9AM);
  
  console.log(`⏰ Scheduled upcoming event notifications to run daily at 9 AM`);
}

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log('📚 API Documentation:');
  console.log(`   POST   /api/auth/register      - Register new user`);
  console.log(`   POST   /api/auth/login         - Login user (sends TAC)`);
  console.log(`   POST   /api/auth/verify-tac    - Verify TAC and get token`);
  console.log(`   GET    /api/user/profile       - Get user profile`);
  console.log(`   GET    /api/user/all           - Get all users (admin)`);
  console.log(`   POST   /api/user/approve       - Approve user (admin)`);
  console.log(`   GET    /api/events             - Get all events`);
  console.log(`   GET    /api/events/:id         - Get event details`);
  console.log(`   POST   /api/events             - Create event (admin)`);
  console.log(`   PUT    /api/events/:id         - Update event (admin)`);
  console.log(`   DELETE /api/events/:id         - Delete event (admin)`);
  console.log(`   GET    /api/notifications      - Get notifications`);
  console.log(`   POST   /api/notifications/notify-upcoming - Notify about upcoming events (admin)`);
  console.log(`   POST   /api/chatbot            - Send message to chatbot`);
  
  // Start scheduled notifications
  scheduleUpcomingEventNotifications();
});
