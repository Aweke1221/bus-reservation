// backend/routes/scheduleRoutes.js
const express = require('express');
const router = express.Router();
console.log("ROUTES: scheduleRoutes.js - File loaded and router instance created.");

const { protect, isAdmin } = require('../middleware/authMiddleware');
const {
    createSchedule,
    getAllSchedules,
    getScheduleById,
    updateSchedule,
    deleteSchedule,
    getSchedulesCount,
    getScheduleDetailsForSeatSelection // <<< MAKE SURE THIS IS IMPORTED
} = require('../controllers/scheduleController');


router.get('/count', protect, isAdmin, getSchedulesCount);
console.log("ROUTES: scheduleRoutes.js - Configured: GET /count");


router.get('/:schedule_id_param/details', protect, getScheduleDetailsForSeatSelection);
console.log("ROUTES: scheduleRoutes.js - Configured: GET /:schedule_id_param/details");

router.route('/')
    .post(protect, isAdmin, createSchedule)
    .get(protect, isAdmin, getAllSchedules);
console.log("ROUTES: scheduleRoutes.js - Configured: POST / and GET /");

router.route('/:schedule_id_param') 
    .get(protect, isAdmin, getScheduleById)
    .put(protect, isAdmin, updateSchedule)
    .delete(protect, isAdmin, deleteSchedule);
console.log("ROUTES: scheduleRoutes.js - Configured: GET, PUT, DELETE /:schedule_id_param");

module.exports = router;
console.log("ROUTES: scheduleRoutes.js - Router configured and exported.");