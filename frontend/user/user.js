
document.addEventListener('DOMContentLoaded', () => {
    console.log("USER.JS: DOMContentLoaded fired.");

    // Call updateNav from common.js to set navbar state
    if (typeof updateNav === 'function') {
        updateNav();
    } else {
        console.warn("USER.JS: updateNav function from common.js not found.");
    }

    // --- Logic for My Profile Page (profile.html) ---
    const profileDisplayArea = document.getElementById('profileDisplayArea');
    const profileEditFormArea = document.getElementById('profileEditFormArea');
    const editProfileBtn = document.getElementById('editProfileBtn');
    const cancelEditProfileBtn = document.getElementById('cancelEditProfileBtn');
    const editProfileForm = document.getElementById('editProfileForm');
    const profileMessageArea = document.getElementById('profileMessageArea');

    if (profileDisplayArea) { // Check if we are on the profile page
        console.log("USER.JS: On Profile page. Loading user details.");
        loadUserProfile();

        if (editProfileBtn) {
            editProfileBtn.addEventListener('click', () => {
                // For now, we are not implementing full edit functionality
                alert("Profile editing feature is currently under development. For now, you can only view your details.");
                // To implement editing:
                // profileDisplayArea.style.display = 'none';
                // profileEditFormArea.style.display = 'block';
                // const user = getCurrentUser(); // Or fetch fresh data
                // if (user) {
                //     document.getElementById('editUsername').value = user.username;
                //     // document.getElementById('editEmail').value = user.email; // Be cautious with email editing
                // }
            });
        }

        if (cancelEditProfileBtn) {
            cancelEditProfileBtn.addEventListener('click', () => {
                profileEditFormArea.style.display = 'none';
                profileDisplayArea.style.display = 'block';
                if(document.getElementById('editProfileMessageArea')) document.getElementById('editProfileMessageArea').innerHTML = '';
            });
        }

        if (editProfileForm) {
            editProfileForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                // This is where you'd handle the API call to update profile details
                // For now, it's a placeholder as edit is "Coming Soon"
                const editMessageArea = document.getElementById('editProfileMessageArea');
                if(editMessageArea) editMessageArea.innerHTML = '<div class="alert alert-info">Profile update submitted (Feature under development).</div>';
                console.log("USER.JS: Edit Profile form submitted (placeholder).");
                // Example payload for update:
                // const updatedData = { username: document.getElementById('editUsername').value };
                // Call an API like PUT /api/users/profile with updatedData
            });
        }
    }

    async function loadUserProfile() {
        console.log("USER.JS: loadUserProfile called.");
        const token = getToken();
        if (!token) {
            console.warn("USER.JS: No token found, redirecting to login from profile attempt.");
            if(profileMessageArea) profileMessageArea.innerHTML = '<div class="alert alert-warning">You must be logged in to view your profile. Redirecting...</div>';
            setTimeout(() => { window.location.href = '../login.html'; }, 2000);
            return;
        }

        // Display loading state for profile fields
        document.getElementById('profileUsername').textContent = 'Loading...';
        document.getElementById('profileEmail').textContent = 'Loading...';
        document.getElementById('profileUserId').textContent = 'Loading...';
        document.getElementById('profileRole').textContent = 'Loading...';


        try {
            const response = await fetch(`${API_BASE_URL}/auth/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            console.log("USER.JS: /auth/me API response status:", response.status);

            const userData = await response.json();
            if (!response.ok) {
                throw new Error(userData.message || `Failed to fetch profile data (${response.status})`);
            }

            console.log("USER.JS: Profile data received:", userData);
            // Populate the display fields
            document.getElementById('profileUsername').textContent = userData.username || 'N/A';
            document.getElementById('profileEmail').textContent = userData.email || 'N/A';
            document.getElementById('profileUserId').textContent = userData.id || userData._id || 'N/A'; // Backend might send id or _id
            document.getElementById('profileRole').textContent = userData.role ? userData.role.charAt(0).toUpperCase() + userData.role.slice(1) : 'N/A';

        } catch (error) {
            console.error("USER.JS: Error loading user profile:", error);
            if(profileMessageArea) profileMessageArea.innerHTML = `<div class="alert alert-danger">Could not load profile: ${error.message}</div>`;
            // Clear fields on error
            document.getElementById('profileUsername').textContent = 'Error';
            document.getElementById('profileEmail').textContent = 'Error';
            document.getElementById('profileUserId').textContent = 'Error';
            document.getElementById('profileRole').textContent = 'Error';
        }
    }


    // --- Logic for My Bookings Page (my-bookings.html) ---
    // This is the same logic from your previous "how display data" for bookings
    const myBookingsListContainer = document.getElementById('myBookingsListContainer');
    const myBookingsMessageArea = document.getElementById('myBookingsMessageArea'); // For messages on my-bookings page

    if (myBookingsListContainer) { // Check if we are on the my-bookings page
        console.log("USER.JS: On My Bookings page. Attempting to load user's bookings.");
        loadUserBookings_MyPage(); // Renamed to avoid conflict if main.js also has one
    }

    async function loadUserBookings_MyPage() {
        const token = getToken();
        if (!token) {
            if (myBookingsMessageArea) myBookingsMessageArea.innerHTML = '<div class="alert alert-warning">Please login to see your bookings. Redirecting...</div>';
            setTimeout(() => { window.location.href = '../login.html'; }, 2000); return;
        }
        if (myBookingsListContainer) myBookingsListContainer.innerHTML = '<p class="text-center">Loading your bookings...</p>';
        if (myBookingsMessageArea) myBookingsMessageArea.innerHTML = '';

        try {
            const response = await fetch(`${API_BASE_URL}/bookings/mybookings`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const bookings = await response.json();
            if (!response.ok) throw new Error(bookings.message || 'Failed to fetch bookings.');
            displayUserBookings_MyPage(bookings);
        } catch (error) {
            console.error("USER.JS: Error fetching user bookings:", error);
            if (myBookingsListContainer) myBookingsListContainer.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
        }
    }

    function displayUserBookings_MyPage(bookings) {
        if (!myBookingsListContainer) return;
        myBookingsListContainer.innerHTML = '';
        if (!bookings || bookings.length === 0) {
            myBookingsListContainer.innerHTML = '<p class="text-center text-muted">You have no bookings yet.</p>'; return;
        }
        bookings.forEach(b => {
            const dep = new Date(b.departure_time).toLocaleString([],{dateStyle:'medium',timeStyle:'short'});
            const arr = new Date(b.arrival_time).toLocaleString([],{dateStyle:'medium',timeStyle:'short'});
            const bookedOn = new Date(b.booking_date).toLocaleDateString([],{dateStyle:'long'});
            let badge = 'secondary'; if(b.status==='confirmed')badge='success'; else if(b.status==='cancelled')badge='danger';

            const card = document.createElement('div'); card.className = 'card mb-3 shadow-sm';
            card.innerHTML = `
                <div class="card-header bg-light d-flex justify-content-between align-items-center">
                    <h5 class="mb-0">Booking ID: ${b.booking_id}</h5>
                    <span class="badge badge-${badge} p-2">${b.status ? b.status.toUpperCase() : 'N/A'}</span>
                </div>
                <div class="card-body">
                    <p><strong>Bus:</strong> ${b.bus_name||'N/A'} (${b.bus_reg_no||'N/A'})</p>
                    <p><strong>Route:</strong> ${b.route_source||'N/A'} to ${b.route_destination||'N/A'}</p>
                    <p><strong>Departure:</strong> ${dep}</p>
                    <p><strong>Arrival:</strong> ${arr}</p>
                    <p><strong>Seats:</strong> ${b.num_seats} (${(b.seat_numbers_array && b.seat_numbers_array.length) ? b.seat_numbers_array.join(', ') : (b.seat_numbers || 'N/A')})</p>
                    <p><strong>Total Price:</strong> $${parseFloat(b.total_price).toFixed(2)}</p>
                    <p><small class="text-muted">Booked on: ${bookedOn}</small></p>
                    ${(b.status === 'confirmed' || b.status === 'pending') ?
                        `<button class="btn btn-sm btn-outline-danger cancel-booking-btn-user-page" data-booking-id="${b.booking_id}">Cancel Booking</button>`
                        : ''
                    }
                </div>`;
            myBookingsListContainer.appendChild(card);
        });
        addCancelEventListeners_MyPage();
    }

    function addCancelEventListeners_MyPage() {
        document.querySelectorAll('.cancel-booking-btn-user-page').forEach(button => {
            const newButton = button.cloneNode(true); button.parentNode.replaceChild(newButton, button);
            newButton.addEventListener('click', async (e) => {
                const bookingId = e.target.dataset.bookingId;
                if (!confirm(`Cancel booking ID ${bookingId}?`)) return;
                try {
                    const token = getToken();
                    const res = await fetch(`${API_BASE_URL}/bookings/${bookingId}/cancel`, {
                        method: 'PUT', headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const result = await res.json();
                    if (!res.ok) throw new Error(result.message || "Failed to cancel.");
                    alert(result.message || "Booking cancelled.");
                    loadUserBookings_MyPage(); // Refresh
                } catch (error) { alert(`Error: ${error.message}`); }
            });
        });
    }

    console.log("USER.JS: Initial setup complete for user pages.");
}); // End DOMContentLoaded