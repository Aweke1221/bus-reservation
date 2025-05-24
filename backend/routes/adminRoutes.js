const express = require('express');
const router = express.Router();
const { protect, isAdmin } = require('../middleware/authMiddleware');
router.get('/', protect, isAdmin, (req, res) => {
    res.json({ message: 'Welcome to the Admin Area root API endpoint. Add specific admin routes here.' });
});


module.exports = router;