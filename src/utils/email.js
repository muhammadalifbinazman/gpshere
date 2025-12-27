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
if (!isTestMode) {
  // Validate email configuration
  if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('⚠️ Email configuration incomplete. TAC codes will be returned in API response.');
    console.warn('   Missing: EMAIL_HOST, EMAIL_USER, or EMAIL_PASS');
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
      // Increased timeouts to handle slow connections
      connectionTimeout: 60000, // 60 seconds (was 10)
      socketTimeout: 60000, // 60 seconds (was 10)
      greetingTimeout: 30000, // 30 seconds (was 10)
      // Additional connection options
      pool: true, // Use connection pooling
      maxConnections: 1,
      maxMessages: 3,
      rateDelta: 1000,
      rateLimit: 5,
      tls: {
        rejectUnauthorized: false
      },
      debug: process.env.NODE_ENV === 'development',
      logger: process.env.NODE_ENV === 'development'
    });
    
    console.log(`📧 Email transporter configured: ${process.env.EMAIL_HOST}:${emailPort} (secure: ${useSecure})`);
  }
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
    console.warn(`⚠️ Email transporter not configured. TAC for ${email}: ${tacCode}`);
    return {
      test: true,
      tac: tacCode,
      reason: 'Email not configured'
    };
  }

  // Retry logic for connection issues
  const maxRetries = 3;
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
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

      await transporter.sendMail(mailOptions);
      console.log(`✅ TAC email sent to ${email}`);

      return { test: false };
    } catch (error) {
      lastError = error;
      console.error(`❌ Email sending failed (attempt ${attempt}/${maxRetries}):`, error.message);
      console.error('   Error code:', error.code);
      console.error('   Error command:', error.command);
      
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
  
  // All retries failed - return TAC in response (for development/testing)
  return {
    test: true,
    tac: tacCode,
    reason: `Email failed after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`
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
  
  // All retries failed
  throw lastError || new Error('Welcome email failed after multiple attempts');
};

module.exports = {
  sendTACEmail,
  sendResetEmail,
  sendWelcomeEmail
};
