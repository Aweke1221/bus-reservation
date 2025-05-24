// frontend/js/common.js
const API_BASE_URL = 'http://localhost:5000/api';
console.log(`COMMON.JS: Script loaded at ${new Date().toLocaleTimeString()}. API_BASE_URL: ${API_BASE_URL}`);

function storeToken(token) {
    if (token && typeof token === 'string') {
        localStorage.setItem('authToken', token);
        console.log("COMMON.JS: Auth token stored.");
    } else {
        console.warn("COMMON.JS: storeToken called with invalid token:", token);
    }
}

function getToken() {
    return localStorage.getItem('authToken');
}

function storeUser(userData) {
    if (userData && typeof userData === 'object' && userData._id) {
        const minimalUser = {
            _id: userData._id,
            username: userData.username,
            email: userData.email,
            role: userData.role
        };
        localStorage.setItem('currentUser', JSON.stringify(minimalUser));
        console.log("COMMON.JS: Current user data stored:", minimalUser);
    } else {
        console.warn("COMMON.JS: storeUser called with invalid userData:", userData);
    }
}

function getCurrentUser() {
    const userString = localStorage.getItem('currentUser');
    if (userString) {
        try {
            return JSON.parse(userString);
        } catch (e) {
            console.error("COMMON.JS: Error parsing currentUser from localStorage. Clearing it.", e);
            localStorage.removeItem('currentUser');
            return null;
        }
    }
    return null;
}

function updateNav() {
    console.log("COMMON.JS: updateNav() called.");
    const token = getToken(); const user = getCurrentUser();
    const navLogin = document.getElementById('nav-login');
    const navRegister = document.getElementById('nav-register');
    const navMyBookings = document.getElementById('nav-my-bookings');
    const navMyAccount = document.getElementById('nav-my-account');
    const navAdminDashboard = document.getElementById('nav-admin-dashboard');
    const navLogout = document.getElementById('nav-logout');

    // Small screen versions (assuming these IDs exist in your HTML if you use them)
    const navLoginSm = document.getElementById('nav-login-sm');
    const navRegisterSm = document.getElementById('nav-register-sm');
    const navMyBookingsSm = document.getElementById('nav-my-bookings-sm');
    const navMyAccountSm = document.getElementById('nav-my-account-sm');
    const navAdminDashboardSm = document.getElementById('nav-admin-dashboard-sm');
    const navLogoutSm = document.getElementById('nav-logout-sm');

    const adminUsernameElem = document.getElementById('adminUsernameDisplay'); // On admin page

    const show = (el) => { if (el) el.style.display = 'list-item'; }; // For Bootstrap navbar items
    const hide = (el) => { if (el) el.style.display = 'none'; };

    if (token && user) {
        hide(navLogin); hide(navRegister); if(navLoginSm) hide(navLoginSm); if(navRegisterSm) hide(navRegisterSm);
        show(navLogout); if(navLogoutSm) show(navLogoutSm);

        if (user.role === 'admin') {
            show(navAdminDashboard); if(navAdminDashboardSm) show(navAdminDashboardSm);
            hide(navMyBookings); hide(navMyAccount); if(navMyBookingsSm) hide(navMyBookingsSm); if(navMyAccountSm) hide(navMyAccountSm);
            if(adminUsernameElem && window.location.pathname.includes('/admin/')) adminUsernameElem.textContent = user.username;
        } else { // 'user' role
            hide(navAdminDashboard); if(navAdminDashboardSm) hide(navAdminDashboardSm);
            show(navMyBookings); show(navMyAccount); if(navMyBookingsSm) show(navMyBookingsSm); if(navMyAccountSm) show(navMyAccountSm);
        }
    } else { // Not logged in
        show(navLogin); show(navRegister); if(navLoginSm) show(navLoginSm); if(navRegisterSm) show(navRegisterSm);
        hide(navMyBookings); hide(navMyAccount); hide(navAdminDashboard); hide(navLogout);
        hide(navMyBookingsSm); hide(navMyAccountSm); hide(navAdminDashboardSm); hide(navLogoutSm);
        if(adminUsernameElem && window.location.pathname.includes('/admin/')) adminUsernameElem.textContent = 'Admin';
    }
}

function logoutUser() {
    const pathBeforeLogout = window.location.pathname;
    console.log(`COMMON.JS: logoutUser() called from page: ${pathBeforeLogout}`);
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    console.log("COMMON.JS: authToken and currentUser removed.");

    // Redirect to homepage - this assumes your server root is the 'frontend/' directory.
    const targetUrl = './index.html';
    console.log(`COMMON.JS: Redirecting to ${targetUrl}`);
    window.location.href = targetUrl;
}

document.addEventListener('DOMContentLoaded', () => {
    console.log(`COMMON.JS: DOMContentLoaded for ${window.location.pathname}. Calling updateNav.`);
    updateNav();
});

console.log("COMMON.JS: Script fully parsed.");