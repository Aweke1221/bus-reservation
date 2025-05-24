const express = require('express');
const router = express.Router();
const { registerUser, loginUser, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware'); // 'protect' middleware for authenticated routes
const { /* ..., */ getBookingDetailsById } = require('../controllers/bookingController');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/me', protect, getMe); 
router.get('/details/:bookingId', protect, getBookingDetailsById); // New route

module.exports = router;
