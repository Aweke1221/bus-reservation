const express = require('express');
const router = express.Router();
console.log("ROUTES: bookingRoutes.js - File loaded and router instance created.");

const { protect, isAdmin } = require('../middleware/authMiddleware');

// Import ALL necessary controller functions from bookingController
const {
    createBooking,
    getMyBookings,
    getAllBookingsAdmin,
    getAdminBookingsCount,
    cancelBooking,
    getBookingByIdAdmin // Assuming you might add this controller function
} = require('../controllers/bookingController');

// === Public or User-Specific Routes (prefixed with /api/bookings) ===

// POST /api/bookings - User creates a new booking
router.post('/', protect, createBooking);
console.log("ROUTES: bookingRoutes.js - Configured: POST /");

// GET /api/bookings/mybookings - Logged-in user gets their own bookings
router.get('/mybookings', protect, getMyBookings);
console.log("ROUTES: bookingRoutes.js - Configured: GET /mybookings");


// === Admin-Specific Routes (prefixed with /api/bookings) ===

// GET /api/bookings/admin/all - Admin gets all bookings in the system
router.get('/admin/all', protect, isAdmin, getAllBookingsAdmin);
console.log("ROUTES: bookingRoutes.js - Configured: GET /admin/all");

// GET /api/bookings/admin/count - Admin gets total count of all bookings
router.get('/admin/count', protect, isAdmin, getAdminBookingsCount);
console.log("ROUTES: bookingRoutes.js - Configured: GET /admin/count");

// GET /api/bookings/admin/:bookingId - Admin gets a specific booking by its ID (Optional)
// Make sure :bookingId doesn't conflict with other string routes if they come after.
// It's generally fine if other specific string routes are defined before parameterized ones.
if (typeof getBookingByIdAdmin === 'function') { // Only add if controller exists
    router.get('/admin/:bookingId', protect, isAdmin, getBookingByIdAdmin);
    console.log("ROUTES: bookingRoutes.js - Configured: GET /admin/:bookingId");
}


// === Routes for Modifying a Specific Booking (can be user or admin, controller handles logic) ===

// PUT /api/bookings/:bookingId/cancel - User or Admin cancels a booking
// The `protect` middleware ensures user is logged in.
// The `cancelBooking` controller function should check if the req.user.id matches booking's user_id OR if req.user.role is 'admin'.
router.put('/:bookingId/cancel', protect, cancelBooking);
console.log("ROUTES: bookingRoutes.js - Configured: PUT /:bookingId/cancel");


// Note: If you had an admin endpoint to update a booking status manually (e.g., from pending to confirmed, or to update details)
// you might have something like:
// router.put('/admin/:bookingId/status', protect, isAdmin, updateBookingStatusAdmin);
// For now, we only have cancel.

module.exports = router;
console.log("ROUTES: bookingRoutes.js - Router configured and exported.");