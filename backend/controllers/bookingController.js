// backend/controllers/bookingController.js
const pool = require('../config/db');

// --- CREATE BOOKING (with Passenger Details and Virtual Schedule Handling) ---
// backend/controllers/bookingController.js
const createBooking = async (req, res) => {
    const { /* ... all expected fields ... */
        is_virtual_booking, bus_id, route_id, departure_time, arrival_time, price_per_seat, // For virtual
        schedule_id // For existing
    } = req.body;
    const user_id = req.user.id;
    // ... (initial validations for num_seats, seat_numbers, passengers)

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        let effective_schedule_id = schedule_id; // Will be from payload if not virtual
        let scheduleDataForBooking;

        if (is_virtual_booking) {
            console.log("CTRL: createBooking - VIRTUAL booking. Materializing new schedule record.");
            // 1. Get bus capacity for the new schedule's seats_available
            const [busRows] = await connection.query('SELECT capacity FROM buses WHERE id = ?', [bus_id]);
            if (busRows.length === 0) throw new Error('Bus for virtual schedule not found.');
            const initial_seats_available = busRows[0].capacity;

            // 2. INSERT the new schedule into the schedules table
            const [schResult] = await connection.query(
                'INSERT INTO schedules (bus_id, route_id, departure_time, arrival_time, price_per_seat, seats_available, is_default_run) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [bus_id, route_id, departure_time, arrival_time, parseFloat(price_per_seat), initial_seats_available, true] // Mark as materialized default
            );
            effective_schedule_id = schResult.insertId; // Use the ID of the newly created schedule
            scheduleDataForBooking = { // Data for this new schedule
                price_per_seat: parseFloat(price_per_seat),
                seats_available: initial_seats_available
            };
            console.log(`CTRL: Virtual schedule materialized into new schedule ID: ${effective_schedule_id}`);
        } else {
            // For existing schedule, lock and get its current state
            const [schedules] = await connection.query(
                'SELECT price_per_seat, seats_available FROM schedules WHERE id = ? FOR UPDATE',
                [effective_schedule_id]
            );
            if (schedules.length === 0) throw new Error('Selected schedule no longer available.');
            scheduleDataForBooking = schedules[0];
        }

        // 3. Check seat availability on the effective_schedule_id
        if (scheduleDataForBooking.seats_available < req.body.num_seats) {
            throw new Error('Not enough seats available on this schedule.');
        }

        // 4. Server-side check for seat conflicts on effective_schedule_id
        const [bookedSeatsRows] = await connection.query("SELECT seat_numbers FROM bookings WHERE schedule_id = ? AND status = 'confirmed' FOR UPDATE", [effective_schedule_id]);
        let allCurrentlyBookedOnThisSchedule = [];
        bookedSeatsRows.forEach(r => { if(r.seat_numbers){try{allCurrentlyBookedOnThisSchedule.push(...JSON.parse(r.seat_numbers));}catch(e){}}});
        for (const seatToBook of req.body.seat_numbers) {
            if (allCurrentlyBookedOnThisSchedule.includes(seatToBook)) {
                throw new Error(`Seat ${seatToBook} was just booked. Please select different seats.`);
            }
        }

        // 5. Create main booking record
        const total_price = scheduleDataForBooking.price_per_seat * req.body.num_seats;
        const seatNumbersJsonString = JSON.stringify(req.body.seat_numbers);
        const [bookingResult] = await connection.query(
            'INSERT INTO bookings (user_id, schedule_id, num_seats, total_price, status, seat_numbers) VALUES (?, ?, ?, ?, ?, ?)',
            [user_id, effective_schedule_id, req.body.num_seats, total_price, 'confirmed', seatNumbersJsonString]
        );
        const newBookingId = bookingResult.insertId;

        // 6. Insert passenger details
        if (req.body.passengers && req.body.passengers.length > 0) {
            const passengerValues = req.body.passengers.map(p => [newBookingId, p.passenger_name, p.passenger_age, p.passenger_gender || null, p.is_child || false, p.seat_number]);
            await connection.query('INSERT INTO booking_passengers (booking_id, passenger_name, passenger_age, passenger_gender, is_child, seat_number) VALUES ?', [passengerValues]);
        }

        // 7. Update seats_available on the (potentially new) schedule record
        const newSeatsAvailable = scheduleDataForBooking.seats_available - req.body.num_seats;
        await connection.query('UPDATE schedules SET seats_available = ? WHERE id = ?', [newSeatsAvailable, effective_schedule_id]);

        await connection.commit();
        res.status(201).json({
            message: 'Booking successful!', bookingId: newBookingId,
            schedule_id: effective_schedule_id, num_seats: req.body.num_seats,
            total_price: total_price, seat_numbers: req.body.seat_numbers
        });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('CTRL: createBooking - SERVER ERROR:', error.message, error.stack);
        res.status(error.message.includes("Seat") || error.message.includes("Not enough seats") ? 409 : 500) // 409 Conflict for seat issues
           .json({ message: error.message || 'Server error during booking process.' });
    } finally {
        if (connection) connection.release();
    }
};
// module.exports = { createBooking, ... }

