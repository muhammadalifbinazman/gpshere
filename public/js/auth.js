// ============================================
// AUTHENTICATION JAVASCRIPT
// Handles Login, Register, and TAC verification
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    initAuthPage();
});

function initAuthPage() {
    setupTabs();
    setupForms();
    setupPasswordToggles();
    setupForgotPassword();
    
    // Check if already logged in
    if (AppUtils.isLoggedIn()) {
        const role = sessionStorage.getItem('userRole');
        AppUtils.redirectToDashboard(role);
    }
}

// ============================================
// TAB SWITCHING
// ============================================

function setupTabs() {
    const loginTab = document.getElementById('loginTab');
    const registerTab = document.getElementById('registerTab');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    if (loginTab) {
        loginTab.addEventListener('click', () => {
            loginTab.classList.add('active');
            registerTab.classList.remove('active');
            loginForm.classList.add('active');
            registerForm.classList.remove('active');
            AppUtils.clearAllErrors();
        });
    }

    if (registerTab) {
        registerTab.addEventListener('click', () => {
            registerTab.classList.add('active');
            loginTab.classList.remove('active');
            registerForm.classList.add('active');
            loginForm.classList.remove('active');
            AppUtils.clearAllErrors();
        });
    }
}

// ============================================
// PASSWORD TOGGLE
// ============================================

function setupPasswordToggles() {
    document.querySelectorAll('.toggle-icon').forEach(icon => {
        icon.addEventListener('click', () => {
            const input = icon.previousElementSibling;
            if (input.type === 'password') {
                input.type = 'text';
                icon.textContent = '👁️';
            } else {
                input.type = 'password';
                icon.textContent = '👁️‍🗨️';
            }
        });
    });
}

// ============================================
// FORM SETUP
// ============================================

function setupForms() {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
}

// ============================================
// FORGOT PASSWORD
// ============================================

function setupForgotPassword() {
    const forgotLink = document.getElementById('forgotPasswordLink');
    const closeBtn = document.getElementById('closeForgotModal');
    const sendResetBtn = document.getElementById('sendResetCodeBtn');
    const resetPasswordBtn = document.getElementById('resetPasswordBtn');

    if (forgotLink) {
        forgotLink.addEventListener('click', (e) => {
            e.preventDefault();
            AppUtils.clearAllErrors();
            AppUtils.openModal('forgotModal');
            const emailInput = document.getElementById('forgotEmail');
            if (emailInput) emailInput.focus();
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            AppUtils.closeModal('forgotModal');
        });
    }

    if (sendResetBtn) {
        sendResetBtn.addEventListener('click', handleSendResetCode);
    }

    if (resetPasswordBtn) {
        resetPasswordBtn.addEventListener('click', handleResetPassword);
    }
}

async function handleSendResetCode() {
    AppUtils.clearAllErrors();
    const email = document.getElementById('forgotEmail').value.trim();

    if (!email) {
        AppUtils.showFieldError('forgotEmail', 'Email is required');
        return;
    }
    if (!AppUtils.validateEmail(email)) {
        AppUtils.showFieldError('forgotEmail', 'Invalid email format');
        return;
    }

    try {
        AppUtils.showLoader();
        const response = await AppUtils.apiRequest('/auth/forgot-password', 'POST', { email });
        AppUtils.hideLoader();

        if (response.resetCode) {
            AppUtils.showInfo(`Reset Code (Test Mode): ${response.resetCode}`);
        } else {
            AppUtils.showSuccess('If an account exists, a reset code has been sent.');
        }
    } catch (error) {
        AppUtils.hideLoader();
        AppUtils.showError(error.message || 'Failed to send reset code.');
    }
}

