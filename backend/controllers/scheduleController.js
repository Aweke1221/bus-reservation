// backend/controllers/scheduleController.js
const pool = require('../config/db');

// @desc    Get count of all schedules
// @route   GET /api/schedules/count
// @access  Private/Admin
const getSchedulesCount = async (req, res) => {
    console.log("SCH_CTRL: getSchedulesCount invoked");
    try {
        const [rows] = await pool.query('SELECT COUNT(*) as count FROM schedules');
        if (rows && rows.length > 0 && rows[0].count !== undefined) {
            console.log("SCH_CTRL: getSchedulesCount - Count:", rows[0].count);
            res.json({ count: rows[0].count });
        } else {
            console.error("SCH_CTRL: getSchedulesCount - Failed to retrieve count or count is undefined. Rows:", rows);
            res.status(500).json({ message: 'Error fetching schedule count: Unexpected database response.' });
        }
    } catch (error) {
        console.error('SCH_CTRL: getSchedulesCount - SERVER ERROR:', error);
        res.status(500).json({ message: 'Server error fetching schedule count', error: error.message });
    }
};

// @desc    Create a new schedule
// @route   POST /api/schedules
// @access  Private/Admin
const createSchedule = async (req, res) => {
    const { bus_id, route_id, departure_time, arrival_time, price_per_seat } = req.body;
    console.log("SCH_CTRL: createSchedule invoked with data:", req.body);

    if (!bus_id || !route_id || !departure_time || !arrival_time || price_per_seat === undefined || isNaN(parseFloat(price_per_seat)) || parseFloat(price_per_seat) < 0) {
        return res.status(400).json({ message: 'All fields are required: bus_id, route_id, valid departure/arrival times, and a non-negative price_per_seat.' });
    }
    // Add validation for date formats if necessary, e.g., ensuring they are valid ISO-like strings

    try {
        const [busRows] = await pool.query('SELECT capacity FROM buses WHERE id = ?', [bus_id]);
        if (busRows.length === 0) return res.status(404).json({ message: 'Bus not found.' });
        const seats_available = busRows[0].capacity;

        const [routeRows] = await pool.query('SELECT id FROM routes WHERE id = ?', [route_id]);
        if (routeRows.length === 0) return res.status(404).json({ message: 'Route not found.' });

        const [result] = await pool.query(
            'INSERT INTO schedules (bus_id, route_id, departure_time, arrival_time, price_per_seat, seats_available) VALUES (?, ?, ?, ?, ?, ?)',
            [bus_id, route_id, departure_time, arrival_time, parseFloat(price_per_seat), seats_available]
        );
        console.log("SCH_CTRL: Schedule created successfully, ID:", result.insertId);
        res.status(201).json({
            id: result.insertId, bus_id, route_id, departure_time, arrival_time,
            price_per_seat: parseFloat(price_per_seat), seats_available
        });
    } catch (error) {
        console.error("SCH_CTRL: Error in createSchedule:", error);
        res.status(500).json({ message: 'Server error creating schedule', error: error.message });
    }
};

// @desc    Get all schedules (with bus and route details for admin)
// @route   GET /api/schedules
// @access  Private/Admin
const getAllSchedules = async (req, res) => {
    console.log("SCH_CTRL: getAllSchedules invoked by admin.");
    try {
        const query = `
            SELECT s.id, s.departure_time, s.arrival_time, s.price_per_seat, s.seats_available, s.created_at,
                   b.name as bus_name, b.registration_number,
                   r.source as route_source, r.destination as route_destination
            FROM schedules s
            JOIN buses b ON s.bus_id = b.id
            JOIN routes r ON s.route_id = r.id
            ORDER BY s.departure_time ASC;
        `;
        const [schedules] = await pool.query(query);
        console.log(`SCH_CTRL: Fetched ${schedules.length} schedules for admin.`);
        res.json(schedules);
    } catch (error) {
        console.error("SCH_CTRL: Error in getAllSchedules:", error);
        res.status(500).json({ message: 'Server error fetching schedules', error: error.message });
    }
};

// @desc    Get a single schedule by ID (for admin edit form)
// @route   GET /api/schedules/:schedule_id_param
// @access  Private/Admin
const getScheduleById = async (req, res) => {
    const scheduleId = req.params.schedule_id_param; // Matching param name from routes
    console.log(`SCH_CTRL: getScheduleById invoked for ID: ${scheduleId}`);
    try {
        const query = `
            SELECT s.*, b.name as bus_name, b.registration_number,
                   r.source as route_source, r.destination as route_destination
            FROM schedules s
            JOIN buses b ON s.bus_id = b.id
            JOIN routes r ON s.route_id = r.id
            WHERE s.id = ?;
        `;
        const [schedule] = await pool.query(query, [scheduleId]);
        if (schedule.length === 0) {
            return res.status(404).json({ message: 'Schedule not found' });
        }
        console.log(`SCH_CTRL: Found schedule for ID ${scheduleId}:`, schedule[0]);
        res.json(schedule[0]);
    } catch (error) {
        console.error(`SCH_CTRL: Error in getScheduleById for ID ${scheduleId}:`, error);
        res.status(500).json({ message: 'Server error fetching schedule', error: error.message });
    }
};

