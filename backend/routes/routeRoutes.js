// backend/routes/routeRoutes.js
const express = require('express');
const router = express.Router();
const { protect, isAdmin } = require('../middleware/authMiddleware');

const {
    getAllRoutes,
    createRoute,
    getRouteById,
    updateRoute,
    deleteRoute,
    getUniqueSources,       // <-- IMPORT THIS
    getUniqueDestinations   // <-- IMPORT THIS
} = require('../controllers/routeController');

// --- Routes for dropdowns on the main search page (public) ---
// IMPORTANT: Define these specific string routes BEFORE routes with parameters like /:id
router.get('/sources', getUniqueSources);           // Now getUniqueSources is defined
router.get('/destinations', getUniqueDestinations); // Now getUniqueDestinations is defined

// --- Routes for admin management of routes ---
router.route('/')
    .get(protect, isAdmin, getAllRoutes)
    .post(protect, isAdmin, createRoute);

router.route('/:id')
    .get(protect, isAdmin, getRouteById)
    .put(protect, isAdmin, updateRoute)
    .delete(protect, isAdmin, deleteRoute);

module.exports = router;