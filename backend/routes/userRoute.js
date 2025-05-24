const pool = require('../config/db');
// ... other user functions if any ...

const getSystemUsersCount = async (req, res) => {
    console.log("USER_CTRL: getSystemUsersCount invoked");
    try {
        const [rows] = await pool.query('SELECT COUNT(*) as count FROM users');
        res.json({ count: rows[0].count });
    } catch (error) {
        console.error('USER_CTRL: Error fetching system users count:', error);
        res.status(500).json({ message: 'Error fetching users count' });
    }
};
module.exports = { /* ... other exports ... */ getSystemUsersCount };