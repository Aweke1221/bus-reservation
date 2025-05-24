const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/auth'); // Your JWT secret
const pool = require('../config/db'); // Your database connection pool

const protect = async (req, res, next) => {
      console.log(`MIDDLEWARE: 'protect' INVOKED for ${req.method} ${req.originalUrl} at ${new Date().toLocaleTimeString()}`);
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Get token from header (e.g., "Bearer <token>")
            token = req.headers.authorization.split(' ')[1];

            // Verify token
            const decoded = jwt.verify(token, jwtSecret);

            // Get user from the token's ID, excluding the password
            const [rows] = await pool.query(
                'SELECT id, username, email, role FROM users WHERE id = ?',
                [decoded.id]
            );

            if (rows.length === 0) {
                console.warn(`Auth middleware: User ID ${decoded.id} from token not found in DB.`);
                return res.status(401).json({ message: 'Not authorized, user not found.' });
            }

            req.user = rows[0]; // Attach user object to the request
            next(); // Proceed to the next middleware or route handler
        } catch (error) {
            console.error('Auth middleware error:', error.name, error.message);
            if (error.name === 'JsonWebTokenError') {
                return res.status(401).json({ message: 'Not authorized, token invalid.' });
            }
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({ message: 'Not authorized, token expired.' });
            }
            return res.status(401).json({ message: 'Not authorized, token failed.' });
        }
    }

    if (!token) {
        console.warn('Auth middleware: No token provided.');
        return res.status(401).json({ message: 'Not authorized, no token provided.' });
    }
};

const isAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next(); // User is an admin, proceed
    } else {
        console.warn(`Admin access denied for user: ${req.user ? req.user.username : 'Unknown User'}`);
        return res.status(403).json({ message: 'Forbidden: Not authorized as an admin.' });
    }
};

module.exports = { protect, isAdmin };