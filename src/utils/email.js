// ============================================
// 📋 EMAIL UTILITY WITH TEST MODE
// ============================================
// Supports:
//  ✔ Real email sending via Nodemailer
//  ✔ TAC_TEST_MODE = true → no email, return TAC in API response
// ============================================

const nodemailer = require('nodemailer');
require('dotenv').config();

const isTestMode = process.env.TAC_TEST_MODE === 'true';

// Create transporter (only if NOT in test mode)
let transporter = null;
let emailConfigValid = false;

if (!isTestMode) {
  // Validate email configuration
  if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('⚠️ Email configuration incomplete. TAC codes will be returned in API response.');
    console.warn('   Missing: EMAIL_HOST, EMAIL_USER, or EMAIL_PASS');
    console.warn('   Please check your .env file and ensure all email settings are configured.');
  } else {
    const emailPort = parseInt(process.env.EMAIL_PORT || '587');
    const useSecure = emailPort === 465;
    
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: emailPort,
      secure: useSecure,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      // Optimized timeouts for cloud hosting (Render.com)
      connectionTimeout: 30000, // 30 seconds - shorter for faster failure detection
      socketTimeout: 30000, // 30 seconds
      greetingTimeout: 15000, // 15 seconds
      // Connection options optimized for cloud hosting
      pool: false, // Disable pooling for cloud - can cause connection issues
      // Additional connection options for cloud hosting
      requireTLS: emailPort === 587, // Require TLS for port 587
      tls: {
        rejectUnauthorized: false, // Allow self-signed certificates
        ciphers: 'SSLv3' // Use SSLv3 for better compatibility
      },
      // Retry configuration
      maxRetries: 0, // Let our custom retry logic handle it
      debug: process.env.NODE_ENV === 'development',
      logger: process.env.NODE_ENV === 'development'
    });
    
    console.log(`📧 Email transporter configured: ${process.env.EMAIL_HOST}:${emailPort} (secure: ${useSecure})`);
    
    // Verify email configuration on startup
    console.log(`📧 Email Configuration Check:`);
    console.log(`   Host: ${process.env.EMAIL_HOST}`);
    console.log(`   Port: ${emailPort}`);
    console.log(`   User: ${process.env.EMAIL_USER}`);
    console.log(`   Password: ${process.env.EMAIL_PASS ? '***' + process.env.EMAIL_PASS.slice(-4) : 'NOT SET'}`);
    console.log(`   Test Mode: ${isTestMode ? 'ENABLED (emails disabled)' : 'DISABLED (emails enabled)'}`);
    
    // Verify email connection (async, non-blocking)
    transporter.verify((error, success) => {
      if (error) {
        console.error('❌ Email configuration verification failed:');
        console.error(`   Error: ${error.message}`);
        if (error.code === 'EAUTH') {
          console.error('   ⚠️  Authentication failed - check your EMAIL_USER and EMAIL_PASS');
          console.error('   For Gmail, make sure you are using an App Password, not your regular password.');
          console.error('   Get App Password from: https://myaccount.google.com/apppasswords');
        } else if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
          console.error('   ⚠️  Connection failed - check your EMAIL_HOST and network connection');
        } else {
          console.error(`   Error code: ${error.code}`);
        }
        emailConfigValid = false;
      } else {
        console.log('✅ Email configuration verified successfully!');
        emailConfigValid = true;
      }
    });
  }
} else {
  console.log('🔧 TAC_TEST_MODE is enabled - emails will not be sent');
}