// --- GET MY BOOKINGS (For logged-in user) ---
const getMyBookings = async (req, res) => {
    const userId = req.user.id;
    console.log(`CTRL: getMyBookings invoked for user ID: ${userId}`);
    try {
        const query = `
            SELECT b.id as booking_id, b.num_seats, b.total_price, b.booking_date, b.status, b.seat_numbers,
                   s.departure_time, s.arrival_time,
                   bu.name as bus_name, bu.registration_number as bus_reg_no,
                   r.source as route_source, r.destination as route_destination
            FROM bookings b
            JOIN schedules s ON b.schedule_id = s.id
            JOIN buses bu ON s.bus_id = bu.id
            JOIN routes r ON s.route_id = r.id
            WHERE b.user_id = ?
            ORDER BY s.departure_time DESC, b.booking_date DESC;
        `;
        const [bookings] = await pool.query(query, [userId]);
        console.log(`CTRL: Found ${bookings.length} bookings for user ID: ${userId}`);
        // Parse seat_numbers if they are stored as JSON strings
        const processedBookings = bookings.map(booking => {
            if (booking.seat_numbers) {
                try {
                    booking.seat_numbers_array = JSON.parse(booking.seat_numbers);
                } catch (e) {
                    console.warn(`CTRL: Could not parse seat_numbers for booking_id ${booking.booking_id}: ${booking.seat_numbers}`);
                    booking.seat_numbers_array = []; // or keep original string
                }
            }
            return booking;
        });
        res.json(processedBookings);
    } catch (error) {
        console.error(`CTRL: SERVER ERROR fetching bookings for user ID ${userId}:`, error);
        res.status(500).json({ message: 'Server error fetching your bookings.', error: error.message });
    }
};

// --- GET ALL BOOKINGS (For Admin) ---
// backend/controllers/bookingController.js

const getAllBookingsAdmin = async (req, res) => {
    console.log("CTRL: getAllBookingsAdmin invoked by admin.");
    try {
        // CAREFULLY REVIEW THIS QUERY AND THE ALIASES
        const query = `
            SELECT
                b.id as booking_id,      -- Booking ID
                b.user_id,               -- User ID from bookings table
                u.username as user_username, -- <<< Fetching username from users table
                b.num_seats,
                b.total_price,
                b.booking_date,
                b.status,
                b.seat_numbers,          -- Assuming you have this column

                s.id as schedule_id,     -- Schedule ID
                s.departure_time,
                s.arrival_time,

                bu.id as bus_id,         -- Bus ID
                bu.name as bus_name,     -- <<< Bus name from buses table
                bu.registration_number as bus_reg_no, -- Bus registration

                r.id as route_id,        -- Route ID
                r.source as route_source,      -- <<< Route source from routes table
                r.destination as route_destination -- <<< Route destination from routes table
            FROM bookings b
            JOIN users u ON b.user_id = u.id
            JOIN schedules s ON b.schedule_id = s.id
            JOIN buses bu ON s.bus_id = bu.id   -- Check: Is s.bus_id the correct foreign key?
            JOIN routes r ON s.route_id = r.id  -- Check: Is s.route_id the correct foreign key?
            ORDER BY b.booking_date DESC;
        `;
        const [bookings] = await pool.query(query);
        console.log(`CTRL: ADMIN - Fetched ${bookings.length} total bookings with details.`);
        // console.log("CTRL: ADMIN - First booking detail:", bookings[0]); // Log first item to check fields

        // Process seat_numbers if stored as JSON strings (optional, but good for consistency)
        const processedBookings = bookings.map(booking => {
            if (booking.seat_numbers) {
                try {
                    booking.seat_numbers_array = JSON.parse(booking.seat_numbers);
                } catch (e) {
                    console.warn(`CTRL: Could not parse seat_numbers for booking_id ${booking.booking_id}: ${booking.seat_numbers}`);
                    booking.seat_numbers_array = []; // Default to empty array on parse error
                }
            }
            return booking;
        });
        res.json(processedBookings);

    } catch (error) {
        console.error('CTRL: ADMIN SERVER ERROR fetching all bookings:', error);
        res.status(500).json({ message: 'Server error fetching all bookings', error: error.message });
    }
};



// --- GET BOOKINGS COUNT (For Admin Dashboard) ---
const getAdminBookingsCount = async (req, res) => {
    console.log("CTRL: getAdminBookingsCount invoked by admin.");
    try {
        const [rows] = await pool.query('SELECT COUNT(*) as count FROM bookings');
        res.json({ count: rows[0].count });
    } catch (error) {
        console.error('CTRL: ADMIN SERVER ERROR fetching bookings count:', error);
        res.status(500).json({ message: 'Error fetching bookings count', error: error.message });
    }
};

