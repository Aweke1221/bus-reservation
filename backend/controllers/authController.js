// backend/controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { jwtSecret } = require('../config/auth');

const registerUser = async (req, res) => {
    const { username, email, password } = req.body;
    // Determine role: if 'role' is in req.body and is 'admin', use it. Otherwise, default to 'user'.
    // This is a simple way; a more robust way for admin-creating-admin would be a separate, admin-protected endpoint.
    const roleToAssign = (req.body.role && (req.body.role === 'admin' || req.body.role === 'user')) ? req.body.role : 'user';

    console.log(`AUTH_CTRL: Register attempt - User: '${username}', Email: '${email}', Requested Role in body: '${req.body.role}', Effective Role to be assigned: '${roleToAssign}'`);

    if (!username || !email || !password) {
        console.warn("AUTH_CTRL: Registration validation failed - Missing fields.");
        return res.status(400).json({ message: 'Please provide username, email, and password.' });
    }
    if (password.length < 6) {
        console.warn("AUTH_CTRL: Registration validation failed - Password too short.");
        return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
        console.warn("AUTH_CTRL: Registration validation failed - Invalid email format.");
        return res.status(400).json({ message: 'Please enter a valid email address.' });
    }

    try {
        const [userExists] = await pool.query(
            'SELECT email, username FROM users WHERE email = ? OR username = ?',
            [email, username]
        );
        if (userExists.length > 0) {
            let existingFieldMessage = "User already exists";
            if (userExists[0].email === email && userExists[0].username === username) {
                existingFieldMessage = "User with this email and username already exists.";
            } else if (userExists[0].email === email) {
                existingFieldMessage = "User with this email already exists.";
            } else if (userExists[0].username === username) {
                existingFieldMessage = "User with this username already exists.";
            }
            console.warn(`AUTH_CTRL: Registration - ${existingFieldMessage}`);
            return res.status(400).json({ message: existingFieldMessage });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        console.log(`AUTH_CTRL: Registration - Hashed password for '${username}'.`);

        const [result] = await pool.query(
            'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
            [username, email, hashedPassword, roleToAssign]
        );
        const userId = result.insertId;

        if (userId) {
            console.log(`AUTH_CTRL: User '${username}' (ID: ${userId}) registered successfully with role '${roleToAssign}'.`);
            // For an admin creating another user, you might choose not to return a token for the new user,
            // or return it as this code does. The frontend (admin panel) won't use this new user's token anyway.
            const tokenForNewUser = jwt.sign({ id: userId, role: roleToAssign, username: username }, jwtSecret, { expiresIn: '30d' });
            res.status(201).json({
                message: `User '${username}' registered successfully as ${roleToAssign}.`,
                user: { _id: userId, username: username, email: email, role: roleToAssign },
                token: tokenForNewUser // Token for the newly created user
            });
        } else {
            console.error('AUTH_CTRL: Registration failed - No insertId returned from database.');
            res.status(400).json({ message: 'Invalid user data, registration failed.' });
        }
    } catch (error) {
        console.error('AUTH_CTRL: SERVER ERROR during registration:', error);
        if (error.code === 'ER_DUP_ENTRY') { // Catch duplicate entry on unique constraint
             return res.status(400).json({ message: 'A user with this email or username already exists (database constraint).' });
        }
        res.status(500).json({ message: 'Server error during registration. Please try again later.' });
    }
};

const loginUser = async (req, res) => {
    // ... (Your existing robust loginUser function with detailed logging and bcrypt.compare) ...
    // This function should be correct from previous iterations.
    const { emailOrUsername, password: inputPassword } = req.body;
    console.log("\n--- AUTH_CTRL: LOGIN ATTEMPT ---");
    console.log(`Received emailOrUsername: '${emailOrUsername}'`);
    if (!emailOrUsername || !inputPassword) {
        console.log("AUTH_CTRL: LOGIN VALIDATION: Missing email/username or password.");
        return res.status(400).json({ message: 'Please provide both email/username and password.' });
    }
    try {
        const query = 'SELECT id, username, email, password, role FROM users WHERE email = ? OR username = ?';
        const [users] = await pool.query(query, [emailOrUsername, emailOrUsername]);
        if (users.length === 0) {
            console.warn(`AUTH_CTRL: DATABASE RESULT: User not found for '${emailOrUsername}'.`);
            return res.status(400).json({ message: 'Invalid credentials.' }); // Generic for client
        }
        const user = users[0];
        const storedHashedPassword = user.password;
        console.log(`AUTH_CTRL: STORED HASH from DB (for ${user.username}): '${storedHashedPassword ? storedHashedPassword.substring(0,15) : 'NULL'}...'`);
        if (!storedHashedPassword) { // Should not happen if passwords are required
            console.error(`AUTH_CTRL: User ${user.username} has no password stored!`);
            return res.status(500).json({ message: 'User account configuration error.'});
        }
        const isMatch = await bcrypt.compare(inputPassword, storedHashedPassword);
        console.log(`AUTH_CTRL: BCRYPT COMPARE RESULT (isMatch): ${isMatch}`);
        if (isMatch) {
            console.log(`AUTH_CTRL: LOGIN SUCCESS: Password match for user '${user.username}'. Generating token.`);
            const token = jwt.sign({ id: user.id, role: user.role, username: user.username }, jwtSecret, { expiresIn: '30d' });
            res.json({ _id: user.id, username: user.username, email: user.email, role: user.role, token: token });
        } else {
            console.warn(`AUTH_CTRL: LOGIN FAILED: Password mismatch for user '${user.username}'.`);
            return res.status(400).json({ message: 'Invalid credentials.' }); // Generic for client
        }
    } catch (error) {
        console.error('AUTH_CTRL: LOGIN SERVER ERROR:', error);
        res.status(500).json({ message: 'Server error during login. Please try again later.' });
    }
    console.log("--- AUTH_CTRL: END LOGIN ATTEMPT ---\n");
};

const getMe = async (req, res) => {
    // ... (Your existing getMe function) ...
    if (!req.user) {
        console.error("AUTH_CTRL: GETME ERROR: req.user not found. Middleware issue?");
        return res.status(401).json({ message: 'Not authorized, user data not available.' });
    }
    const { id, username, email, role } = req.user; // Destructure from req.user set by 'protect' middleware
    console.log(`AUTH_CTRL: GETME: Returning user data for ${username}`);
    res.status(200).json({ id, username, email, role });
};

module.exports = {
    registerUser,
    loginUser,
    getMe
};