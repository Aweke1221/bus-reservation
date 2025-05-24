// backend/hashPassword.js
const bcrypt = require('bcryptjs');

const plainPassword = 'superSecurePassword123!'; // The password we want to use
const saltRounds = 10;

bcrypt.genSalt(saltRounds, function(err, salt) {
    if (err) {
        console.error("Error generating salt:", err);
        return;
    }
    bcrypt.hash(plainPassword, salt, function(err, hash) {
        if (err) {
            console.error("Error hashing password:", err);
            return;
        }
        console.log(`--- CREDENTIALS TO USE ---`);
        console.log(`Plain Password for Login Form: ${plainPassword}`);
        console.log(`Bcrypt Hash for Database (for 'superadmin'): ${hash}`); // This is the hash you need
        console.log(`--------------------------`);
    });
});