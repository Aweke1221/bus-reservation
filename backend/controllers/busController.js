const pool = require('../config/db');

const searchBuses = async (req, res) => {
    const { source, destination, date } = req.query;
    console.log(`BUS_CTRL: searchBuses - Src: ${source}, Dst: ${destination}, Date: ${date}`);

    if (!source || !destination || !date) {
        return res.status(400).json({ message: 'Source, destination, and date are required.' });
    }

    try {
        const connection = await pool.getConnection();
        let finalSchedulesToDisplay = [];

        const explicitSchedulesQuery = `
            SELECT
                s.id as schedule_id, s.departure_time, s.arrival_time, s.price_per_seat, s.seats_available,
                b.id as bus_id, b.name as bus_name, b.registration_number, b.capacity as bus_capacity,
                r.id as route_id, r.source, r.destination,
                FALSE AS is_virtual
            FROM schedules s
            JOIN buses b ON s.bus_id = b.id
            JOIN routes r ON s.route_id = r.id
            WHERE r.source = ? AND r.destination = ? AND DATE(s.departure_time) = ? AND s.seats_available > 0
            ORDER BY s.departure_time ASC;
        `;
        const [explicitDbSchedules] = await connection.query(explicitSchedulesQuery, [source, destination, date]);
        finalSchedulesToDisplay = explicitDbSchedules.map(s => ({ ...s, bus_capacity: s.bus_capacity || 0 })); // Ensure bus_capacity is present
        console.log(`BUS_CTRL: searchBuses - Found ${explicitDbSchedules.length} explicit schedules.`);

        const [routeInfoRows] = await connection.query(
            'SELECT id, default_price_suggestion FROM routes WHERE source = ? AND destination = ? LIMIT 1',
            [source, destination]
        );

        if (routeInfoRows.length > 0) {
            const routeIdForSearch = routeInfoRows[0].id;
            const routeDefaultPrice = routeInfoRows[0].default_price_suggestion || 150.00; // Arbitrary fallback

            const [allActiveBuses] = await connection.query(
                'SELECT id, name, registration_number, capacity FROM buses WHERE is_active = TRUE'
            );
            console.log(`BUS_CTRL: searchBuses - Found ${allActiveBuses.length} active buses for virtual consideration.`);

            const defaultDepartureTimeStr = `${date} 10:00:00`;
            const defaultArrivalTimeStr = `${date} 21:00:00`;

            for (const bus of allActiveBuses) {
                const explicitScheduleExistsForThisBusRouteDay = explicitDbSchedules.some(
                    exSch => exSch.bus_id === bus.id && exSch.route_id === routeIdForSearch
                    // A simpler check: if any explicit schedule for this bus/route/day exists, don't show default.
                    // More complex: only skip if explicit schedule is *at the same default time*.
                );

                if (!explicitScheduleExistsForThisBusRouteDay) {
                    finalSchedulesToDisplay.push({
                        schedule_id: null,
                        bus_id: bus.id,
                        bus_name: bus.name,
                        registration_number: bus.registration_number,
                        bus_capacity: bus.capacity,
                        route_id: routeIdForSearch,
                        source: source,
                        destination: destination,
                        departure_time: defaultDepartureTimeStr,
                        arrival_time: defaultArrivalTimeStr,
                        price_per_seat: routeDefaultPrice,
                        seats_available: bus.capacity,
                        is_virtual: true
                    });
                }
            }
        } else {
            console.log(`BUS_CTRL: searchBuses - Route from '${source}' to '${destination}' not found. No virtual schedules generated.`);
        }

        connection.release();
        console.log(`BUS_CTRL: searchBuses - Sending total ${finalSchedulesToDisplay.length} schedules.`);

        finalSchedulesToDisplay.sort((a, b) => {
            const depA = new Date(a.departure_time).getTime();
            const depB = new Date(b.departure_time).getTime();
            if (depA !== depB) return depA - depB;
            if (a.is_virtual && !b.is_virtual) return 1; // explicit schedules first if same time
            if (!a.is_virtual && b.is_virtual) return -1;
            return (a.bus_name || "").localeCompare(b.bus_name || "");
        });

        res.json(finalSchedulesToDisplay);

    } catch (error) {
        console.error("BUS_CTRL: Error in searchBuses (with virtual schedules):", error);
        res.status(500).json({ message: "Error searching for buses.", error: error.message });
    }
};

const getAllBuses = async (req, res) => {
    try {
        const [buses] = await pool.query('SELECT id, name, registration_number, capacity, is_active FROM buses ORDER BY name ASC');
        res.json(buses);
    } catch (error) {
        console.error('BUS_CTRL: Error getAllBuses:', error);
        res.status(500).json({ message: 'Server error fetching buses', error: error.message });
    }
};