async function handleResetPassword() {
    AppUtils.clearAllErrors();
    const email = document.getElementById('forgotEmail').value.trim();
    const code = document.getElementById('resetCode').value.trim();
    const newPassword = document.getElementById('newPassword').value;
    const confirmNewPassword = document.getElementById('confirmNewPassword').value;

    if (!email) {
        AppUtils.showFieldError('forgotEmail', 'Email is required');
        return;
    }
    if (!AppUtils.validateEmail(email)) {
        AppUtils.showFieldError('forgotEmail', 'Invalid email format');
        return;
    }
    if (!code || code.length !== 6) {
        AppUtils.showFieldError('resetCode', 'Enter the 6-digit code');
        return;
    }
    if (!newPassword) {
        AppUtils.showFieldError('newPassword', 'New password is required');
        return;
    }
    if (!AppUtils.validatePassword(newPassword)) {
        AppUtils.showFieldError('newPassword', 'Password must be at least 8 chars with uppercase, lowercase, number, and symbol');
        return;
    }
    if (newPassword !== confirmNewPassword) {
        AppUtils.showFieldError('confirmNewPassword', 'Passwords do not match');
        return;
    }

    try {
        AppUtils.showLoader();
        await AppUtils.apiRequest('/auth/reset-password', 'POST', {
            email,
            code,
            newPassword,
            confirm: confirmNewPassword
        });
        AppUtils.hideLoader();
        AppUtils.showSuccess('Password reset successful. You can now log in.');
        AppUtils.closeModal('forgotModal');
    } catch (error) {
        AppUtils.hideLoader();
        AppUtils.showError(error.message || 'Failed to reset password.');
    }
}

// ============================================
// LOGIN HANDLER
// ============================================

async function handleLogin(e) {
    e.preventDefault();
    AppUtils.clearAllErrors();

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    // Validation
    if (!email) {
        AppUtils.showFieldError('loginEmail', 'Email is required');
        return;
    }

    if (!AppUtils.validateEmail(email)) {
        AppUtils.showFieldError('loginEmail', 'Invalid email format');
        return;
    }

    if (!password) {
        AppUtils.showFieldError('loginPassword', 'Password is required');
        return;
    }

    try {
        AppUtils.showLoader();
        
        const response = await AppUtils.apiRequest('/auth/login', 'POST', {
            email,
            password
        });

        console.log('Login response:', response);

        // Check if TAC is required
        if (response.requiresTAC || response.requireTAC) {
            AppUtils.hideLoader();
            
            // Store email for TAC verification
            sessionStorage.setItem('pendingEmail', email);
            
            // If test mode, show TAC in console/alert
            if (response.tac) {
                console.log('🔐 TAC CODE:', response.tac);
                AppUtils.showInfo(`TAC Code (Test Mode): ${response.tac}`);
            }
            
            // Show TAC verification modal
            showTACModal(email);
        } else {
            AppUtils.hideLoader();
            AppUtils.showSuccess('Login successful!');
            
            // Set session data
            AppUtils.setLoggedIn({
                name: response.user.name,
                email: response.user.email,
                role: response.user.role
            });
            
            // Redirect to appropriate dashboard
            setTimeout(() => {
                AppUtils.redirectToDashboard(response.user.role);
            }, 1000);
        }
    } catch (error) {
        AppUtils.hideLoader();
        AppUtils.showError(error.message || 'Login failed');
    }
}

// ============================================
// REGISTER HANDLER
// ============================================

async function handleRegister(e) {
    e.preventDefault();
    AppUtils.clearAllErrors();

    const name = document.getElementById('registerName').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;

    // Validation
    if (!name) {
        AppUtils.showFieldError('registerName', 'Name is required');
        return;
    }

    if (name.length < 3) {
        AppUtils.showFieldError('registerName', 'Name must be at least 3 characters');
        return;
    }

    if (!email) {
        AppUtils.showFieldError('registerEmail', 'Email is required');
        return;
    }

    if (!AppUtils.validateEmail(email)) {
        AppUtils.showFieldError('registerEmail', 'Invalid email format');
        return;
    }

    if (!password) {
        AppUtils.showFieldError('registerPassword', 'Password is required');
        return;
    }

    if (!AppUtils.validatePassword(password)) {
        AppUtils.showFieldError('registerPassword', 
            'Password must be at least 8 characters with uppercase, lowercase, number, and symbol');
        return;
    }

    if (password !== confirmPassword) {
        AppUtils.showFieldError('registerConfirmPassword', 'Passwords do not match');
        return;
    }

    try {
        AppUtils.showLoader();
        
        const response = await AppUtils.apiRequest('/auth/register', 'POST', {
            name,
            email,
            password,
            confirm: confirmPassword
        });

        AppUtils.hideLoader();
        AppUtils.showSuccess('Registration successful! Please wait for admin approval.');
        
        // Clear form
        e.target.reset();
        
        // Switch to login tab after 2 seconds
        setTimeout(() => {
            document.getElementById('loginTab').click();
        }, 2000);
    } catch (error) {
        AppUtils.hideLoader();
        AppUtils.showError(error.message || 'Registration failed');
    }
}

// ============================================
// TAC VERIFICATION MODAL
// ============================================

