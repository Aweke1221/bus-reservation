const express = require('express');
const router = express.Router();
const {
    searchBuses,
    getAllBuses,
    createBus,
    getBusById,
    updateBus,
    deleteBus,
    getBusesCount

} = require('../controllers/busController');
const { protect, isAdmin } = require('../middleware/authMiddleware');

// Public route for searching buses (can be part of schedules too)
router.get('/search', searchBuses); // Example: /api/buses/search?source=CityA&destination=CityB&date=2023-10-27
router.get('/count', protect, isAdmin, getBusesCount);
// Admin routes for managing buses
router.route('/')
    .get(protect, isAdmin, getAllBuses) // Get all buses (Admin)
    .post(protect, isAdmin, createBus); // Create a new bus (Admin)

router.route('/:id')
    .get(protect, isAdmin, getBusById) // Get single bus (Admin)
    .put(protect, isAdmin, updateBus) // Update bus (Admin)
    .delete(protect, isAdmin, deleteBus); // Delete bus (Admin)

module.exports = router;