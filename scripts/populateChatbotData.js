// ============================================
// 📋 CHATBOT KNOWLEDGE POPULATION SCRIPT
// ============================================
// Run this script to populate or update chatbot knowledge data
// Usage: node scripts/populateChatbotData.js

const mysql = require('mysql2/promise');
require('dotenv').config();

async function populateChatbotData() {
  let conn;
  try {
    console.log('Starting chatbot knowledge population...');
    
    // Connect to MySQL
    conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'gpsphere_db',
      port: parseInt(process.env.DB_PORT || '3306')
    });

    console.log('✅ Connected to database');

    // Check if table exists
    const [tables] = await conn.query(
      "SHOW TABLES LIKE 'chatbot_knowledge'"
    );

    if (tables.length === 0) {
      console.log('❌ chatbot_knowledge table does not exist. Please run initDb.js first.');
      process.exit(1);
    }

    // Define knowledge entries based on actual system environment
    const knowledgeEntries = [
      {
        category: 'greeting',
        keywords: 'hi,hello,hey,greetings,good morning,good afternoon,good evening,hai,salam',
        response: '👋 Hello! I\'m the GPS UTM Assistant for GPSphere. How can I help you today?\n\nI can assist you with:\n• Registration and account setup\n• Login and TAC authentication\n• Event information and applications\n• Dashboard navigation\n• Profile management\n\nWhat would you like to know?',
        suggestions: 'What is GPS UTM?|How do I register?|Tell me about events|How do I login?',
        priority: 10
      },
      {
        category: 'gps_info',
        keywords: 'gps,what is gps,gps utm,gerakan pengguna siswa,what is gpsphere,gpsphere',
        response: '🌍 **GPS UTM** (Gerakan Pengguna Siswa) is the Student Consumer Movement at Universiti Teknologi Malaysia.\n\n**About GPSphere:**\nGPSphere is our digital platform that helps manage:\n• Member registrations and approvals\n• Event creation and management\n• Event role applications\n• User dashboards (Admin, Member, Student)\n• Notifications and updates\n\n**Our Mission:**\nWe empower students to become smart, ethical, and responsible consumers through:\n• Educational workshops\n• Consumer rights awareness\n• Community events\n• Student advocacy\n\nJoin us and make a difference!',
        suggestions: 'How do I join?|What events are available?|How do I register?|What are the benefits?',
        priority: 9
      },
      {
        category: 'registration',
        keywords: 'register,sign up,create account,how to register,registration process,new account',
        response: '📝 **Registration Process on GPSphere:**\n\n1. **Go to Registration Page**\n   • Visit the login/register page\n   • Click on "Register" tab\n\n2. **Fill in Your Details**\n   • Full Name\n   • Email address (use your UTM email if possible)\n   • Password (must meet requirements)\n\n3. **Password Requirements**\n   • At least 8 characters\n   • One uppercase letter (A-Z)\n   • One lowercase letter (a-z)\n   • One number (0-9)\n   • One special symbol (!@#$%^&*)\n\n4. **Submit Registration**\n   • Click "Register" button\n   • Your account will be created with "Student" role\n   • Status will be "Pending" until admin approval\n\n5. **Wait for Approval**\n   • Admin will review your registration\n   • Usually takes 1-2 business days\n   • You\'ll receive an email notification when approved\n\n6. **After Approval**\n   • Your role changes from "Student" to "Member"\n   • You can now access the Member Dashboard\n   • You can apply to events and participate in activities!\n\n**Note:** Until approved, you\'ll have limited access as a Student.',
        suggestions: 'What is TAC?|How do I login?|What happens after registration?|How long does approval take?',
        priority: 8
      },
      {
        category: 'login_tac',
        keywords: 'login,sign in,tac,authentication code,time authentication code,how to login,login process',
        response: '🔐 **Login & TAC System on GPSphere:**\n\n**What is TAC?**\nTAC stands for "Time Authentication Code" - it\'s a 6-digit security code sent to your email for two-factor authentication.\n\n**Login Steps:**\n1. **Enter Credentials**\n   • Go to login page\n   • Enter your registered email\n   • Enter your password\n\n2. **Click Login**\n   • System will send a TAC code to your email\n   • TAC expires in 15 minutes\n\n3. **Check Your Email**\n   • Look for email from GPSphere\n   • Find the 6-digit TAC code\n   • **Note:** In test mode, TAC appears on screen instead\n\n4. **Enter TAC Code**\n   • Enter the 6-digit code\n   • Click "Verify TAC"\n\n5. **Access Dashboard**\n   • You\'ll be redirected based on your role:\n     - **Admin** → Admin Dashboard\n     - **Member** → Member Dashboard\n     - **Student** → Student Dashboard (limited access)\n\n**Security:**\n• TAC codes expire after 15 minutes\n• Each TAC can only be used once\n• If you don\'t receive TAC, check spam folder or request a new one',
        suggestions: 'I didn\'t receive TAC|Forgot password|How to change password?|What if TAC expired?',
        priority: 8
      },
      {
        category: 'user_roles',
        keywords: 'role,user role,admin role,member role,student role,what is my role,role difference',
        response: '👥 **User Roles in GPSphere:**\n\n**1. Student (Pending Status)**\n• Default role after registration\n• Status: "Pending" until admin approval\n• Can view events (read-only)\n• Cannot apply to events yet\n• Limited dashboard access\n• Must wait for admin approval\n\n**2. Member (Approved)**\n• Role after admin approval\n• Status: "Approved"\n• Full access to Member Dashboard\n• Can browse all events\n• Can apply to event roles\n• Can view own applications\n• Can update profile\n• Receives notifications\n\n**3. Admin**\n• System administrators\n• Full system access\n• Can create/manage events\n• Can approve/reject users\n• Can approve/reject applications\n• Access to analytics\n• System settings management\n• Chatbot knowledge management\n\n**Role Progression:**\nStudent (Pending) → Admin Approval → Member (Approved)',
        suggestions: 'How do I become a member?|What can members do?|How to check my status?',
        priority: 7
      },
      {
        category: 'events',
        keywords: 'event,events,activities,what events,upcoming events,event list,available events',
        response: '📅 **Events on GPSphere:**\n\n**Viewing Events:**\n• **Members:** Full access to browse all events in Member Dashboard\n• **Students:** Can view events but cannot apply (read-only)\n• **Admins:** Can view, create, edit, and delete events\n\n**Event Information Includes:**\n• Event name and description\n• Date and time\n• Location\n• Available roles (Director, Secretary, Helper, Technical Crew, etc.)\n• Number of slots per role\n• Event status (Ongoing/Finished)\n\n**Event Types:**\n• Workshops and training sessions\n• Consumer awareness campaigns\n• Community service activities\n• Networking events\n• Educational programs\n\n**Note:** Real-time event data is fetched from the database. Check your dashboard for the latest events!',
        suggestions: 'How do I join an event?|What roles are available?|How to apply?|How to create an event?',
        priority: 7
      },
      {
        category: 'join_event',
        keywords: 'join,apply,participate,how to join event,how to apply,apply to event,event application',
        response: '🎉 **How to Join an Event on GPSphere:**\n\n**Prerequisites:**\n• You must be an **approved Member** (not Student)\n• Your account status must be "Approved"\n• You must be logged in\n\n**Application Steps:**\n1. **Login to Member Dashboard**\n   • Access your dashboard after login\n   • Navigate to "Browse Events" section\n\n2. **Browse Available Events**\n   • View all ongoing events\n   • Check event details (date, time, location)\n   • See available roles for each event\n\n3. **Select an Event**\n   • Click on an event card to see details\n   • Review event information\n   • Check available roles and slots\n\n4. **Choose a Role**\n   • Select from available roles:\n     - Director\n     - Secretary\n     - Technical Crew\n     - Helper\n     - Publicity\n     - Or custom roles defined by admin\n\n5. **Apply for Role**\n   • Click "Apply" button on your desired role\n   • Confirm your application\n\n6. **Wait for Admin Approval**\n   • Application status: "Pending"\n   • Admin will review your application\n   • Usually takes 1-3 business days\n\n7. **Receive Notification**\n   • You\'ll be notified when status changes\n   • Check "My Applications" section for updates\n   • Status: Pending → Approved/Rejected\n\n**Note:** Students cannot apply until their account is approved by admin.',
        suggestions: 'What roles are available?|How long does approval take?|Can I apply for multiple roles?|Check application status',
        priority: 7
      },
      {
        category: 'roles',
        keywords: 'role,position,crew,director,helper,secretary,technical crew,event roles,available roles',
        response: '💼 **Event Roles in GPSphere:**\n\n**Common Event Roles:**\n\n• **Director**\n  - Overall event coordination\n  - Leadership and management\n  - Usually 1 slot per event\n\n• **Secretary**\n  - Documentation and administration\n  - Meeting minutes and records\n  - Communication coordination\n\n• **Technical Crew**\n  - Setup and technical support\n  - Equipment management\n  - Audio/visual setup\n\n• **Helper**\n  - General assistance and support\n  - Event logistics\n  - Multiple slots usually available\n\n• **Publicity**\n  - Marketing and promotion\n  - Social media management\n  - Event promotion\n\n**Role Features:**\n• Each role has specific slot limits\n• You can apply for multiple roles in different events\n• You can only be approved for one role per event\n• Role requirements vary by event\n• Check event details for specific roles available\n\n**Applying:**\n• Browse events in your dashboard\n• Select an event\n• Choose a role with available slots\n• Click "Apply" and wait for admin approval',
        suggestions: 'How do I apply?|What are the requirements?|Can I apply for multiple roles?|Application status',
        priority: 6
      },
      {
        category: 'dashboard',
        keywords: 'dashboard,my dashboard,admin dashboard,member dashboard,student dashboard,how to use dashboard',
        response: '📊 **GPSphere Dashboards:**\n\n**1. Member Dashboard** (Blue Theme)\n**Features:**\n• View available events\n• Browse events with details\n• Apply to event roles\n• Track your applications\n• View application status\n• Update profile\n• View notifications\n• Statistics cards (events, applications)\n\n**Sections:**\n• Dashboard (overview)\n• Browse Events\n• My Applications\n• Profile\n\n**2. Admin Dashboard** (Orange Theme)\n**Features:**\n• Create and manage events\n• Approve/reject user registrations\n• Approve/reject event applications\n• View all users with filters\n• View all applications\n• Analytics and insights\n• System settings\n• Chatbot knowledge management\n\n**Sections:**\n• Dashboard (statistics)\n• Program Management (events)\n• User Management\n• Applications\n• Analytics\n• Chatbot Management\n• System Settings\n\n**3. Student Dashboard** (Limited Access)\n**Features:**\n• View account status (Pending/Approved/Rejected)\n• View events (read-only)\n• Cannot apply to events\n• Account information\n\n**Access:**\n• Login automatically redirects to your role\'s dashboard\n• Use sidebar menu to navigate\n• Check notifications for updates',
        suggestions: 'How do I apply?|Application status|How to check notifications?|Profile management',
        priority: 6
      },
      {
        category: 'application_status',
        keywords: 'application status,my application,application pending,check application,application approved,application rejected',
        response: '📋 **Check Your Application Status:**\n\n**For Event Applications:**\n1. **Login** to your Member Dashboard\n2. Go to **"My Applications"** section\n3. View all your event applications\n\n**Application Statuses:**\n• 🟡 **Pending** - Waiting for admin review\n• 🟢 **Approved** - You\'re in! Check event details\n• 🔴 **Rejected** - Application was not approved\n\n**For Account Registration:**\n1. **Login** to your Student Dashboard\n2. Check the status alert at the top\n3. Status will show:\n   • ⏳ **Pending** - Waiting for admin approval\n   • ✅ **Approved** - You\'re now a Member!\n   • ❌ **Rejected** - Contact admin for details\n\n**Timeline:**\n• Event applications: Usually 1-3 business days\n• Account approval: Usually 1-2 business days\n\n**Notifications:**\n• You\'ll receive email notifications when status changes\n• Check dashboard notifications icon\n• Unread notifications are highlighted\n\n**Note:** Students cannot see event applications until their account is approved.',
        suggestions: 'How long does approval take?|What if I\'m rejected?|How to apply?|Contact admin',
        priority: 6
      },
      {
        category: 'notifications',
        keywords: 'notifications,alerts,updates,messages,notify me,notification system',
        response: '🔔 **Notifications System in GPSphere:**\n\n**You\'ll receive notifications for:**\n\n• **Account Approval**\n  - When your registration is approved\n  - Status change from Student to Member\n  - Email notification sent\n\n• **Application Updates**\n  - When your event application status changes\n  - Pending → Approved/Rejected\n  - Email notification sent\n\n• **Upcoming Events**\n  - Reminders about events you\'re participating in\n  - 24 hours before event date\n  - Automatic notifications\n\n• **Event Reminders**\n  - Notifications for events you applied to\n  - Event date approaching\n  - Role confirmation\n\n**How to View Notifications:**\n• Check the **notifications icon** in your dashboard header\n• Click to see all notifications\n• Unread notifications are highlighted\n• Mark as read when viewed\n\n**Email Notifications:**\n• Make sure your email is correct in your profile\n• Check spam folder if not receiving emails\n• Email notifications are sent for important updates\n\n**Notification Types:**\n• Account status changes\n• Application approvals/rejections\n• Event reminders\n• System updates',
        suggestions: 'How to check notifications?|Application status|Account status|Update email',
        priority: 5
      },
      {
        category: 'profile',
        keywords: 'profile,my profile,update profile,profile picture,change profile,edit profile',
        response: '👤 **Profile Management in GPSphere:**\n\n**Access Your Profile:**\n• Click on "Profile" in sidebar menu\n• Or go to Profile page directly\n\n**Profile Features:**\n\n**View Information:**\n• Your name and email\n• Current role (Student/Member/Admin)\n• Account status (Pending/Approved)\n• Profile picture (if uploaded)\n• Registration date\n\n**Update Profile:**\n• Change your name\n• Update email address\n• Upload profile picture\n• Change password (separate section)\n\n**Profile Picture:**\n• Upload from your device\n• Supported formats: JPG, PNG\n• Image will be resized automatically\n• Displayed in dashboard header\n\n**Change Password:**\n• Go to Profile page\n• Click "Change Password"\n• Enter current password\n• Enter new password (must meet requirements)\n• Confirm new password\n\n**Password Requirements:**\n• At least 8 characters\n• One uppercase letter\n• One lowercase letter\n• One number\n• One special symbol\n\n**Note:** Some profile changes may require admin approval.',
        suggestions: 'How to change password?|Password requirements|How to upload picture?|Update email',
        priority: 5
      },
      {
        category: 'password',
        keywords: 'password,forgot password,reset password,change password,password help',
        response: '🔑 **Password Management in GPSphere:**\n\n**Password Requirements:**\n• At least 8 characters long\n• One uppercase letter (A-Z)\n• One lowercase letter (a-z)\n• One number (0-9)\n• One special symbol (!@#$%^&*)\n\n**Change Password:**\n1. Login to your account\n2. Go to Profile page\n3. Click "Change Password"\n4. Enter your current password\n5. Enter new password (must meet requirements)\n6. Confirm new password\n7. Click "Update Password"\n\n**Forgot Password:**\n• Contact admin for password reset assistance\n• Visit GPS room during office hours\n• Email: info@gpsphere.com\n• Admin can reset your password\n\n**Password Security:**\n• Never share your password\n• Use a strong, unique password\n• Change password regularly\n• Don\'t use common passwords\n\n**Note:** Password reset must be done by admin for security reasons.',
        suggestions: 'How to change password?|Contact admin|Password requirements|Forgot password help',
        priority: 5
      },
      {
        category: 'status',
        keywords: 'status,approval,pending,approved,when will,account status,my status',
        response: '⏳ **Account Status in GPSphere:**\n\n**Status Types:**\n\n**1. Pending (Student Role)**\n• Your registration is under review\n• Admin will review your account\n• Usually takes 1-2 business days\n• You have limited access\n• Cannot apply to events yet\n\n**2. Approved (Member Role)**\n• Your account has been approved\n• Role changed from Student to Member\n• Full access to Member Dashboard\n• Can apply to events\n• Can participate in activities\n• You\'ll receive email notification\n\n**3. Rejected**\n• Registration was not approved\n• Contact admin for details\n• You may need to re-register\n\n**How to Check Status:**\n• **Students:** Check Student Dashboard status alert\n• **Members:** Status shown in profile\n• **All:** Check email for notifications\n\n**Timeline:**\n• Registration → Pending (immediate)\n• Admin review → 1-2 business days\n• Approval → Member status (email sent)\n\n**After Approval:**\n• You can access Member Dashboard\n• You can apply to events\n• You receive full system access\n\n**Note:** Check your dashboard regularly for status updates!',
        suggestions: 'How long does it take?|What if I\'m rejected?|How to check status?|Contact admin',
        priority: 5
      },
      {
        category: 'contact',
        keywords: 'contact,help,support,email,phone,contact admin,report issue,get help',
        response: '📞 **Contact GPS UTM / GPSphere Support:**\n\n**Email Support:**\n• **General Inquiries:** info@gpsphere.com\n• **Technical Issues:** Contact admin through dashboard\n• **Account Problems:** Visit GPS room or email admin\n\n**GPS Room Location:**\n• **Address:** GPS Room, Student Affairs Building\n• **Campus:** Universiti Teknologi Malaysia (UTM)\n• **Location:** Skudai, Johor, Malaysia\n\n**Office Hours:**\n• **Monday - Friday:** 9:00 AM - 5:00 PM\n• **Saturday:** 9:00 AM - 1:00 PM\n• **Sunday:** Closed\n\n**For Urgent Matters:**\n• Visit GPS room during office hours\n• Contact admin directly\n• Email with "URGENT" in subject\n\n**Support Types:**\n• Account issues\n• Password reset\n• Application questions\n• Technical problems\n• Event inquiries\n• General information\n\n**Social Media:**\n• Follow GPS UTM official pages\n• Check for announcements\n• Stay updated on events',
        suggestions: 'Where is the GPS room?|What are office hours?|How to report an issue?|Email support',
        priority: 5
      },
      {
        category: 'office_hours',
        keywords: 'office hours,when open,opening hours,visit office,gps room hours,when can i visit',
        response: '🕐 **GPS Office Hours:**\n\n**Regular Hours:**\n• **Monday - Friday:** 9:00 AM - 5:00 PM\n• **Saturday:** 9:00 AM - 1:00 PM\n• **Sunday:** Closed\n\n**Location:**\nGPS Room, Student Affairs Building\nUniversiti Teknologi Malaysia (UTM)\nSkudai, Johor, Malaysia\n\n**What You Can Do During Office Hours:**\n• Get help with account issues\n• Request password reset\n• Ask about applications\n• Submit documents\n• Meet with admin\n• Get general information\n\n**Outside Office Hours:**\n• Email: info@gpsphere.com\n• Use chatbot for quick questions\n• Check dashboard for updates\n• Wait for next business day\n\n**For Urgent Matters:**\n• Email with "URGENT" in subject\n• Contact admin directly if possible\n• Visit during next available hours',
        suggestions: 'Where is the GPS room?|Contact information|How to report an issue?|Email support',
        priority: 5
      },
      {
        category: 'gps_location',
        keywords: 'where is gps,gps room location,where to find gps,utm campus location,address',
        response: '📍 **GPS UTM Location:**\n\nThe GPS office is located at:\n\n**GPS Room**\nStudent Affairs Building\nUniversiti Teknologi Malaysia (UTM)\nSkudai, Johor\nMalaysia\n\n**How to Find Us:**\n• Look for the Student Affairs building on campus\n• GPS room signage will guide you\n• Ask campus security for directions\n• Check campus map for Student Affairs building\n\n**Campus Information:**\n• **University:** Universiti Teknologi Malaysia (UTM)\n• **Campus:** Skudai Campus\n• **State:** Johor, Malaysia\n\n**Getting There:**\n• Use campus map\n• Ask at information counter\n• Follow GPS signage\n• Contact us for specific directions\n\n**Need Directions?**\n• Email: info@gpsphere.com\n• Visit during office hours\n• Contact admin for assistance',
        suggestions: 'What are office hours?|Contact information|How to get there?|Campus map',
        priority: 5
      },
      {
        category: 'admin_features',
        keywords: 'admin,admin features,admin dashboard,what can admin do,admin functions',
        response: '⚡ **Admin Features in GPSphere:**\n\n**Admin Dashboard Access:**\n• Full system control\n• Orange-themed dashboard\n• Advanced management tools\n\n**User Management:**\n• View all users (Admin, Member, Student)\n• Approve/reject user registrations\n• Filter users by status and role\n• Delete users if needed\n• Change user status\n\n**Event Management:**\n• Create new events\n• Edit existing events\n• Delete events\n• Add multiple roles per event\n• Set role slots and requirements\n• Manage event status (Ongoing/Finished)\n\n**Application Management:**\n• View all event applications\n• Approve/reject applications\n• See applicant details\n• Track application status\n\n**Analytics & Insights:**\n• Registration rate statistics\n• Active events count\n• Application approval rates\n• Average event size\n• System metrics\n\n**System Settings:**\n• Export data\n• Backup database\n• Email settings\n• System logs\n• Chatbot knowledge management\n\n**Default Admin Account:**\n• Email: admin@gpsphere.com\n• Password: Admin123! (change after first login)',
        suggestions: 'How to create events?|User management|Application management|System settings',
        priority: 4
      },
      {
        category: 'multiple_applications',
        keywords: 'multiple applications,apply multiple,can i apply,multiple roles,apply twice,multiple events',
        response: '✅ **Multiple Applications in GPSphere:**\n\n**Yes, you can apply to multiple events and roles!**\n\n**Rules:**\n\n• **Different Events**\n  - Apply to as many events as you want\n  - No limit on number of events\n  - Each event application is independent\n\n• **Same Event, Different Roles**\n  - You can apply for multiple roles in the same event\n  - However, you can only be approved for ONE role per event\n  - Admin will review and approve the best fit\n\n• **Multiple Applications**\n  - No limit on total applications\n  - Each application reviewed separately\n  - Track all applications in "My Applications"\n\n**Important Notes:**\n• Make sure you can commit to all approved roles\n• Don\'t over-commit your time\n• Check event dates for conflicts\n• Each application has its own status\n• You\'ll receive separate notifications for each\n\n**Best Practice:**\n• Apply to events that interest you\n• Check your schedule before applying\n• Be realistic about your availability\n• Focus on quality over quantity\n\nApply to events that match your interests and schedule!',
        suggestions: 'How do I apply?|What roles are available?|Application status|Check my applications',
        priority: 5
      },
      {
        category: 'rejected_application',
        keywords: 'rejected,application rejected,why rejected,not approved,denied,application denied',
        response: '😔 **If Your Application Was Rejected:**\n\n**Don\'t worry! Here\'s what you can do:**\n\n**Possible Reasons:**\n• Role slots were already filled\n• Requirements not met\n• Scheduling conflicts\n• Limited availability\n• Better candidate selected\n\n**What You Can Do:**\n\n1. **Apply Again**\n   • Try applying for other events\n   • Apply for different roles\n   • Don\'t give up!\n\n2. **Check Requirements**\n   • Review event/role requirements\n   • Make sure you meet criteria\n   • Improve your qualifications\n\n3. **Contact Admin**\n   • Ask for feedback (if appropriate)\n   • Understand rejection reason\n   • Get guidance for future applications\n\n4. **Stay Active**\n   • Keep participating in other events\n   • Build your experience\n   • Show commitment and interest\n\n5. **Learn and Improve**\n   • Take feedback constructively\n   • Develop relevant skills\n   • Try again in future events\n\n**Remember:**\n• Rejection doesn\'t mean you can\'t participate\n• There are always other opportunities\n• Keep trying and stay positive!\n• Your time will come!',
        suggestions: 'How to apply?|What events are available?|Contact admin|Application help',
        priority: 4
      },
      {
        category: 'thanks',
        keywords: 'thanks,thank you,ty,appreciate,grateful,terima kasih',
        response: '😊 You\'re welcome! I\'m here to help anytime.\n\nIs there anything else you\'d like to know about GPSphere or GPS UTM?',
        suggestions: 'Tell me about events|How to register?|Contact information|Dashboard help',
        priority: 4
      },
      {
        category: 'goodbye',
        keywords: 'bye,goodbye,see you,farewell,exit,quit,selamat tinggal',
        response: '👋 Goodbye! Feel free to come back if you have any questions.\n\nHave a great day and see you around GPSphere! 🌟',
        suggestions: '',
        priority: 3
      },
      {
        category: 'faq',
        keywords: 'faq,frequently asked,common questions,help questions,questions',
        response: '❓ **Frequently Asked Questions (FAQ):**\n\n**Registration & Account:**\n• How do I register? → Registration process\n• How long does approval take? → Account status (1-2 days)\n• What is TAC? → Login & TAC system\n• What are user roles? → User roles explanation\n\n**Events:**\n• What events are available? → Events information\n• How do I join an event? → Join event process\n• What roles are available? → Event roles\n• Can I apply to multiple events? → Multiple applications\n\n**Dashboard & Features:**\n• How to use dashboard? → Dashboard help\n• How to check notifications? → Notifications system\n• How to update profile? → Profile management\n• How to change password? → Password help\n\n**Support:**\n• How to contact GPS? → Contact information\n• Where is the GPS room? → GPS location\n• What are office hours? → Office hours\n• How to report an issue? → Contact admin\n\n**Ask me anything specific, or try the suggestions below!**',
        suggestions: 'How do I register?|What events are available?|Contact information|Dashboard help',
        priority: 4
      }
    ];

    let inserted = 0;
    let updated = 0;

    for (const knowledge of knowledgeEntries) {
      // Check if entry exists by category
      const [existing] = await conn.query(
        "SELECT id FROM chatbot_knowledge WHERE category = ?",
        [knowledge.category]
      );

      if (existing.length > 0) {
        // Update existing entry
        await conn.query(
          "UPDATE chatbot_knowledge SET keywords = ?, response = ?, suggestions = ?, priority = ?, updated_at = CURRENT_TIMESTAMP WHERE category = ?",
          [knowledge.keywords, knowledge.response, knowledge.suggestions, knowledge.priority, knowledge.category]
        );
        updated++;
        console.log(`✅ Updated: ${knowledge.category}`);
      } else {
        // Insert new entry
        await conn.query(
          "INSERT INTO chatbot_knowledge (category, keywords, response, suggestions, priority) VALUES (?, ?, ?, ?, ?)",
          [knowledge.category, knowledge.keywords, knowledge.response, knowledge.suggestions, knowledge.priority]
        );
        inserted++;
        console.log(`✅ Inserted: ${knowledge.category}`);
      }
    }

    console.log(`\n🎉 Chatbot knowledge population complete!`);
    console.log(`   Inserted: ${inserted} entries`);
    console.log(`   Updated: ${updated} entries`);
    console.log(`   Total: ${knowledgeEntries.length} entries`);
    console.log(`\n📝 All knowledge entries have been updated based on the GPSphere system environment!`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    console.error('Error message:', error.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

populateChatbotData();