function showTACModal(email) {
    const modal = document.getElementById('tacModal');
    if (!modal) {
        createTACModal();
    }
    
    const emailDisplay = document.getElementById('tacEmail');
    if (emailDisplay) {
        emailDisplay.textContent = email;
    }
    
    // Start countdown timer
    startTACTimer(15 * 60); // 15 minutes
    
    AppUtils.openModal('tacModal');
    
    // Focus on TAC input
    document.getElementById('tacInput').focus();
}

function createTACModal() {
    const modalHTML = `
        <div id="tacModal" class="tac-modal">
            <div class="tac-content">
                <h2>🔐 Enter Verification Code</h2>
                <p>We've sent a 6-digit code to <strong id="tacEmail"></strong></p>
                
                <input 
                    type="text" 
                    id="tacInput" 
                    class="tac-input" 
                    maxlength="6" 
                    placeholder="000000"
                    autocomplete="off"
                >
                
                <div class="tac-timer" id="tacTimer">
                    Time remaining: <span id="tacCountdown">15:00</span>
                </div>
                
                <button onclick="verifyTAC()" class="btn btn-primary" style="width: 100%; margin-bottom: 15px;">
                    Verify Code
                </button>
                
                <a href="#" class="resend-tac" onclick="resendTAC(); return false;" id="resendLink">
                    Resend Code
                </a>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Add enter key listener
    document.getElementById('tacInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            verifyTAC();
        }
    });
}

let tacTimerInterval;

function startTACTimer(seconds) {
    clearInterval(tacTimerInterval);
    
    let remaining = seconds;
    const countdownElement = document.getElementById('tacCountdown');
    const resendLink = document.getElementById('resendLink');
    
    tacTimerInterval = setInterval(() => {
        remaining--;
        
        const minutes = Math.floor(remaining / 60);
        const secs = remaining % 60;
        countdownElement.textContent = `${minutes}:${secs.toString().padStart(2, '0')}`;
        
        if (remaining <= 0) {
            clearInterval(tacTimerInterval);
            countdownElement.textContent = 'Expired';
            resendLink.classList.remove('disabled');
            AppUtils.showWarning('TAC code expired. Please request a new one.');
        }
    }, 1000);
}

async function verifyTAC() {
    const tacCode = document.getElementById('tacInput').value.trim();
    const email = sessionStorage.getItem('pendingEmail');
    
    if (!tacCode || tacCode.length !== 6) {
        AppUtils.showError('Please enter a valid 6-digit code');
        return;
    }
    
    try {
        AppUtils.showLoader();
        
        const response = await AppUtils.apiRequest('/auth/verify-tac', 'POST', {
            email,
            tac_code: tacCode
        });
        
        AppUtils.hideLoader();
        clearInterval(tacTimerInterval);
        AppUtils.closeModal('tacModal');
        
        AppUtils.showSuccess('Verification successful!');
        
        // Set session data
        AppUtils.setLoggedIn({
            name: response.user.name,
            email: response.user.email,
            role: response.user.role
        });
        
        // Clear pending email
        sessionStorage.removeItem('pendingEmail');
        
        // Redirect to appropriate dashboard
        setTimeout(() => {
            AppUtils.redirectToDashboard(response.user.role);
        }, 1000);
    } catch (error) {
        AppUtils.hideLoader();
        AppUtils.showError(error.message || 'Invalid verification code');
        document.getElementById('tacInput').value = '';
        document.getElementById('tacInput').focus();
    }
}

async function resendTAC() {
    const email = sessionStorage.getItem('pendingEmail');
    const password = document.getElementById('loginPassword').value;
    
    try {
        AppUtils.showLoader();
        
        const response = await AppUtils.apiRequest('/auth/login', 'POST', {
            email,
            password
        });
        
        AppUtils.hideLoader();
        AppUtils.showSuccess('New code sent!');
        
        // If test mode, show TAC
        if (response.tac) {
            console.log('🔐 NEW TAC CODE:', response.tac);
            AppUtils.showInfo(`New TAC Code (Test Mode): ${response.tac}`);
        }
        
        // Restart timer
        startTACTimer(15 * 60);
        
        // Clear input
        document.getElementById('tacInput').value = '';
        document.getElementById('tacInput').focus();
    } catch (error) {
        AppUtils.hideLoader();
        AppUtils.showError('Failed to resend code');
    }
}

// Make functions globally accessible
window.verifyTAC = verifyTAC;
window.resendTAC = resendTAC;

console.log('🔐 Auth module loaded');
