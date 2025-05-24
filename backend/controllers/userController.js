// backend/controllers/userController.js
const pool = require('../config/db');

const getSystemUsersCount = async (req, res) => {
    console.log("USER_CTRL: Attempting to get system users count."); // Add a log here
    try {
        const [rows] = await pool.query('SELECT COUNT(*) as count FROM users');
        if (rows && rows.length > 0 && rows[0].count !== undefined) {
            console.log("USER_CTRL: System users count retrieved:", rows[0].count);
            res.json({ count: rows[0].count });
        } else {
            console.error("USER_CTRL: Failed to retrieve count from DB or count is undefined. Rows:", rows);
            res.status(500).json({ message: 'Error fetching users count: Unexpected DB response for count.' });
        }
    } catch (error) {
        console.error('USER_CTRL: SERVER ERROR fetching system users count:', error);
        res.status(500).json({ message: 'Server error fetching users count', error: error.message });
    }
};

// Add other user controller functions here if you have them (e.g., list all users, delete user, etc.)
// const getAllUsersForAdmin = async (req, res) => { /* ... */ };

module.exports = {
    getSystemUsersCount
    // , getAllUsersForAdmin // if you add more
};