// @desc    Get schedule details (capacity, booked seats) for seat selection map
// @route   GET /api/schedules/:schedule_id_param/details
// @access  Private (User needs to be logged in)
const getScheduleDetailsForSeatSelection = async (req, res) => {
    const scheduleId = req.params.schedule_id_param; // Matching param name from routes
    console.log(`SCH_CTRL: getScheduleDetailsForSeatSelection invoked for Schedule ID: ${scheduleId}`);

    if (!scheduleId || isNaN(parseInt(scheduleId))) {
        console.warn("SCH_CTRL: Invalid schedule_id received for seat details:", scheduleId);
        return res.status(400).json({ message: "Invalid schedule ID format." });
    }

    try {
        const [scheduleInfoRows] = await pool.query(
            `SELECT s.id as schedule_id, b.capacity as bus_capacity
             FROM schedules s
             JOIN buses b ON s.bus_id = b.id
             WHERE s.id = ?`, [scheduleId]
        );
        if (scheduleInfoRows.length === 0) {
            console.warn(`SCH_CTRL: Schedule not found for seat details, ID: ${scheduleId}`);
            return res.status(404).json({ message: "Schedule not found for seat details." });
        }
        const busCapacity = scheduleInfoRows[0].bus_capacity;
        console.log(`SCH_CTRL: Bus capacity for schedule ${scheduleId} is ${busCapacity}`);

        const [bookingSeatRows] = await pool.query(
            "SELECT seat_numbers FROM bookings WHERE schedule_id = ? AND status = 'confirmed'", [scheduleId]
        );
        let bookedSeatsList = [];
        bookingSeatRows.forEach(row => {
            if (row.seat_numbers) {
                try {
                    const seats = JSON.parse(row.seat_numbers);
                    if (Array.isArray(seats)) bookedSeatsList.push(...seats.filter(s => typeof s === 'string'));
                } catch (e) { console.error(`SCH_CTRL: Error parsing seat_numbers '${row.seat_numbers}' for schedule ${scheduleId}:`, e); }
            }
        });
        console.log(`SCH_CTRL: Booked seats list for schedule ${scheduleId}:`, bookedSeatsList);
        res.json({ bus_capacity: busCapacity, booked_seats_list: bookedSeatsList });
    } catch (error) {
        console.error(`SCH_CTRL: SERVER ERROR fetching schedule details for seat selection (Schedule ID ${scheduleId}):`, error);
        res.status(500).json({ message: "Server error fetching schedule details for seat selection.", error: error.message });
    }
};

// @desc    Update a schedule
// @route   PUT /api/schedules/:schedule_id_param
// @access  Private/Admin
const updateSchedule = async (req, res) => {
    const scheduleId = req.params.schedule_id_param;
    const { bus_id, route_id, departure_time, arrival_time, price_per_seat, seats_available } = req.body;
    console.log(`SCH_CTRL: updateSchedule invoked for ID: ${scheduleId} with data:`, req.body);

    if (!bus_id || !route_id || !departure_time || !arrival_time || price_per_seat === undefined || seats_available === undefined) {
        return res.status(400).json({ message: 'All fields are required for update.' });
    }
    // Add more validation for data types and values

    try {
        const [busExists] = await pool.query('SELECT id FROM buses WHERE id = ?', [bus_id]);
        if (busExists.length === 0) return res.status(404).json({ message: 'Bus specified not found.' });
        const [routeExists] = await pool.query('SELECT id FROM routes WHERE id = ?', [route_id]);
        if (routeExists.length === 0) return res.status(404).json({ message: 'Route specified not found.' });

        const [result] = await pool.query(
            'UPDATE schedules SET bus_id = ?, route_id = ?, departure_time = ?, arrival_time = ?, price_per_seat = ?, seats_available = ? WHERE id = ?',
            [bus_id, route_id, departure_time, arrival_time, parseFloat(price_per_seat), parseInt(seats_available), scheduleId]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Schedule not found or no changes made (data might be identical).' });
        }
        console.log(`SCH_CTRL: Schedule ID ${scheduleId} updated successfully.`);
        res.json({ message: 'Schedule updated successfully' });
    } catch (error) {
        console.error(`SCH_CTRL: Error in updateSchedule for ID ${scheduleId}:`, error);
        res.status(500).json({ message: 'Server error updating schedule', error: error.message });
    }
};

// @desc    Delete a schedule
// @route   DELETE /api/schedules/:schedule_id_param
// @access  Private/Admin
const deleteSchedule = async (req, res) => {
    const scheduleId = req.params.schedule_id_param;
    console.log(`SCH_CTRL: deleteSchedule invoked for ID: ${scheduleId}`);
    try {
        const [bookings] = await pool.query("SELECT id FROM bookings WHERE schedule_id = ? AND status = 'confirmed'", [scheduleId]);
        if (bookings.length > 0) {
            return res.status(400).json({ message: 'Cannot delete schedule. There are active confirmed bookings associated with it.' });
        }
        const [result] = await pool.query('DELETE FROM schedules WHERE id = ?', [scheduleId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Schedule not found.' });
        }
        console.log(`SCH_CTRL: Schedule ID ${scheduleId} deleted successfully.`);
        res.json({ message: 'Schedule deleted successfully.' });
    } catch (error) {
        console.error(`SCH_CTRL: Error in deleteSchedule for ID ${scheduleId}:`, error);
        res.status(500).json({ message: 'Server error deleting schedule', error: error.message });
    }
};

module.exports = {
    getSchedulesCount,
    createSchedule,
    getAllSchedules,
    getScheduleById,
    getScheduleDetailsForSeatSelection, //  <<< MAKE SURE THIS IS EXPORTED
    updateSchedule,
    deleteSchedule
};