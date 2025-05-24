// frontend/admin/admin.js

console.log("ADMIN.JS: Script loading. Initializing window.adminApp.");
// Initialize the global namespace immediately when the script loads
window.adminApp = window.adminApp || {};

// Ensure common.js is loaded first and provides:
// API_BASE_URL, getToken(), getCurrentUser(), logoutUser()

document.addEventListener('DOMContentLoaded', () => {
    console.log("ADMIN.JS: DOMContentLoaded fired. Caching elements and setting up.");

    // --- AUTHENTICATION & INITIALIZATION ---
    const currentUser = getCurrentUser();
    if (!currentUser || currentUser.role !== 'admin') {
        console.error("ADMIN.JS: Auth failed - Not an admin or not logged in. Redirecting to login.");
        alert('Access Denied. Admin privileges required.');
        window.location.href = '../index.html'; // Adjust path if login page is elsewhere
        return; // Stop further script execution
    }
    console.log("ADMIN.JS: Admin user authenticated:", currentUser.username, "(Role:", currentUser.role, ")");
    const adminUsernameDisplay = document.getElementById('adminUsernameDisplay');
    if (adminUsernameDisplay) {
        adminUsernameDisplay.textContent = currentUser.username;
    } else {
        console.warn("ADMIN.JS: adminUsernameDisplay element not found in navbar.");
    }

    // --- DOM Elements (Cache them for performance and easier access) ---
    const sections = document.querySelectorAll('.admin-section');
    const navLinks = document.querySelectorAll('.admin-nav-link');
    const adminGlobalMessageArea = document.getElementById('adminGlobalMessageArea');

    // Bus Modal Elements
    const busModalEl = $('#busModal'); // jQuery object for Bootstrap modal methods
    const busFormEl = document.getElementById('busForm');
    const busIdInput = document.getElementById('busId');
    const busNameInput = document.getElementById('busName');
    const busRegNumInput = document.getElementById('busRegNum');
    const busCapacityInput = document.getElementById('busCapacity');
    const busModalLabelEl = document.getElementById('busModalLabel');
    const busModalMessageAreaEl = document.getElementById('busModalMessageArea');
    const busesTableBodyEl = document.getElementById('busesTableBody');

    // Route Modal Elements
    const routeModalEl = $('#routeModal');
    const routeFormEl = document.getElementById('routeForm');
    const routeIdInput = document.getElementById('routeId');
    const routeSourceInput = document.getElementById('routeSource');
    const routeDestinationInput = document.getElementById('routeDestination');
    const routeModalLabelEl = document.getElementById('routeModalLabel');
    const routeModalMessageAreaEl = document.getElementById('routeModalMessageArea');
    const routesTableBodyEl = document.getElementById('routesTableBody');

    // Schedule Modal Elements
    const scheduleModalEl = $('#scheduleModal');
    const scheduleFormEl = document.getElementById('scheduleForm');
    const scheduleIdInput = document.getElementById('scheduleId');
    const scheduleBusIdSelectEl = document.getElementById('scheduleBusIdSelect');
    const scheduleRouteIdSelectEl = document.getElementById('scheduleRouteIdSelect');
    const scheduleDepartureTimeInput = document.getElementById('scheduleDepartureTime');
    const scheduleArrivalTimeInput = document.getElementById('scheduleArrivalTime');
    const schedulePriceInput = document.getElementById('schedulePrice');
    const scheduleSeatsAvailableGroupEl = document.getElementById('scheduleSeatsAvailableGroup');
    const scheduleSeatsAvailableInput = document.getElementById('scheduleSeatsAvailable');
    const scheduleModalLabelEl = document.getElementById('scheduleModalLabel');
    const scheduleModalMessageAreaEl = document.getElementById('scheduleModalMessageArea');
    const schedulesTableBodyEl = document.getElementById('schedulesTableBody');

    // Bookings Table Element
    const allBookingsTableBodyEl = document.getElementById('allBookingsTableBody');

    // Stat Elements for Dashboard
    const statTotalBusesEl = document.getElementById('statTotalBuses');
    const statTotalSchedulesEl = document.getElementById('statTotalSchedules');
    const statTotalBookingsEl = document.getElementById('statTotalBookings');
    const statTotalUsersEl = document.getElementById('statTotalUsers'); // For new dashboard card

    // User Management / Add Admin Modal Elements
    const addAdminModalEl = $('#addAdminModal');
    const addAdminFormEl = document.getElementById('addAdminForm');
    const adminUsernameInputEl = document.getElementById('adminUsernameInput');
    const adminEmailInputEl = document.getElementById('adminEmailInput');
    const adminPasswordInputEl = document.getElementById('adminPasswordInput');
    const adminConfirmPasswordInputEl = document.getElementById('adminConfirmPasswordInput');
    const addAdminModalMessageAreaEl = document.getElementById('addAdminModalMessageArea');
    const userManagementMessageAreaEl = document.getElementById('userManagementMessageArea'); // For messages in the user management section


    // --- UTILITY FUNCTIONS ---
    function displayGlobalAdminMessage(message, type = 'info') {
        if (adminGlobalMessageArea) {
            adminGlobalMessageArea.innerHTML = `<div class="alert alert-${type} alert-dismissible fade show" role="alert">${message}<button type="button" class="close" data-dismiss="alert" aria-label="Close">×</button></div>`;
            if (type === 'success') {
                setTimeout(() => {
                    // Check if the message is still the one we set before clearing
                    if (adminGlobalMessageArea.querySelector(`.alert-${type}`) && adminGlobalMessageArea.textContent.includes(message.substring(0,20))) { // Partial match
                        adminGlobalMessageArea.innerHTML = '';
                    }
                }, 5000);
            }
        } else { console.warn("ADMIN.JS: adminGlobalMessageArea element not found for message:", message); }
    }

    function displayModalMessage(modalMessageAreaElement, message, type = 'info') {
        if (modalMessageAreaElement) {
            modalMessageAreaElement.innerHTML = `<div class="alert alert-${type} small p-2 mb-0">${message}</div>`; // mb-0 to prevent extra space if form has mb-2
        } else { console.warn("ADMIN.JS: Target modal message area not found for message:", message); }
    }

    async function fetchData(endpoint, errorMessagePrefix = "Failed to fetch data") {
        console.log(`ADMIN.JS: Fetching data from ${API_BASE_URL}${endpoint}`);
        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            console.log(`ADMIN.JS: Response status for GET ${endpoint}: ${response.status}`);
            if (!response.ok) {
                let errorData = { message: `Server responded with ${response.status} ${response.statusText}` };
                try { errorData = await response.json(); } catch (e) { console.warn(`Could not parse error JSON for ${endpoint}`); }
                throw new Error(`${errorMessagePrefix}: ${errorData.message || response.statusText}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`ADMIN.JS: Error in fetchData for ${endpoint}:`, error.message, error);
            displayGlobalAdminMessage(error.message, 'danger');
            throw error;
        }
    }

    async function saveData(endpoint, method, data, successMessage, errorMessagePrefix = "Failed to save data", targetModalMessageAreaEl = null) {
        console.log(`ADMIN.JS: Saving data to ${API_BASE_URL}${endpoint} via ${method}. Payload:`, data);
        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                method: method,
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
                body: JSON.stringify(data)
            });
            const result = await response.json(); // Always try to parse, backend should send JSON for errors too
            console.log(`ADMIN.JS: Response status for ${method} ${endpoint}: ${response.status}. Result:`, result);
            if (!response.ok) {
                throw new Error(result.message || `${errorMessagePrefix}: ${response.statusText}`);
            }
            displayGlobalAdminMessage(result.message || successMessage, 'success');
            return result;
        } catch (error) {
            console.error(`ADMIN.JS: Error in saveData for ${method} ${endpoint}:`, error.message, error);
            const messageArea = targetModalMessageAreaEl || adminGlobalMessageArea;
            const displayFn = targetModalMessageAreaEl ? displayModalMessage : displayGlobalAdminMessage;
            displayFn(messageArea, error.message, 'danger');
            throw error;
        }
    }

    async function deleteData(endpoint, successMessage, errorMessagePrefix = "Failed to delete data") {
        console.log(`ADMIN.JS: Deleting data from ${API_BASE_URL}${endpoint}`);
        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            const result = await response.json();
            console.log(`ADMIN.JS: Response status for DELETE ${endpoint}: ${response.status}. Result:`, result);
            if (!response.ok) {
                throw new Error(result.message || `${errorMessagePrefix}: ${response.statusText}`);
            }
            displayGlobalAdminMessage(result.message || successMessage, 'success');
            return result;
        } catch (error) {
            console.error(`ADMIN.JS: Error in deleteData for ${endpoint}:`, error.message, error);
            displayGlobalAdminMessage(error.message, 'danger');
            throw error;
        }
    }

    // --- NAVIGATION ---
    window.adminApp.navigateToSection = (sectionId) => { // For dashboard card clicks
        showSection(sectionId);
    };

    function showSection(sectionId) {
        console.log(`ADMIN.JS: showSection attempting for: '${sectionId}'`);
        if (adminGlobalMessageArea) adminGlobalMessageArea.innerHTML = '';
        let sectionFound = false;
        sections.forEach(section => {
            if (section.id === sectionId) {
                section.classList.add('active');
                sectionFound = true;
            } else {
                section.classList.remove('active');
            }
        });
        navLinks.forEach(link => {
            const isActive = link.dataset.section === sectionId;
            link.classList.toggle('active', isActive);
            if (link.parentElement) link.parentElement.classList.toggle('active', isActive);
        });

        if (!sectionFound) {
            console.warn(`ADMIN.JS: No section element found with ID: '${sectionId}'. Defaulting to dashboard.`);
            showSection('dashboard'); // Fallback
            return;
        }

        console.log(`ADMIN.JS: Loading data for section: '${sectionId}'`);
        switch (sectionId) {
            case 'dashboard': loadDashboardStats(); break;
            case 'manage-buses': loadBuses(); break;
            case 'manage-routes': loadRoutes(); break;
            case 'manage-schedules': loadSchedules(); break;
            case 'view-bookings': loadAllBookings(); break;
            case 'manage-users':
                console.log("ADMIN.JS: Switched to User Management section (currently only Add Admin).");
                if(userManagementMessageAreaEl) userManagementMessageAreaEl.innerHTML = '';
                // Future: loadAllUsersTable();
                break;
            default:
                console.warn(`ADMIN.JS: No specific data loading function defined for known section ID: '${sectionId}'`);
        }
    }
    navLinks.forEach(link => link.addEventListener('click', (e) => {
        e.preventDefault();
        const sectionId = e.target.dataset.section || e.target.closest('.admin-nav-link')?.dataset.section;
        if (sectionId) {
            showSection(sectionId);
        } else {
            console.warn("ADMIN.JS: Nav link clicked without a data-section attribute.");
        }
    }));
    

    // --- DASHBOARD ---
    async function loadDashboardStats() {
        console.log("ADMIN.JS: Loading dashboard stats...");
        if(!statTotalBusesEl || !statTotalSchedulesEl || !statTotalBookingsEl || !statTotalUsersEl) {
            console.warn("ADMIN.JS: One or more dashboard stat elements not found.");
            return;
        }
        statTotalBusesEl.textContent = statTotalSchedulesEl.textContent = statTotalBookingsEl.textContent = statTotalUsersEl.textContent = '...'; // Loading indicator
        try {
            const [buses, schedules, bookings, users] = await Promise.all([
                fetchData('/buses/count', 'Failed to get bus count'),
                fetchData('/schedules/count', 'Failed to get schedule count'),
                fetchData('/bookings/admin/count', 'Failed to get booking count'),
                fetchData('/users/admin/count', 'Failed to get user count') // NEW: Endpoint for user count
            ]);
            statTotalBusesEl.textContent = buses.count !== undefined ? buses.count : 'N/A';
            statTotalSchedulesEl.textContent = schedules.count !== undefined ? schedules.count : 'N/A';
            statTotalBookingsEl.textContent = bookings.count !== undefined ? bookings.count : 'N/A';
            statTotalUsersEl.textContent = users.count !== undefined ? users.count : 'N/A';
            console.log("ADMIN.JS: Dashboard stats loaded.");
        } catch (error) {
            console.error("ADMIN.JS: Error loading one or more dashboard stats.", error.message);
            statTotalBusesEl.textContent = 'Error';
            statTotalSchedulesEl.textContent = 'Error';
            statTotalBookingsEl.textContent = 'Error';
            statTotalUsersEl.textContent = 'Error';
        }
    }
    // Backend needs: GET /api/users/admin/count -> { count: N } (in userController.js / userRoutes.js)


    // --- BUS MANAGEMENT ---
    async function loadBuses() {
        if (!busesTableBodyEl) return console.warn("ADMIN.JS: busesTableBodyEl not found for loadBuses.");
        busesTableBodyEl.innerHTML = '<tr><td colspan="5" class="text-center p-4"><div class="spinner-border spinner-border-sm text-primary" role="status"></div> Loading buses...</td></tr>';
        try {
            const buses = await fetchData('/buses', 'Failed to fetch buses');
            busesTableBodyEl.innerHTML = '';
            if (!buses || buses.length === 0) {
                busesTableBodyEl.innerHTML = '<tr><td colspan="5" class="text-center">No buses found. Add one!</td></tr>'; return;
            }
            buses.forEach(bus => {
                const row = busesTableBodyEl.insertRow();
                row.innerHTML = `<td>${bus.id}</td><td>${bus.name}</td><td>${bus.registration_number}</td><td>${bus.capacity}</td>
                                 <td><button class="btn btn-sm btn-info mr-1" onclick="window.adminApp.openBusModal(${bus.id})"><i class="fas fa-edit"></i> Edit</button>
                                     <button class="btn btn-sm btn-danger" onclick="window.adminApp.deleteBus(${bus.id})"><i class="fas fa-trash"></i> Delete</button></td>`;
            });
        } catch (e) { busesTableBodyEl.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Error loading buses: ${e.message}</td></tr>`; }
    }
    window.adminApp.openBusModal = async (id = null) => {
        console.log(`ADMIN.JS: Opening bus modal. ID: ${id || 'NEW'}`);
        if (!busFormEl || !busIdInput || !busModalMessageAreaEl || !busModalLabelEl || !busModalEl) return console.error("ADMIN.JS: Bus modal elements missing.");
        busFormEl.reset(); busIdInput.value = ''; busModalMessageAreaEl.innerHTML = '';
        if (id) {
            busModalLabelEl.textContent = 'Edit Bus';
            try {
                const bus = await fetchData(`/buses/${id}`, 'Failed to fetch bus details');
                busIdInput.value = bus.id;
                if(busNameInput) busNameInput.value = bus.name;
                if(busRegNumInput) busRegNumInput.value = bus.registration_number;
                if(busCapacityInput) busCapacityInput.value = bus.capacity;
            } catch (error) { busModalEl.modal('hide'); return; }
        } else {
            busModalLabelEl.textContent = 'Add New Bus';
        }
        busModalEl.modal('show');
    };
    window.adminApp.saveBus = async () => {
        const id = busIdInput.value;
        const busData = { name: busNameInput.value.trim(), registration_number: busRegNumInput.value.trim(), capacity: parseInt(busCapacityInput.value) };
        if (!busData.name || !busData.registration_number || isNaN(busData.capacity) || busData.capacity <=0) {
            return displayModalMessage(busModalMessageAreaEl, 'All fields are required and capacity must be a positive number.', 'warning');
        }
        const endpoint = id ? `/buses/${id}` : '/buses';
        const method = id ? 'PUT' : 'POST';
        try {
            await saveData(endpoint, method, busData, `Bus ${id ? 'updated' : 'added'} successfully.`, 'Failed to save bus', busModalMessageAreaEl);
            busModalEl.modal('hide');
            loadBuses();
        } catch (e) { /* Error already displayed by saveData */ }
    };
    window.adminApp.deleteBus = async (id) => {
        if (!confirm(`Are you sure you want to delete bus ID ${id}? This action cannot be undone.`)) return;
        try {
            await deleteData(`/buses/${id}`, 'Bus deleted successfully.');
            loadBuses();
        } catch (e) { /* Error already displayed by deleteData */ }
    };

    // --- ROUTE MANAGEMENT ---
    async function loadRoutes() {
        if (!routesTableBodyEl) return console.warn("ADMIN.JS: routesTableBodyEl not found for loadRoutes.");
        routesTableBodyEl.innerHTML = '<tr><td colspan="4" class="text-center p-4"><div class="spinner-border spinner-border-sm text-primary" role="status"></div> Loading routes...</td></tr>';
        try {
            const routes = await fetchData('/routes', 'Failed to fetch routes');
            routesTableBodyEl.innerHTML = '';
            if (!routes || routes.length === 0) {
                routesTableBodyEl.innerHTML = '<tr><td colspan="4" class="text-center">No routes found. Add one!</td></tr>'; return;
            }
            routes.forEach(r => {
                const row = routesTableBodyEl.insertRow();
                row.innerHTML = `<td>${r.id}</td><td>${r.source}</td><td>${r.destination}</td>
                                 <td><button class="btn btn-sm btn-info mr-1" onclick="window.adminApp.openRouteModal(${r.id})"><i class="fas fa-edit"></i> Edit</button>
                                     <button class="btn btn-sm btn-warning mr-1" onclick="window.adminApp.openReverseRouteModal('${r.source}', '${r.destination}')"><i class="fas fa-exchange-alt"></i> Reverse</button>
                                     <button class="btn btn-sm btn-danger" onclick="window.adminApp.deleteRoute(${r.id})"><i class="fas fa-trash"></i> Delete</button></td>`;
            });
        } catch(e) { routesTableBodyEl.innerHTML = `<tr><td colspan="4" class="text-center text-danger">Error loading routes: ${e.message}</td></tr>`; }
    }
    window.adminApp.openRouteModal = async (id = null) => {
        console.log(`ADMIN.JS: Opening route modal. ID: ${id || 'NEW'}`);
        if(!routeFormEl || !routeIdInput || !routeModalMessageAreaEl || !routeModalLabelEl || !routeModalEl) return console.error("ADMIN.JS: Route modal elements missing.");
        routeFormEl.reset(); routeIdInput.value = ''; routeModalMessageAreaEl.innerHTML = '';
        if (id) {
            routeModalLabelEl.textContent = 'Edit Route';
            try {
                const route = await fetchData(`/routes/${id}`, 'Failed to fetch route details');
                routeIdInput.value = route.id;
                if(routeSourceInput) routeSourceInput.value = route.source;
                if(routeDestinationInput) routeDestinationInput.value = route.destination;
            } catch(e){ routeModalEl.modal('hide'); return; }
        } else {
            routeModalLabelEl.textContent = 'Add New Route';
        }
        routeModalEl.modal('show');
    };
    window.adminApp.openReverseRouteModal = (source, destination) => {
        console.log(`ADMIN.JS: Opening reverse route modal for ${source} - ${destination}`);
        if(!routeFormEl || !routeIdInput || !routeModalMessageAreaEl || !routeModalLabelEl || !routeModalEl) return console.error("ADMIN.JS: Route modal elements missing for reverse.");
        routeFormEl.reset(); routeIdInput.value = ''; // It's a new route
        routeModalMessageAreaEl.innerHTML = '';
        routeModalLabelEl.textContent = 'Add Reverse Route';
        if(routeSourceInput) routeSourceInput.value = destination; // Pre-fill swapped
        if(routeDestinationInput) routeDestinationInput.value = source; // Pre-fill swapped
        routeModalEl.modal('show');
    };
    window.adminApp.saveRoute = async () => {
        const id = routeIdInput.value;
        const routeData = { source: routeSourceInput.value.trim(), destination: routeDestinationInput.value.trim() };
        if(!routeData.source || !routeData.destination) return displayModalMessage(routeModalMessageAreaEl, 'Source and Destination are required.', 'warning');
        if(routeData.source.toLowerCase() === routeData.destination.toLowerCase()) return displayModalMessage(routeModalMessageAreaEl, 'Source and Destination cannot be the same.', 'warning');
        const endpoint = id ? `/routes/${id}` : '/routes';
        const method = id ? 'PUT' : 'POST';
        try {
            await saveData(endpoint, method, routeData, `Route ${id ? 'updated':'added'} successfully.`, 'Failed to save route', routeModalMessageAreaEl);
            routeModalEl.modal('hide');
            loadRoutes();
        } catch(e){ /* Error displayed by saveData */ }
    };
    window.adminApp.deleteRoute = async (id) => {
        if(!confirm(`Are you sure you want to delete route ID ${id}? This may affect schedules.`)) return;
        try { await deleteData(`/routes/${id}`, 'Route deleted successfully.'); loadRoutes(); } catch(e){ /* Error displayed by deleteData */ }
    };

    // --- SCHEDULE MANAGEMENT ---
    async function populateScheduleDropdowns() {
        console.log("ADMIN.JS: Populating schedule dropdowns...");
        if(!scheduleBusIdSelectEl || !scheduleRouteIdSelectEl) return console.warn("ADMIN.JS: Schedule dropdown select elements not found.");
        if(scheduleModalMessageAreaEl) scheduleModalMessageAreaEl.innerHTML = '';
        scheduleBusIdSelectEl.innerHTML = '<option value="">Loading Buses...</option>';
        scheduleRouteIdSelectEl.innerHTML = '<option value="">Loading Routes...</option>';
        try {
            const [buses, routes] = await Promise.all([
                fetchData('/buses', 'Failed to fetch buses for schedule dropdown'),
                fetchData('/routes', 'Failed to fetch routes for schedule dropdown')
            ]);
            scheduleBusIdSelectEl.innerHTML = '<option value="">Select a Bus</option>';
            buses.forEach(b => scheduleBusIdSelectEl.innerHTML += `<option value="${b.id}">${b.name} (${b.registration_number})</option>`);
            
            scheduleRouteIdSelectEl.innerHTML = '<option value="">Select a Route</option>';
            routes.forEach(r => scheduleRouteIdSelectEl.innerHTML += `<option value="${r.id}">${r.source} to ${r.destination}</option>`);
            console.log("ADMIN.JS: Schedule dropdowns populated.");
        } catch (error) {
            console.error("ADMIN.JS: Error populating schedule dropdowns.", error.message);
            if(scheduleModalMessageAreaEl) displayModalMessage(scheduleModalMessageAreaEl, `Error loading dropdown options: ${error.message}`, 'danger');
            if(scheduleBusIdSelectEl) scheduleBusIdSelectEl.innerHTML = '<option value="">Error loading buses!</option>';
            if(scheduleRouteIdSelectEl) scheduleRouteIdSelectEl.innerHTML = '<option value="">Error loading routes!</option>';
        }
    }
    async function loadSchedules() {
        if(!schedulesTableBodyEl) return console.warn("ADMIN.JS: schedulesTableBodyEl not found.");
        schedulesTableBodyEl.innerHTML = '<tr><td colspan="8" class="text-center p-4"><div class="spinner-border spinner-border-sm text-primary" role="status"></div> Loading schedules...</td></tr>';
        try {
            const schedules = await fetchData('/schedules', 'Failed to fetch schedules'); // Backend joins names
            schedulesTableBodyEl.innerHTML = '';
            if(!schedules || schedules.length === 0) {schedulesTableBodyEl.innerHTML = '<tr><td colspan="8" class="text-center">No schedules found.</td></tr>'; return;}
            schedules.forEach(s => {
                const row = schedulesTableBodyEl.insertRow();
                row.innerHTML = `<td>${s.id}</td><td>${s.bus_name||'N/A'} (${s.registration_number||'N/A'})</td><td>${s.route_source||'N/A'} → ${s.route_destination||'N/A'}</td>
                                 <td>${new Date(s.departure_time).toLocaleString()}</td><td>${new Date(s.arrival_time).toLocaleString()}</td>
                                 <td>$${parseFloat(s.price_per_seat).toFixed(2)}</td><td>${s.seats_available}</td>
                                 <td><button class="btn btn-sm btn-info mr-1" onclick="window.adminApp.openScheduleModal(${s.id})"><i class="fas fa-edit"></i> Edit</button>
                                     <button class="btn btn-sm btn-danger" onclick="window.adminApp.deleteSchedule(${s.id})"><i class="fas fa-trash"></i> Delete</button></td>`;
            });
        } catch(e) {schedulesTableBodyEl.innerHTML = `<tr><td colspan="8" class="text-center text-danger">Error loading schedules: ${e.message}</td></tr>`;}
    }
    window.adminApp.openScheduleModal = async (id = null) => {
        console.log(`ADMIN.JS: Opening schedule modal. ID: ${id || 'NEW'}`);
        if(!scheduleFormEl || !scheduleIdInput || !scheduleModalMessageAreaEl || !scheduleModalLabelEl || !scheduleModalEl) return console.error("ADMIN.JS: Schedule modal elements missing.");
        scheduleFormEl.reset(); scheduleIdInput.value = ''; scheduleModalMessageAreaEl.innerHTML = '';
        if(scheduleSeatsAvailableGroupEl) scheduleSeatsAvailableGroupEl.style.display = 'none';

        await populateScheduleDropdowns(); // Await ensures dropdowns are loaded before proceeding

        if(id) {
            scheduleModalLabelEl.textContent = 'Edit Schedule';
            if(scheduleSeatsAvailableGroupEl) scheduleSeatsAvailableGroupEl.style.display = 'block';
            try {
                const sch = await fetchData(`/schedules/${id}`, 'Failed to fetch schedule details');
                scheduleIdInput.value = sch.id;
                if(scheduleBusIdSelectEl) scheduleBusIdSelectEl.value = sch.bus_id;
                if(scheduleRouteIdSelectEl) scheduleRouteIdSelectEl.value = sch.route_id;
                if(scheduleDepartureTimeInput) scheduleDepartureTimeInput.value = sch.departure_time ? sch.departure_time.substring(0,16) : '';
                if(scheduleArrivalTimeInput) scheduleArrivalTimeInput.value = sch.arrival_time ? sch.arrival_time.substring(0,16) : '';
                if(schedulePriceInput) schedulePriceInput.value = sch.price_per_seat !== undefined ? parseFloat(sch.price_per_seat).toFixed(2) : '';
                if(scheduleSeatsAvailableInput) scheduleSeatsAvailableInput.value = sch.seats_available !== undefined ? sch.seats_available : '';
            } catch(e) { scheduleModalEl.modal('hide'); return; }
        } else {
            scheduleModalLabelEl.textContent = 'Add New Schedule';
        }
        scheduleModalEl.modal('show');
    };
    window.adminApp.saveSchedule = async () => {
        const id = scheduleIdInput.value;
        const scheduleData = {
            bus_id: scheduleBusIdSelectEl.value ? parseInt(scheduleBusIdSelectEl.value) : null,
            route_id: scheduleRouteIdSelectEl.value ? parseInt(scheduleRouteIdSelectEl.value) : null,
            departure_time: scheduleDepartureTimeInput.value,
            arrival_time: scheduleArrivalTimeInput.value,
            price_per_seat: schedulePriceInput.value ? parseFloat(schedulePriceInput.value) : null
        };
        if (id && scheduleSeatsAvailableInput.value !== '' && scheduleSeatsAvailableGroupEl.style.display !== 'none') {
            scheduleData.seats_available = parseInt(scheduleSeatsAvailableInput.value);
        }

        let missingFields=[];
        if(!scheduleData.bus_id) missingFields.push("Bus");
        if(!scheduleData.route_id) missingFields.push("Route");
        if(!scheduleData.departure_time) missingFields.push("Departure Time (date & time)");
        if(!scheduleData.arrival_time) missingFields.push("Arrival Time (date & time)");
        if(scheduleData.price_per_seat === null || isNaN(scheduleData.price_per_seat) || scheduleData.price_per_seat < 0) missingFields.push("Valid Price");
        if(missingFields.length > 0) return displayModalMessage(scheduleModalMessageAreaEl, `Required: ${missingFields.join(', ')}.`, 'warning');

        if(new Date(scheduleData.arrival_time) <= new Date(scheduleData.departure_time)) return displayModalMessage(scheduleModalMessageAreaEl, 'Arrival must be after Departure.', 'warning');
        if(id && scheduleData.seats_available !== undefined && (isNaN(scheduleData.seats_available) || scheduleData.seats_available < 0)) return displayModalMessage(scheduleModalMessageAreaEl, 'Seats available must be a non-negative number.', 'warning');

        const endpoint = id ? `/schedules/${id}` : '/schedules';
        const method = id ? 'PUT':'POST';
        try {
            await saveData(endpoint, method, scheduleData, `Schedule ${id?'updated':'added'} successfully.`, 'Failed to save schedule', scheduleModalMessageAreaEl);
            scheduleModalEl.modal('hide');
            loadSchedules();
        } catch(e){ /* Error displayed by saveData */ }
    };
    window.adminApp.deleteSchedule = async (id) => {
        if(!confirm(`Are you sure you want to delete schedule ID ${id}? This may affect bookings.`)) return;
        try{await deleteData(`/schedules/${id}`, 'Schedule deleted successfully.'); loadSchedules();}catch(e){/* Error displayed by deleteData */}
    };

    // --- VIEW ALL BOOKINGS ---
   // frontend/admin/admin.js
// Inside DOMContentLoaded

async function loadAllBookings() {
    if (!allBookingsTableBodyEl) {
        console.warn("ADMIN.JS: allBookingsTableBodyEl not found for displaying all bookings.");
        return;
    }
    allBookingsTableBodyEl.innerHTML = '<tr><td colspan="8" class="text-center p-4"><div class="spinner-border spinner-border-sm text-primary"></div> Loading all bookings...</td></tr>';
    try {
        const bookings = await fetchData('/bookings/admin/all', 'Failed to fetch all bookings'); // fetchData is your helper
        allBookingsTableBodyEl.innerHTML = ''; // Clear loading message

        if (!bookings || bookings.length === 0) {
            allBookingsTableBodyEl.innerHTML = '<tr><td colspan="8" class="text-center">No bookings found in the system.</td></tr>';
            return;
        }

        bookings.forEach(bk => {
            const row = allBookingsTableBodyEl.insertRow();
            const departure = bk.departure_time ? new Date(bk.departure_time).toLocaleString([], {dateStyle:'short', timeStyle:'short'}) : 'N/A';
            const bookedOn = bk.booking_date ? new Date(bk.booking_date).toLocaleString([], {dateStyle:'short', timeStyle:'short'}) : 'N/A';

            // Check for null or undefined before displaying, default to 'N/A'
            const userNameDisplay = bk.user_username || 'N/A'; // Matching the alias from backend query
            const busNameDisplay = bk.bus_name || 'N/A';
            const routeSourceDisplay = bk.route_source || 'N/A';
            const routeDestinationDisplay = bk.route_destination || 'N/A';

            // Determine badge class for status
            let statusBadgeClass = 'secondary';
            if (bk.status === 'confirmed') statusBadgeClass = 'success';
            else if (bk.status === 'cancelled') statusBadgeClass = 'danger';
            else if (bk.status === 'pending') statusBadgeClass = 'warning';

            row.innerHTML = `
                <td>${bk.booking_id || bk.id}</td>
                <td>${userNameDisplay} (ID:${bk.user_id})</td>
                <td>
                    ${busNameDisplay} <br>
                    <small class="text-muted">${routeSourceDisplay} → ${routeDestinationDisplay}</small>
                </td>
                <td>${departure}</td>
                <td>${bk.num_seats}</td>
                <td>$${parseFloat(bk.total_price).toFixed(2)}</td>
                <td>${bookedOn}</td>
                <td><span class="badge badge-${statusBadgeClass} p-2">${bk.status ? bk.status.toUpperCase() : 'N/A'}</span></td>
            `;
            // Add actions column if needed:
            // <td><button class="btn btn-sm btn-info">View</button></td>
        });
        console.log("ADMIN.JS: All bookings table loaded with", bookings.length, "records.");
    } catch (error) { // Error from fetchData helper
        console.error("ADMIN.JS: Error in loadAllBookings:", error.message);
        if (allBookingsTableBodyEl) {
            allBookingsTableBodyEl.innerHTML = `<tr><td colspan="8" class="text-center text-danger">Error loading bookings: ${error.message}</td></tr>`;
        }
    }
}

    // --- USER MANAGEMENT / ADD NEW ADMIN FUNCTIONS ---
    window.adminApp.openAddAdminModal = () => {
        console.log("ADMIN.JS: window.adminApp.openAddAdminModal function called.");
        if (!addAdminFormEl || !addAdminModalMessageAreaEl || !addAdminModalEl) {
            return console.error("ADMIN.JS: One or more elements for Add Admin Modal not found.");
        }
        addAdminFormEl.reset(); addAdminModalMessageAreaEl.innerHTML = '';
        addAdminModalEl.modal('show');
    };
    console.log("ADMIN.JS: window.adminApp.openAddAdminModal assigned:", typeof window.adminApp.openAddAdminModal);

    window.adminApp.saveNewAdmin = async () => {
        console.log("ADMIN.JS: window.adminApp.saveNewAdmin function called.");
        if (!adminUsernameInputEl || !adminEmailInputEl || !adminPasswordInputEl || !adminConfirmPasswordInputEl || !addAdminModalMessageAreaEl) {
            return console.error("ADMIN.JS: One or more input elements for Add Admin form not found.");
        }
        addAdminModalMessageAreaEl.innerHTML = '';
        const username = adminUsernameInputEl.value.trim(); const email = adminEmailInputEl.value.trim(); const password = adminPasswordInputEl.value; const confirmPassword = adminConfirmPasswordInputEl.value;
        if (!username || !email || !password || !confirmPassword) return displayModalMessage(addAdminModalMessageAreaEl, 'All fields are required.', 'warning');
        if (password.length < 6) return displayModalMessage(addAdminModalMessageAreaEl, 'Password min 6 characters.', 'warning');
        if (password !== confirmPassword) return displayModalMessage(addAdminModalMessageAreaEl, 'Passwords do not match.', 'warning');
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(email)) return displayModalMessage(addAdminModalMessageAreaEl, 'Valid email required.', 'warning');
        const adminData = { username, email, password, role: 'admin' };
        console.log("ADMIN.JS: New admin data to send:", { username, email, role: 'admin', password_omitted: '***' });
        try {
            // Use the existing public registration endpoint, sending the role
            const result = await saveData('/auth/register', 'POST', adminData, `Admin '${username}' created.`, 'Failed to create admin', addAdminModalMessageAreaEl);
            addAdminModalEl.modal('hide');
            // If you have a user list on this page, refresh it: // loadAllUsersTable();
        } catch (error) { /* Error already displayed by saveData */ }
    };
    console.log("ADMIN.JS: window.adminApp.saveNewAdmin assigned:", typeof window.adminApp.saveNewAdmin);

    // --- LOGOUT ---
    window.adminApp.logout = () => {
        console.log("ADMIN.JS: Admin logout triggered from window.adminApp.logout.");
        if (typeof logoutUser === 'function') {
            logoutUser(); // This function is from common.js
        window.location.href = '../login.html';
    } else {
            console.error("ADMIN.JS: logoutUser function from common.js not found! Attempting manual redirect.");
            localStorage.removeItem('authToken'); localStorage.removeItem('currentUser');
            
 // Adjust path as necessary, or use /login.html if server root is frontend/
        }
    };
    console.log("ADMIN.JS: window.adminApp.logout assigned:", typeof window.adminApp.logout);

    // --- Initial Load ---
    showSection('dashboard');

    console.log("ADMIN.JS: DOMContentLoaded setup complete. window.adminApp object:", window.adminApp);
}); // End DOMContentLoaded