// ============================================
// 📌 SEND TAC EMAIL (Supports Test Mode)
// ============================================
const sendTACEmail = async (email, tacCode) => {
  // TEST MODE: do not send email
  if (isTestMode) {
    console.log(`🔧 [TEST MODE] TAC for ${email}: ${tacCode}`);
    return {
      test: true,
      tac: tacCode
    };
  }

  // PRODUCTION MODE: send email normally
  if (!transporter) {
    console.error(`❌ Email transporter not configured!`);
    console.error(`   Missing: EMAIL_HOST, EMAIL_USER, or EMAIL_PASS`);
    console.error(`   TAC Code (fallback): ${tacCode}`);
    return {
      test: true,
      tac: tacCode,
      reason: 'Email transporter not configured - missing EMAIL_HOST, EMAIL_USER, or EMAIL_PASS',
      emailFailed: true
    };
  }

  // Retry logic for connection issues
  const maxRetries = 2; // Reduced retries for faster failure detection
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Recreate transporter on retry to avoid stale connections
      let currentTransporter = transporter;
      if (attempt > 1) {
        const emailPort = parseInt(process.env.EMAIL_PORT || '587');
        const useSecure = emailPort === 465;
        currentTransporter = nodemailer.createTransport({
          host: process.env.EMAIL_HOST,
          port: emailPort,
          secure: useSecure,
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
          },
          connectionTimeout: 30000,
          socketTimeout: 30000,
          greetingTimeout: 15000,
          pool: false,
          requireTLS: emailPort === 587,
          tls: {
            rejectUnauthorized: false,
            ciphers: 'SSLv3'
          }
        });
      }

      const mailOptions = {
        from: `"GPS UTM" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: '🔐 GPS UTM - Your Authentication Code',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 2px solid #10b981; border-radius: 10px;">
            <h2 style="color: #059669; text-align: center;">🎓 Gerakan Pengguna Siswa UTM</h2>
            <h3 style="text-align: center; color: #333;">Student Consumer Movement</h3>
            <hr style="border: 1px solid #10b981;">
            <h2 style="color: #333;">Two-Factor Authentication</h2>
            <p style="font-size: 16px;">Your TAC (Time-based Authentication Code) is:</p>
            <div style="background: #f0fdf4; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
              <h1 style="color: #059669; letter-spacing: 10px; font-size: 48px; margin: 0;">${tacCode}</h1>
            </div>
            <p style="color: #d97706; font-weight: bold;">⏰ This code expires in 15 minutes.</p>
            <p style="color: #666;">If you didn't request this code, please ignore this email.</p>
            <hr style="border: 1px solid #e5e7eb; margin-top: 30px;">
            <p style="text-align: center; color: #999; font-size: 12px;">
              © 2025 Gerakan Pengguna Siswa UTM<br>
              Empowering students to become smart, ethical, and responsible consumers
            </p>
          </div>
        `
      };

      if (attempt > 1) {
        console.log(`🔄 Retrying email send (attempt ${attempt}/${maxRetries})...`);
      }

      await currentTransporter.sendMail(mailOptions);
      console.log(`✅ TAC email sent to ${email}`);

      return { test: false };
    } catch (error) {
      lastError = error;
      console.error(`❌ Email sending failed (attempt ${attempt}/${maxRetries}):`, error.message);
      console.error('   Error code:', error.code);
      console.error('   Error command:', error.command);
      
      // Provide specific error messages for common issues
      if (error.code === 'EAUTH') {
        console.error('   ⚠️  Authentication failed - Invalid email credentials');
        console.error('   For Gmail: Use App Password, not regular password');
        console.error('   Get App Password: https://myaccount.google.com/apppasswords');
      } else if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
        console.error('   ⚠️  Connection failed - Check EMAIL_HOST and network');
      } else if (error.code === 'EMESSAGE') {
        console.error('   ⚠️  Message rejected - Check recipient email address');
      }
      
      // Retry on connection timeout or connection errors
      if (attempt < maxRetries && (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET' || error.code === 'ECONNREFUSED' || error.code === 'ECONNECTION')) {
        const delay = attempt * 3000; // Exponential backoff: 3s, 6s
        console.log(`⏳ Waiting ${delay}ms before retry...`);
        console.log(`   💡 Tip: If this persists, Gmail SMTP may be blocked from Render.com`);
        console.log(`   💡 Consider using SendGrid, Mailgun, or AWS SES instead (see EMAIL_TROUBLESHOOTING.md)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // Don't retry authentication errors - they won't succeed
      if (error.code === 'EAUTH') {
        break;
      }
      
      // If not a retryable error or max retries reached, break
      break;
    }
  }
  
  // All retries failed - return TAC in response so user can still log in
  console.error(`❌ Email sending failed after ${maxRetries} attempts for ${email}`);
  console.error(`   Last error: ${lastError?.message || 'Unknown error'}`);
  console.error(`   Error code: ${lastError?.code || 'N/A'}`);
  console.error(`   TAC Code (fallback): ${tacCode}`);
  console.error(`   💡 See EMAIL_TROUBLESHOOTING.md for solutions`);
  
  // Provide user-friendly error message
  let userFriendlyError = 'Email sending failed';
  if (lastError?.code === 'EAUTH') {
    userFriendlyError = 'Email authentication failed. Please check email configuration.';
  } else if (lastError?.code === 'ECONNECTION' || lastError?.code === 'ETIMEDOUT') {
    userFriendlyError = 'Email server connection failed. Please check network and email settings.';
  } else if (lastError?.code === 'EMESSAGE') {
    userFriendlyError = 'Invalid recipient email address.';
  }
  
  return {
    test: true, // Mark as test so TAC is returned to user
    tac: tacCode,
    reason: userFriendlyError,
    detailedError: `${lastError?.message || 'Unknown error'}`,
    errorCode: lastError?.code,
    emailFailed: true
  };
};

// ============================================
// 📌 SEND PASSWORD RESET EMAIL (Supports Test Mode)
// ============================================
const sendResetEmail = async (email, resetCode) => {
  // TEST MODE: do not send email
  if (isTestMode) {
    console.log(`🔧 [TEST MODE] Password reset code for ${email}: ${resetCode}`);
    return {
      test: true,
      code: resetCode
    };
  }

  // Check if transporter is configured
  if (!transporter) {
    console.error(`❌ Email transporter not configured for password reset!`);
    throw new Error('Email transporter not configured - missing EMAIL_HOST, EMAIL_USER, or EMAIL_PASS');
  }

  // Retry logic for connection issues
  const maxRetries = 3;
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const mailOptions = {
        from: `"GPS UTM" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: '🔒 GPS UTM - Password Reset Code',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 2px solid #2563EB; border-radius: 10px;">
            <h2 style="color: #2563EB; text-align: center;">🎓 Gerakan Pengguna Siswa UTM</h2>
            <h3 style="text-align: center; color: #333;">Password Reset Request</h3>
            <hr style="border: 1px solid #2563EB;">
            <p style="font-size: 16px;">Your password reset code is:</p>
            <div style="background: #eef2ff; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
              <h1 style="color: #2563EB; letter-spacing: 10px; font-size: 36px; margin: 0;">${resetCode}</h1>
            </div>
            <p style="color: #d97706; font-weight: bold;">⏰ This code expires in 15 minutes.</p>
            <p style="color: #666;">If you did not request this, you can safely ignore this email.</p>
            <hr style="border: 1px solid #e5e7eb; margin-top: 30px;">
            <p style="text-align: center; color: #999; font-size: 12px;">
              © 2025 Gerakan Pengguna Siswa UTM<br>
              Empowering students to become smart, ethical, and responsible consumers
            </p>
          </div>
        `
      };

      if (attempt > 1) {
        console.log(`🔄 Retrying password reset email (attempt ${attempt}/${maxRetries})...`);
      }

      await transporter.sendMail(mailOptions);
      console.log(`✅ Password reset email sent to ${email}`);
      return { test: false };
    } catch (error) {
      lastError = error;
      console.error(`❌ Password reset email failed (attempt ${attempt}/${maxRetries}):`, error.message);
      
      // Retry on connection timeout or connection errors
      if (attempt < maxRetries && (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET' || error.code === 'ECONNREFUSED')) {
        const delay = attempt * 2000; // Exponential backoff: 2s, 4s, 6s
        console.log(`⏳ Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // If not a retryable error or max retries reached, break
      break;
    }
  }
  
  // All retries failed
  throw lastError || new Error('Password reset email failed after multiple attempts');
};

