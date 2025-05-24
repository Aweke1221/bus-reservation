// backend/testBcrypt.js
const bcrypt = require('bcryptjs');

const plainPassword = 'superSecurePassword123!';
const currentHashInDB = '$2b$10$XgzJ1ZBPOe3ES6h09RPSr.I1KNjZAV5Uzhu7WQ9qaKDTqVF0coCNu'; // The one from hashPassword.js output

bcrypt.compare(plainPassword, currentHashInDB, function(err, result) {
    if (err) {
        console.error("Error during bcrypt.compare:", err);
        return;
    }
    console.log(`Plain: ${plainPassword}`);
    console.log(`Hash from DB:  ${currentHashInDB}`);
    console.log(`Compare Result: ${result}`); // THIS SHOULD NOW BE TRUE
});