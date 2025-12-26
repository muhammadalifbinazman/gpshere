// ============================================
// MAIN JAVASCRIPT FILE
// Common functions used across all pages
// ============================================

// Auto-detect API base URL based on current host
// Works for both localhost and production (Render.com)
const API_BASE_URL = `${window.location.origin}/api`;

// ============================================
// API HELPER FUNCTIONS
// ============================================

async function apiRequest(endpoint, method = 'GET', data = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include' // Include cookies for session
    };

    if (data && method !== 'GET') {
        options.body = JSON.stringify(data);
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Request failed');
        }

        return result;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// ============================================
// ALERT/NOTIFICATION FUNCTIONS
// ============================================

function showAlert(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    alertDiv.style.position = 'fixed';
    alertDiv.style.top = '20px';
    alertDiv.style.right = '20px';
    alertDiv.style.zIndex = '9999';
    alertDiv.style.minWidth = '300px';
    alertDiv.style.animation = 'slideInRight 0.3s ease';

    document.body.appendChild(alertDiv);

    setTimeout(() => {
        alertDiv.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => alertDiv.remove(), 300);
    }, 3000);
}

function showSuccess(message) {
    showAlert(message, 'success');
}

function showError(message) {
    showAlert(message, 'danger');
}

function showWarning(message) {
    showAlert(message, 'warning');
}

function showInfo(message) {
    showAlert(message, 'info');
}

// ============================================
// LOADING SPINNER
// ============================================

function showLoader(container = document.body) {
    const loader = document.createElement('div');
    loader.className = 'spinner';
    loader.id = 'main-loader';
    container.appendChild(loader);
}

function hideLoader() {
    const loader = document.getElementById('main-loader');
    if (loader) {
        loader.remove();
    }
}

// ============================================
// FORM VALIDATION
// ============================================

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function validatePassword(password) {
    // At least 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 symbol
    return password.length >= 8 &&
           /[A-Z]/.test(password) &&
           /[a-z]/.test(password) &&
           /[0-9]/.test(password) &&
           /[\W_]/.test(password);
}

function showFieldError(fieldId, message) {
    const field = document.getElementById(fieldId);
    const errorDiv = field.parentElement.querySelector('.error-message');
    
    field.classList.add('error');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.classList.add('show');
    }
}

function clearFieldError(fieldId) {
    const field = document.getElementById(fieldId);
    const errorDiv = field.parentElement.querySelector('.error-message');
    
    field.classList.remove('error');
    if (errorDiv) {
        errorDiv.classList.remove('show');
    }
}

function clearAllErrors() {
    document.querySelectorAll('.form-control.error').forEach(field => {
        field.classList.remove('error');
    });
    document.querySelectorAll('.error-message.show').forEach(error => {
        error.classList.remove('show');
    });
}

// ============================================
// SESSION/AUTH HELPERS
// ============================================

function isLoggedIn() {
    // Check if user has session (will be verified by backend)
    return sessionStorage.getItem('isLoggedIn') === 'true';
}

function setLoggedIn(userData) {
    sessionStorage.setItem('isLoggedIn', 'true');
    sessionStorage.setItem('userName', userData.name);
    sessionStorage.setItem('userRole', userData.role);
    sessionStorage.setItem('userEmail', userData.email);
}

function clearSession() {
    sessionStorage.clear();
}

function getUserData() {
    return {
        name: sessionStorage.getItem('userName'),
        role: sessionStorage.getItem('userRole'),
        email: sessionStorage.getItem('userEmail')
    };
}

async function logout() {
    try {
        showLoader();
        await apiRequest('/auth/logout', 'POST');
        clearSession();
        showSuccess('Logged out successfully');
        setTimeout(() => {
            window.location.href = '/login_register.html';
        }, 1000);
    } catch (error) {
        showError('Logout failed');
    } finally {
        hideLoader();
    }
}

// ============================================
// MODAL FUNCTIONS
// ============================================

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = 'auto';
    }
}

// Close modal when clicking outside
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('show');
        document.body.style.overflow = 'auto';
    }
});

// ============================================
// DATE/TIME FORMATTING
// ============================================

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showSuccess('Copied to clipboard!');
    }).catch(() => {
        showError('Failed to copy');
    });
}

function getInitials(name) {
    return name
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
}

// ============================================
// REDIRECT TO APPROPRIATE DASHBOARD
// ============================================

function redirectToDashboard(role) {
    const dashboards = {
        'admin': '/admin_dashboard.html',
        'member': '/member_dashboard.html',
        'student': '/student_dashboard.html'
    };
    
    window.location.href = dashboards[role] || '/homepage.html';
}

// ============================================
// PAGE PROTECTION (Check if logged in)
// ============================================

function protectPage(allowedRoles = []) {
    if (!isLoggedIn()) {
        window.location.href = '/login_register.html';
        return false;
    }

    const userRole = sessionStorage.getItem('userRole');
    if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
        showError('Access denied');
        redirectToDashboard(userRole);
        return false;
    }

    return true;
}

// ============================================
// ANIMATIONS
// ============================================

// Add slide-in animation styles
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// ============================================
// EXPORT FOR USE IN OTHER FILES
// ============================================

window.AppUtils = {
    apiRequest,
    showAlert,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showLoader,
    hideLoader,
    validateEmail,
    validatePassword,
    showFieldError,
    clearFieldError,
    clearAllErrors,
    isLoggedIn,
    setLoggedIn,
    clearSession,
    getUserData,
    logout,
    openModal,
    closeModal,
    formatDate,
    formatDateTime,
    formatTime,
    debounce,
    copyToClipboard,
    getInitials,
    redirectToDashboard,
    protectPage
};

console.log('🚀 App utilities loaded');
