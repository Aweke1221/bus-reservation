// backend/routes/userRoutes.js
const express = require('express');
const router = express.Router(); // Router is defined here
const { protect, isAdmin } = require('../middleware/authMiddleware');
const { getSystemUsersCount } = require('../controllers/userController'); // Ensure path is correct

// This will be accessible as GET /api/users/admin/count
router.get('/admin/count', protect, isAdmin, getSystemUsersCount);

// You can add a simple test route here too for debugging:
router.get('/test', (req, res) => {
    res.json({ message: "User routes test endpoint is working!" });
});
// Then try accessing GET http://localhost:5000/api/users/test in Postman/browser

module.exports = router;