const getBusesCount = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT COUNT(*) as count FROM buses WHERE is_active = TRUE');
        res.json({ count: rows[0].count });
    } catch (error) {
        console.error('BUS_CTRL: Error getBusesCount:', error);
        res.status(500).json({ message: 'Error fetching bus count', error: error.message });
    }
};

const createBus = async (req, res) => {
    const { name, registration_number, capacity, is_active = true } = req.body;
    if (!name || !registration_number || !capacity || isNaN(parseInt(capacity)) || parseInt(capacity) <= 0) {
        return res.status(400).json({ message: 'Valid name, registration number, and positive capacity required.' });
    }
    try {
        const [result] = await pool.query(
            'INSERT INTO buses (name, registration_number, capacity, is_active) VALUES (?, ?, ?, ?)',
            [name, registration_number, parseInt(capacity), is_active]
        );
        res.status(201).json({ id: result.insertId, name, registration_number, capacity: parseInt(capacity), is_active });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: 'Registration number already exists.' });
        }
        console.error("BUS_CTRL: Error createBus:", error);
        res.status(500).json({ message: 'Server error creating bus', error: error.message });
    }
};

const getBusById = async (req, res) => {
    try {
        const [bus] = await pool.query('SELECT * FROM buses WHERE id = ?', [req.params.id]);
        if (bus.length === 0) {
            return res.status(404).json({ message: 'Bus not found' });
        }
        res.json(bus[0]);
    } catch (error) {
        console.error("BUS_CTRL: Error getBusById:", error);
        res.status(500).json({ message: 'Server error fetching bus', error: error.message });
    }
};

const updateBus = async (req, res) => {
    const busId = req.params.id;
    const { name, registration_number, capacity, is_active } = req.body;
    console.log(`BUS_CTRL: updateBus - ID: ${busId}, Data:`, req.body);

    if (!name || !registration_number || capacity === undefined || isNaN(parseInt(capacity)) || parseInt(capacity) <= 0) {
        return res.status(400).json({ message: 'Name, registration number, and valid capacity are required.' });
    }
    // is_active can be true or false, or undefined (in which case we don't update it, or set a default)
    // For simplicity, if is_active is passed, we use it. Otherwise, it's not updated.
    // This requires a more dynamic query or fetching current state first if you want to conditionally update.
    // For now, assume frontend sends it if it's meant to be changed.

    let query;
    let queryParams;

    if (is_active !== undefined) {
        query = 'UPDATE buses SET name = ?, registration_number = ?, capacity = ?, is_active = ? WHERE id = ?';
        queryParams = [name, registration_number, parseInt(capacity), Boolean(is_active), busId];
    } else {
        query = 'UPDATE buses SET name = ?, registration_number = ?, capacity = ? WHERE id = ?';
        queryParams = [name, registration_number, parseInt(capacity), busId];
    }

    try {
        const [result] = await pool.query(query, queryParams);
        if (result.affectedRows === 0) {
            const [busExists] = await pool.query('SELECT id FROM buses WHERE id = ?', [busId]);
            if (busExists.length === 0) return res.status(404).json({ message: 'Bus not found.' });
            return res.json({ message: 'Bus data was the same, no changes made.' });
        }
        res.json({ message: 'Bus updated successfully' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'Registration number already exists.' });
        console.error(`BUS_CTRL: Error updateBus for ID ${busId}:`, error);
        res.status(500).json({ message: 'Server error updating bus.', error: error.message });
    }
};

const deleteBus = async (req, res) => {
    const busId = req.params.id;
    console.log(`BUS_CTRL: deleteBus - ID: ${busId}`);
    try {
        const [schedules] = await pool.query('SELECT id FROM schedules WHERE bus_id = ?', [busId]);
        if (schedules.length > 0) {
            return res.status(400).json({ message: 'Cannot delete bus: It is assigned to existing schedules. Please remove from schedules first or deactivate the bus.' });
        }
        const [result] = await pool.query('DELETE FROM buses WHERE id = ?', [busId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Bus not found' });
        }
        res.json({ message: 'Bus deleted successfully' });
    } catch (error) {
        if (error.code === 'ER_ROW_IS_REFERENCED_2') { // Should be caught by the check above
            return res.status(400).json({ message: 'Cannot delete bus: It is referenced by other records.' });
        }
        console.error(`BUS_CTRL: Error deleteBus for ID ${busId}:`, error);
        res.status(500).json({ message: 'Server error deleting bus', error: error.message });
    }
};

module.exports = {
    searchBuses,
    getAllBuses,
    createBus,
    getBusById,
    updateBus,
    deleteBus,
    getBusesCount
};