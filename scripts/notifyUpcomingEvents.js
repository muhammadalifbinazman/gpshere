// ============================================
// Manual Script to Notify Members About Upcoming Events
// ============================================
// Run this script manually: node scripts/notifyUpcomingEvents.js

require('dotenv').config();
const { notifyMembersAboutUpcomingEvents } = require('../src/controllers/notificationController');

console.log('📅 Starting notification process for upcoming events...\n');

notifyMembersAboutUpcomingEvents()
  .then(() => {
    console.log('\n✅ Notification process completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });

