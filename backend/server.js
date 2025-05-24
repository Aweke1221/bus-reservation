// backend/server.js
const express = require('express');
const cors = require('cors');
require('dotenv').config(); // Ensure this is at the top

// Log as soon as app is created
const app = express();
console.log("SERVER.JS: Express app created.");

// --- Global Middleware ---
app.use(cors()); // Handles Cross-Origin Resource Sharing
console.log("SERVER.JS: CORS middleware applied.");

app.use(express.json()); // Parses incoming JSON requests
console.log("SERVER.JS: express.json middleware applied.");

app.use(express.urlencoded({ extended: true })); // Parses URL-encoded data
console.log("SERVER.JS: express.urlencoded middleware applied.");

// --- Logging Middleware (Optional but helpful) ---
app.use((req, res, next) => {
    console.log(`SERVER.JS: Incoming Request - Method: ${req.method}, URL: ${req.originalUrl}, Timestamp: ${new Date().toISOString()}`);
    // console.log("SERVER.JS: Request Headers:", req.headers); // Can be very verbose
    // req.on('data', chunk => console.log("SERVER.JS: Request Body Chunk:", chunk.toString())); // For debugging raw body
    next();
});

// --- Route Definitions ---
console.log("SERVER.JS: About to mount route handlers...");
const authRoutes = require('./routes/authRoutes');
const busRoutes = require('./routes/busRoutes');
const scheduleRoutes = require('./routes/scheduleRoutes');
const bookingRoutes = require('./routes/bookingRoutes'); // <<< This is the one we are interested in
const routeRoutes = require('./routes/routeRoutes');
const adminRoutes = require('./routes/adminRoutes');
const userRoutes = require('./routes/userRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/buses', busRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/routes', routeRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users', userRoutes);
console.log("SERVER.JS: All route handlers mounted.");

// --- Global Error Handler (Basic) ---
app.use((err, req, res, next) => {
    console.error("SERVER.JS: GLOBAL ERROR HANDLER CAUGHT ---");
    console.error("Error Name:", err.name);
    console.error("Error Message:", err.message);
    console.error("Error Stack:", err.stack);
    console.error("--- END GLOBAL ERROR HANDLER ---");
    res.status(err.status || 500).json({
        message: err.message || 'An unexpected server error occurred.',
        // error: process.env.NODE_ENV === 'development' ? err : {} // Only show stack in dev
    });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    // Check DB connection after server starts listening (db.js already does this)
});