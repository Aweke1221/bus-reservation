// backend/controllers/routeController.js
const pool = require('../config/db');

// --- Existing Functions (getAllRoutes, createRoute, getRouteById, updateRoute, deleteRoute) ---
const getAllRoutes = async (req, res) => {
    console.log("CTRL: getAllRoutes invoked");
    try {
        const [routes] = await pool.query('SELECT id, source, destination FROM routes ORDER BY source ASC, destination ASC');
        res.json(routes);
    } catch (error) {
        console.error('CTRL: getAllRoutes - SERVER ERROR:', error);
        res.status(500).json({ message: 'Server error fetching all routes', error: error.message });
    }
};

const createRoute = async (req, res) => {
    // ... your createRoute logic ...
    const { source, destination } = req.body;
    console.log("CTRL: createRoute invoked with:", { source, destination });
    if (!source || !destination) {
        return res.status(400).json({ message: 'Source and destination are required.' });
    }
    if (source.toLowerCase() === destination.toLowerCase()) {
        return res.status(400).json({ message: 'Source and destination cannot be the same.' });
    }
    try {
        const [existingRoute] = await pool.query(
            'SELECT id FROM routes WHERE LOWER(source) = LOWER(?) AND LOWER(destination) = LOWER(?)',
            [source, destination]
        );
        if (existingRoute.length > 0) {
            return res.status(400).json({ message: 'This route already exists.' });
        }
        const [result] = await pool.query(
            'INSERT INTO routes (source, destination) VALUES (?, ?)',
            [source, destination]
        );
        res.status(201).json({ id: result.insertId, source, destination });
    } catch (error) {
        console.error('CTRL: createRoute - SERVER ERROR:', error);
        res.status(500).json({ message: 'Server error creating route', error: error.message });
    }
};

const getRouteById = async (req, res) => {
    // ... your getRouteById logic ...
    const routeId = req.params.id;
    console.log("CTRL: getRouteById invoked for ID:", routeId);
    try {
        const [route] = await pool.query('SELECT * FROM routes WHERE id = ?', [routeId]);
        if (route.length === 0) return res.status(404).json({ message: 'Route not found' });
        res.json(route[0]);
    } catch (error) {
        console.error(`CTRL: getRouteById - SERVER ERROR for ID ${routeId}:`, error);
        res.status(500).json({ message: 'Server error fetching route by ID', error: error.message });
    }
};

const updateRoute = async (req, res) => {
    // ... your updateRoute logic ...
    const routeId = req.params.id;
    const { source, destination } = req.body;
    console.log(`CTRL: updateRoute invoked for ID ${routeId} with:`, { source, destination });
    // ... validation ...
    try {
        const [result] = await pool.query(
            'UPDATE routes SET source = ?, destination = ? WHERE id = ?',
            [source, destination, routeId]
        );
        // ... check affectedRows and existing route logic ...
        if (result.affectedRows === 0) {
             const [routeExists] = await pool.query('SELECT id FROM routes WHERE id = ?', [routeId]);
             if(routeExists.length === 0) return res.status(404).json({ message: 'Route not found.' });
             return res.json({ message: 'Route data was the same, no changes made.' });
        }
        res.json({ message: 'Route updated successfully' });
    } catch (error) {
        console.error(`CTRL: updateRoute - SERVER ERROR for ID ${routeId}:`, error);
        res.status(500).json({ message: 'Server error updating route', error: error.message });
    }
};

const deleteRoute = async (req, res) => {
    // ... your deleteRoute logic ...
    const routeId = req.params.id;
    console.log("CTRL: deleteRoute invoked for ID:", routeId);
    try {
        const [schedules] = await pool.query('SELECT id FROM schedules WHERE route_id = ?', [routeId]);
        if (schedules.length > 0) {
            return res.status(400).json({ message: 'Cannot delete route. It is used in existing schedules.' });
        }
        const [result] = await pool.query('DELETE FROM routes WHERE id = ?', [routeId]);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Route not found' });
        res.json({ message: 'Route deleted successfully' });
    } catch (error) {
        console.error(`CTRL: deleteRoute - SERVER ERROR for ID ${routeId}:`, error);
        res.status(500).json({ message: 'Server error deleting route', error: error.message });
    }
};
// --- END Existing Functions ---


// --- NEW FUNCTIONS for Dropdowns ---
// @desc    Get all unique source locations
// @route   GET /api/routes/sources
// @access  Public (usually, for search forms)
const getUniqueSources = async (req, res) => {
    console.log("CTRL: getUniqueSources invoked");
    try {
        const [sources] = await pool.query('SELECT DISTINCT source FROM routes ORDER BY source ASC');
        // The query returns an array of objects like [{source: 'CityA'}, {source: 'CityB'}].
        // The frontend expects an array of strings: ['CityA', 'CityB'].
        res.json(sources.map(item => item.source));
    } catch (error) {
        console.error('CTRL: getUniqueSources - SERVER ERROR:', error);
        res.status(500).json({ message: "Error fetching unique source locations", error: error.message });
    }
};

// @desc    Get all unique destination locations
// @route   GET /api/routes/destinations
// @access  Public (usually, for search forms)
const getUniqueDestinations = async (req, res) => {
    console.log("CTRL: getUniqueDestinations invoked");
    try {
        const [destinations] = await pool.query('SELECT DISTINCT destination FROM routes ORDER BY destination ASC');
        // Similar to sources, map to an array of strings.
        res.json(destinations.map(item => item.destination));
    } catch (error) {
        console.error('CTRL: getUniqueDestinations - SERVER ERROR:', error);
        res.status(500).json({ message: "Error fetching unique destination locations", error: error.message });
    }
};
// --- END NEW FUNCTIONS ---

module.exports = {
    getAllRoutes,
    createRoute,
    getRouteById,
    updateRoute,
    deleteRoute,
    getUniqueSources,       // <-- EXPORT THIS
    getUniqueDestinations   // <-- EXPORT THIS
};