// --- CANCEL BOOKING (By User or Admin - needs different auth logic if admin cancels any) ---
const cancelBooking = async (req, res) => {
    const { bookingId } = req.params;
    const userId = req.user.id; // User cancelling their own booking
    const userRole = req.user.role;
    console.log(`CTRL: cancelBooking invoked by user ${userId} (Role: ${userRole}) for booking ID: ${bookingId}`);

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        let bookingToCancel;
        if (userRole === 'admin') { // Admin can cancel any booking
            const [adminBookingRows] = await connection.query(
                'SELECT id, schedule_id, num_seats, status FROM bookings WHERE id = ? FOR UPDATE', [bookingId]
            );
            if (adminBookingRows.length === 0) {
                await connection.rollback(); return res.status(404).json({ message: 'Booking not found.' });
            }
            bookingToCancel = adminBookingRows[0];
        } else { // User can only cancel their own
            const [userBookingRows] = await connection.query(
                'SELECT id, schedule_id, num_seats, status FROM bookings WHERE id = ? AND user_id = ? FOR UPDATE',
                [bookingId, userId]
            );
            if (userBookingRows.length === 0) {
                await connection.rollback(); return res.status(404).json({ message: 'Booking not found or you are not authorized.' });
            }
            bookingToCancel = userBookingRows[0];
        }

        if (bookingToCancel.status !== 'confirmed' && bookingToCancel.status !== 'pending') {
            await connection.rollback(); return res.status(400).json({ message: `Booking cannot be cancelled. Status: ${bookingToCancel.status}` });
        }

        await connection.query('UPDATE bookings SET status = ? WHERE id = ?', ['cancelled', bookingToCancel.id]);
        await connection.query('UPDATE schedules SET seats_available = seats_available + ? WHERE id = ?', [bookingToCancel.num_seats, bookingToCancel.schedule_id]);
        // If using a separate booked_seats table, you'd delete those seat records here.

        await connection.commit();
        console.log(`CTRL: Booking ID ${bookingId} cancelled successfully.`);
        res.json({ message: 'Booking cancelled successfully.' });
    } catch (error) {
        if(connection) await connection.rollback();
        console.error(`CTRL: SERVER ERROR cancelling booking ID ${bookingId}:`, error);
        res.status(500).json({ message: 'Server error cancelling booking.', error: error.message });
    } finally {
        if (connection) connection.release();
    }
};
// ... (other booking controller functions) ...

const getBookingDetailsById = async (req, res) => {
    const { bookingId } = req.params;
    const userId = req.user.id; // From protect middleware
    const userRole = req.user.role;
    console.log(`CTRL: getBookingDetailsById for booking ID: ${bookingId}, User ID: ${userId}, Role: ${userRole}`);

    try {
        let query = `
            SELECT
                b.id as booking_id, b.user_id, b.num_seats, b.total_price, b.booking_date, b.status, b.seat_numbers,
                s.departure_time, s.arrival_time,
                bu.name as bus_name, bu.registration_number as bus_reg_no,
                r.source as route_source, r.destination as route_destination
            FROM bookings b
            JOIN schedules s ON b.schedule_id = s.id
            JOIN buses bu ON s.bus_id = bu.id
            JOIN routes r ON s.route_id = r.id
            WHERE b.id = ?
        `;
        const queryParams = [bookingId];

        // If not an admin, ensure the user owns this booking
        if (userRole !== 'admin') {
            query += ' AND b.user_id = ?';
            queryParams.push(userId);
        }

        const [bookingRows] = await connection.query(query, queryParams); // Assuming 'connection' or use 'pool'

        if (bookingRows.length === 0) {
            return res.status(404).json({ message: "Booking not found or not authorized." });
        }
        let booking = bookingRows[0];

        // Parse seat_numbers
        if (booking.seat_numbers) {
            try { booking.seat_numbers_array = JSON.parse(booking.seat_numbers); }
            catch (e) { booking.seat_numbers_array = []; }
        }

        // Fetch associated passengers
        const [passengers] = await connection.query( // Assuming 'connection' or use 'pool'
            'SELECT passenger_name, passenger_age, passenger_gender, is_child, seat_number FROM booking_passengers WHERE booking_id = ? ORDER BY id ASC',
            [bookingId]
        );
        booking.passengers = passengers;

        console.log("CTRL: Sending detailed booking:", booking);
        res.json(booking);

    } catch (error) {
        console.error(`CTRL: Error fetching booking details for ID ${bookingId}:`, error);
        res.status(500).json({ message: "Server error fetching booking details.", error: error.message });
    }
};


// Add getBookingDetailsById to module.exports


module.exports = {
    getBookingDetailsById,
    createBooking,
    getMyBookings,          // Now defined
    getAllBookingsAdmin,    // Now defined
    getAdminBookingsCount,  // Now defined
    cancelBooking           // Now defined
};