// ============================================
// 📌 SEND WELCOME EMAIL (Also respects test mode)
// ============================================
const sendWelcomeEmail = async (email, name) => {
  if (isTestMode) {
    console.log(`🔧 [TEST MODE] Welcome email skipped for ${email}`);
    return { test: true };
  }

  // Check if transporter is configured
  if (!transporter) {
    console.error(`❌ Email transporter not configured for welcome email!`);
    throw new Error('Email transporter not configured - missing EMAIL_HOST, EMAIL_USER, or EMAIL_PASS');
  }

  // Retry logic for connection issues
  const maxRetries = 3;
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const mailOptions = {
        from: `"GPS UTM" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: '🎉 Welcome to GPS UTM - Gerakan Pengguna Siswa!',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 2px solid #10b981; border-radius: 10px;">
            <h2 style="color: #059669; text-align: center;">🎓 Gerakan Pengguna Siswa UTM</h2>
            <h3 style="text-align: center; color: #333;">Student Consumer Movement</h3>
            <hr style="border: 1px solid #10b981;">
            <h2 style="color: #333;">Welcome, ${name}!</h2>
            <p style="font-size: 16px;">Thank you for joining GPS UTM! Your account has been created successfully.</p>
            <div style="background: #fef3c7; padding: 15px; border-left: 4px solid #d97706; margin: 20px 0;">
              <p style="margin: 0; color: #92400e;">⏳ <strong>Account Status:</strong> Pending Approval</p>
            </div>
            <p>Your account is currently under review by our administrators. You will receive an email notification once your account is approved.</p>
            <h3 style="color: #059669;">What's Next?</h3>
            <ul style="line-height: 1.8;">
              <li>Wait for admin approval (usually 1-2 business days)</li>
              <li>Once approved, you can join our consumer education programs</li>
              <li>Learn about consumer rights and responsibilities</li>
              <li>Participate in workshops and activities</li>
            </ul>
            <hr style="border: 1px solid #e5e7eb; margin-top: 30px;">
            <p style="text-align: center; color: #666;">
              Best regards,<br>
              <strong>GPS UTM Team</strong>
            </p>
            <p style="text-align: center; color: #999; font-size: 12px;">
              © 2025 Gerakan Pengguna Siswa UTM<br>
              Empowering students to become smart, ethical, and responsible consumers
            </p>
          </div>
        `
      };

      if (attempt > 1) {
        console.log(`🔄 Retrying welcome email (attempt ${attempt}/${maxRetries})...`);
      }

      await transporter.sendMail(mailOptions);
      console.log(`✅ Welcome email sent to ${email}`);

      return { test: false };
    } catch (error) {
      lastError = error;
      console.error(`❌ Welcome email failed (attempt ${attempt}/${maxRetries}):`, error.message);
      
      // Retry on connection timeout or connection errors
      if (attempt < maxRetries && (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET' || error.code === 'ECONNREFUSED')) {
        const delay = attempt * 2000; // Exponential backoff: 2s, 4s, 6s
        console.log(`⏳ Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // If not a retryable error or max retries reached, break
      break;
    }
  }
  
  // All retries failed - return error but don't throw (allow registration to continue)
  console.error(`❌ Welcome email failed after ${maxRetries} attempts for ${email}`);
  console.error(`   Last error: ${lastError?.message || 'Unknown error'}`);
  return { test: true, reason: `Email failed: ${lastError?.message || 'Unknown error'}` };
};

// ============================================
// 📌 SEND NOTIFICATION EMAIL (Supports Test Mode)
// ============================================
const sendNotificationEmail = async (email, name, notificationTitle, notificationMessage, notificationType = 'general') => {
  // TEST MODE: do not send email
  if (isTestMode) {
    console.log(`🔧 [TEST MODE] Notification email skipped for ${email}: ${notificationTitle}`);
    return { test: true };
  }

  // Check if transporter is configured
  if (!transporter) {
    console.warn(`⚠️ Email transporter not configured for notification email to ${email}`);
    return { test: true, reason: 'Email transporter not configured' };
  }

  // Retry logic for connection issues
  const maxRetries = 3;
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Determine icon and color based on notification type
      let icon = '📢';
      let color = '#2563EB';
      let borderColor = '#2563EB';
      
      if (notificationType === 'event' || notificationType === 'upcoming_event') {
        icon = '📅';
        color = '#10b981';
        borderColor = '#10b981';
      } else if (notificationType === 'approval') {
        icon = '✅';
        color = '#059669';
        borderColor = '#059669';
      } else if (notificationType === 'system') {
        icon = '🔔';
        color = '#d97706';
        borderColor = '#d97706';
      }

      const mailOptions = {
        from: `"GPS UTM" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: `${icon} GPS UTM - ${notificationTitle}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 2px solid ${borderColor}; border-radius: 10px;">
            <h2 style="color: ${color}; text-align: center;">🎓 Gerakan Pengguna Siswa UTM</h2>
            <h3 style="text-align: center; color: #333;">Student Consumer Movement</h3>
            <hr style="border: 1px solid ${borderColor};">
            <h2 style="color: #333;">${icon} ${notificationTitle}</h2>
            <p style="font-size: 16px; line-height: 1.6; color: #333;">${notificationMessage}</p>
            <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; color: #666; font-size: 14px;">
                💡 <strong>Tip:</strong> You can view all your notifications in your dashboard.
              </p>
            </div>
            <hr style="border: 1px solid #e5e7eb; margin-top: 30px;">
            <p style="text-align: center; color: #999; font-size: 12px;">
              © 2025 Gerakan Pengguna Siswa UTM<br>
              Empowering students to become smart, ethical, and responsible consumers
            </p>
          </div>
        `
      };

      if (attempt > 1) {
        console.log(`🔄 Retrying notification email (attempt ${attempt}/${maxRetries})...`);
      }

      await transporter.sendMail(mailOptions);
      console.log(`✅ Notification email sent to ${email}: ${notificationTitle}`);
      return { test: false };
    } catch (error) {
      lastError = error;
      console.error(`❌ Notification email failed (attempt ${attempt}/${maxRetries}) for ${email}:`, error.message);
      
      // Retry on connection timeout or connection errors
      if (attempt < maxRetries && (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET' || error.code === 'ECONNREFUSED' || error.code === 'ECONNECTION')) {
        const delay = attempt * 2000; // Exponential backoff: 2s, 4s, 6s
        console.log(`⏳ Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // Don't retry authentication errors
      if (error.code === 'EAUTH') {
        break;
      }
      
      // If not a retryable error or max retries reached, break
      break;
    }
  }
  
  // All retries failed - log but don't throw (notifications should still be saved in DB)
  console.error(`❌ Notification email failed after ${maxRetries} attempts for ${email}`);
  console.error(`   Last error: ${lastError?.message || 'Unknown error'}`);
  return { test: true, reason: `Email failed: ${lastError?.message || 'Unknown error'}` };
};

// ============================================
// 📌 GET EMAIL CONFIGURATION STATUS
// ============================================
const getEmailConfigStatus = () => {
  return {
    isTestMode,
    isConfigured: !!transporter,
    hasConfig: !!(process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS),
    emailHost: process.env.EMAIL_HOST || 'NOT SET',
    emailPort: process.env.EMAIL_PORT || '587',
    emailUser: process.env.EMAIL_USER || 'NOT SET',
    emailPassSet: !!process.env.EMAIL_PASS,
    emailConfigValid
  };
};

module.exports = {
  sendTACEmail,
  sendResetEmail,
  sendWelcomeEmail,
  sendNotificationEmail,
  getEmailConfigStatus
};
