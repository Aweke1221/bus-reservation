// frontend/js/main.js
console.log("MAIN.JS (Full Version for index.html): Script loaded.");

document.addEventListener('DOMContentLoaded', () => {
    console.log("MAIN.JS: DOMContentLoaded fired.");

    // --- Element Caching ---
    const sourceSelect = document.getElementById('sourceSelect');
    const destinationSelect = document.getElementById('destinationSelect');
    const searchForm = document.getElementById('searchBusForm');
    const searchResultsDiv = document.getElementById('searchResults');
    const dateInput = document.getElementById('date');

    const seatSelectionModalEl = $('#seatSelectionModal');
    const seatModalInfoEls = {
        busName: document.getElementById('seatModalBusName'),
        busRegNo: document.getElementById('seatModalBusRegNo'),
        routeSource: document.getElementById('seatModalRouteSource'),
        routeDestination: document.getElementById('seatModalRouteDestination'),
        departureTime: document.getElementById('seatModalDepartureTime'),
        seatsToSelectCount: document.getElementById('seatsToSelectCount'),
        seatsCurrentlySelectedCount: document.getElementById('seatsCurrentlySelectedCount')
    };
    const seatMapContainerEl = document.getElementById('seatMapContainer');
    const seatSelectionMessageEl = document.getElementById('seatSelectionMessage');
    const confirmSeatSelectionButton = document.getElementById('confirmSeatSelectionBtn');

    const passengerDetailsModalEl = $('#passengerDetailsModal');
    const passengerFormsContainerEl = document.getElementById('passengerFormsContainer');
    const passengerFormSeatCountEl = document.getElementById('passengerFormSeatCount');
    const passengerFormSelectedSeatsDisplayEl = document.getElementById('passengerFormSelectedSeatsDisplay');
    const passengerDetailsMessageAreaEl = document.getElementById('passengerDetailsMessageArea');
    const backToSeatSelectionButton = document.getElementById('backToSeatSelectionBtn');
    const confirmBookingFinalButton = document.getElementById('confirmBookingBtn');

    // --- Global State for Booking Flow ---
    let currentScheduleIdForBookingFlow = null;
    let currentScheduleDetailsForModals = {};
    let seatsUserWantsToSelect = 0;
    let selectedSeatsOnMap = [];
    let busCapacityForCurrentSchedule = 0;
    let alreadyBookedSeatsForCurrentSchedule = [];

    if (dateInput) {
        dateInput.setAttribute('min', new Date().toISOString().split('T')[0]);
    }

    // --- Populate Source/Destination Dropdowns ---
    async function populateIndexDropdown(selectElement, endpoint, defaultText, logKey) {
        console.log(`MAIN.JS: Populating ${logKey}. Element found:`, !!selectElement);
        if (!selectElement) { console.error(`MAIN.JS: ${logKey} select element NOT FOUND.`); return; }
        selectElement.disabled = true;
        selectElement.innerHTML = `<option value="" disabled selected>Loading ${defaultText}...</option>`;
        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`);
            console.log(`MAIN.JS: ${logKey} API status for ${endpoint}: ${response.status}`);
            if (!response.ok) {
                let errText = `Server error ${response.status}`; try { const ed = await response.json(); errText = ed.message || errText; } catch (e) { try { errText = await response.text() || errText; } catch (e2) {} }
                throw new Error(errText);
            }
            const items = await response.json(); // EXPECTS: ["CityA", "CityB"]
            console.log(`MAIN.JS: ${logKey} data received:`, items);
            selectElement.innerHTML = `<option value="" disabled selected>Select ${defaultText}</option>`;
            if (items && Array.isArray(items) && items.length > 0) {
                items.forEach(item => {
                    if (typeof item === 'string' && item.trim() !== '') {
                        const option = document.createElement('option');
                        option.value = item; option.textContent = item;
                        selectElement.appendChild(option);
                    }
                });
            } else {
                selectElement.innerHTML += `<option value="" disabled>No ${defaultText.toLowerCase()} available</option>`;
            }
        } catch (error) {
            console.error(`MAIN.JS: Error populating ${logKey} dropdown:`, error);
            selectElement.innerHTML = `<option value="" disabled>Error loading!</option>`;
            if (searchResultsDiv) searchResultsDiv.innerHTML = `<div class="alert alert-danger">Could not load route options. ${error.message}</div>`;
        } finally {
            selectElement.disabled = false;
        }
    }

    if (searchForm) {
        if (sourceSelect) populateIndexDropdown(sourceSelect, '/routes/sources', 'Source', 'Sources');
        else console.error("MAIN.JS: sourceSelect element with ID 'sourceSelect' MISSING!");
        if (destinationSelect) populateIndexDropdown(destinationSelect, '/routes/destinations', 'Destination', 'Destinations');
        else console.error("MAIN.JS: destinationSelect element with ID 'destinationSelect' MISSING!");
    }

    // --- Search Form Submission ---
    if (searchForm) {
        searchForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const source = sourceSelect ? sourceSelect.value : '';
            const destination = destinationSelect ? destinationSelect.value : '';
            const date = dateInput ? dateInput.value : '';
            if (!source || !destination || !date) {
                if(searchResultsDiv) searchResultsDiv.innerHTML = `<div class="alert alert-warning">All search fields are required.</div>`; return;
            }
            if (source === destination) {
                if(searchResultsDiv) searchResultsDiv.innerHTML = `<div class="alert alert-warning">Source and Destination cannot be the same.</div>`; return;
            }
            if(searchResultsDiv) searchResultsDiv.innerHTML = `<p class="text-center">Searching...</p>`;
            try {
                const res = await fetch(`${API_BASE_URL}/buses/search?source=${encodeURIComponent(source)}&destination=${encodeURIComponent(destination)}&date=${date}`);
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || 'Search failed');
                displaySearchResults(data);
            } catch (err) {
                if(searchResultsDiv) searchResultsDiv.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
            }
        });
    }

    // --- Display Search Results ---
    function displaySearchResults(schedules) {
        if (!searchResultsDiv) return; searchResultsDiv.innerHTML = '';
        if (!schedules || !schedules.length) { searchResultsDiv.innerHTML = '<p class="text-center text-muted">No buses found.</p>'; return; }
        const title = document.createElement('h4'); title.textContent = 'Available Trips:'; title.className = 'mb-3 text-center'; searchResultsDiv.appendChild(title);
        schedules.forEach(s => {
            const card = document.createElement('div'); card.className = 'card mb-3 booking-card shadow-sm';
            const dep = new Date(s.departure_time).toLocaleString([], {dateStyle:'medium', timeStyle:'short'});
            const arr = new Date(s.arrival_time).toLocaleString([], {dateStyle:'medium', timeStyle:'short'});
            card.innerHTML = `
                <div class="card-body"> <h5 class="card-title">${s.bus_name||'Bus'} (${s.registration_number||'N/A'}) ${s.is_virtual?'<span class="badge badge-info">Default Run</span>':''}</h5>
                <p class="card-text"><strong>Route:</strong> ${s.source} to ${s.destination}</p>
                <p class="card-text"><small><strong>Departs:</strong> ${dep} | <strong>Arrives:</strong> ${arr}</small></p>
                <div class="d-flex justify-content-between align-items-center"><div><strong>Price:</strong> $${parseFloat(s.price_per_seat).toFixed(2)}<br><strong class="${s.seats_available > 0 ? (s.seats_available > 5 ? 'text-success':'text-warning') : 'text-danger'}">Seats: ${s.seats_available}</strong></div>
                <button class="btn btn-success book-now-btn" data-schedule-id="${s.schedule_id || `virtual-${s.bus_id}-${s.route_id}-${s.departure_time}`}" data-is-virtual="${s.is_virtual || false}" data-price="${s.price_per_seat}" data-bus-name="${s.bus_name||'N/A'}" data-bus-reg-no="${s.registration_number||'N/A'}" data-route-source="${s.source}" data-route-destination="${s.destination}" data-departure-time-formatted="${dep}" data-bus-id-virtual="${s.bus_id}" data-route-id-virtual="${s.route_id}" data-departure-time-virtual="${s.departure_time}" data-arrival-time-virtual="${s.arrival_time}" data-bus-capacity-virtual="${s.bus_capacity || ''}" ${s.seats_available <= 0 ? 'disabled':''}>${s.seats_available <= 0 ? 'Sold Out':'Select Seats'}</button>
                </div></div>`;
            searchResultsDiv.appendChild(card);
        });
        addBookingEventListeners();
    }

    // --- Add Listeners to "Select Seats" Buttons ---
    function addBookingEventListeners() {
        document.querySelectorAll('.book-now-btn').forEach(button => {
            const newButton = button.cloneNode(true); button.parentNode.replaceChild(newButton, button);
            newButton.addEventListener('click', async (e) => {
                const targetButton = e.currentTarget;
                if (!getToken()) { alert('Please login to book.'); window.location.href = 'login.html'; return; }
                const numSeatsInput = prompt("How many seats to select?", "1");
                if (numSeatsInput === null) return;
                seatsUserWantsToSelect = parseInt(numSeatsInput);
                if (isNaN(seatsUserWantsToSelect) || seatsUserWantsToSelect <= 0) { alert("Invalid number of seats."); seatsUserWantsToSelect = 0; return; }
                currentScheduleIdForBookingFlow = targetButton.dataset.scheduleId;
                currentScheduleDetailsForModals = {
                    busName: targetButton.dataset.busName, busRegNo: targetButton.dataset.busRegNo,
                    routeSource: targetButton.dataset.routeSource, routeDestination: targetButton.dataset.routeDestination,
                    departureTimeFormatted: targetButton.dataset.departureTimeFormatted,
                    isVirtual: targetButton.dataset.isVirtual === 'true',
                    pricePerSeat: parseFloat(targetButton.dataset.price),
                    busIdVirtual: targetButton.dataset.busIdVirtual, routeIdVirtual: targetButton.dataset.routeIdVirtual,
                    departureTimeVirtual: targetButton.dataset.departureTimeVirtual, arrivalTimeVirtual: targetButton.dataset.arrivalTimeVirtual,
                    busCapacityVirtual: parseInt(targetButton.dataset.busCapacityVirtual) || 0
                };
                await openAndPrepareSeatSelectionModal();
            });
        });
    }

    // --- SEAT SELECTION MODAL LOGIC ---
    async function openAndPrepareSeatSelectionModal() {
        console.log(`MAIN.JS: Opening seat modal. SchedCtx: ${currentScheduleIdForBookingFlow}, UserWants: ${seatsUserWantsToSelect}`);
        if (!seatSelectionModalEl || typeof seatSelectionModalEl.modal !== 'function') { console.error("Seat modal missing!"); return; }
        Object.keys(seatModalInfoEls).forEach(key => { if (seatModalInfoEls[key]) seatModalInfoEls[key].textContent = 'N/A'; }); // Reset info
        if(seatModalInfoEls.busName) seatModalInfoEls.busName.textContent = currentScheduleDetailsForModals.busName;
        if(seatModalInfoEls.busRegNo) seatModalInfoEls.busRegNo.textContent = currentScheduleDetailsForModals.busRegNo;
        if(seatModalInfoEls.routeSource) seatModalInfoEls.routeSource.textContent = currentScheduleDetailsForModals.routeSource;
        if(seatModalInfoEls.routeDestination) seatModalInfoEls.routeDestination.textContent = currentScheduleDetailsForModals.routeDestination;
        if(seatModalInfoEls.departureTime) seatModalInfoEls.departureTime.textContent = currentScheduleDetailsForModals.departureTimeFormatted;
        if(seatModalInfoEls.seatsToSelectCount) seatModalInfoEls.seatsToSelectCount.textContent = seatsUserWantsToSelect;
        if(seatModalInfoEls.seatsCurrentlySelectedCount) seatModalInfoEls.seatsCurrentlySelectedCount.textContent = '0';
        if(seatSelectionMessageEl) seatSelectionMessageEl.textContent = '';
        selectedSeatsOnMap = [];
        if(confirmSeatSelectionButton) confirmSeatSelectionButton.disabled = true;
        if(seatMapContainerEl) seatMapContainerEl.innerHTML = '<p class="text-center text-muted py-4">Loading map...</p>';
        seatSelectionModalEl.modal('show');
        try {
            let scheduleIdAPI = currentScheduleIdForBookingFlow;
            if (currentScheduleDetailsForModals.isVirtual) {
                busCapacityForCurrentSchedule = currentScheduleDetailsForModals.busCapacityVirtual;
                if (!busCapacityForCurrentSchedule) {
                    const busResp = await fetch(`${API_BASE_URL}/buses/${currentScheduleDetailsForModals.busIdVirtual}`);
                    if(!busResp.ok) throw new Error("Could not fetch bus capacity for virtual.");
                    const busD = await busResp.json(); busCapacityForCurrentSchedule = busD.capacity;
                }
                alreadyBookedSeatsForCurrentSchedule = [];
            } else {
                const detailsResp = await fetch(`${API_BASE_URL}/schedules/${scheduleIdAPI}/details`, { headers: {'Authorization': `Bearer ${getToken()}`} });
                if (!detailsResp.ok) { const et = await detailsResp.text(); throw new Error(`Failed to fetch seat details: ${et}`);}
                const data = await detailsResp.json();
                busCapacityForCurrentSchedule = data.bus_capacity;
                alreadyBookedSeatsForCurrentSchedule = data.booked_seats_list || [];
            }
            if (busCapacityForCurrentSchedule > 0) generateSeatMap(busCapacityForCurrentSchedule, alreadyBookedSeatsForCurrentSchedule);
            else throw new Error("Bus capacity unavailable.");
        } catch (error) {
            console.error("MAIN.JS: Error preparing seat map:", error);
            if(seatMapContainerEl) seatMapContainerEl.innerHTML = `<p class="text-danger text-center py-4">Error map: ${error.message}</p>`;
        }
    }

    function generateSeatMap(capacity, bookedSeats) {
        if (!seatMapContainerEl) return; seatMapContainerEl.innerHTML = '';
        const seatsPerRow=[2,2], totalPerRow=seatsPerRow.reduce((a,b)=>a+b,0), numRows=Math.ceil(capacity/totalPerRow);
        const letters="ABCDEFGHIJKLMN"; let seatNumGlobal=0;
        for(let i=0;i<numRows;i++){const row=document.createElement('div');row.className='seat-row';let visualInRow=0;
            const g1=document.createElement('div');g1.className='seat-group';for(let k=0;k<seatsPerRow[0];k++){seatNumGlobal++;if(seatNumGlobal<=capacity){visualInRow++;const sid=`${letters[i]}${visualInRow}`;g1.appendChild(createSeatElement(sid,bookedSeats));}else{g1.appendChild(createEmptySeatPlaceholder());}}row.appendChild(g1);
            row.appendChild(createAisleElement()); const g2=document.createElement('div');g2.className='seat-group';for(let k=0;k<seatsPerRow[1];k++){seatNumGlobal++;if(seatNumGlobal<=capacity){visualInRow++;const sid=`${letters[i]}${visualInRow}`;g2.appendChild(createSeatElement(sid,bookedSeats));}else{g2.appendChild(createEmptySeatPlaceholder());}}row.appendChild(g2);
            seatMapContainerEl.appendChild(row);
        }
    }
    function createEmptySeatPlaceholder(){const el=document.createElement('div');el.className='seat non-existent';return el;}
    function createAisleElement(){const el=document.createElement('div');el.className='aisle';return el;}
    function createSeatElement(seatId, bookedSeats){const s=document.createElement('div');s.className='seat';s.dataset.seatId=seatId;s.textContent=seatId;if(Array.isArray(bookedSeats)&&bookedSeats.includes(seatId)){s.classList.add('booked');}else{s.classList.add('available');s.addEventListener('click',handleSeatClick);}return s;}

    function handleSeatClick(event) {
        const seatDiv=event.target.closest('.seat');if(!seatDiv||(!seatDiv.classList.contains('available')&&!seatDiv.classList.contains('selected')))return;
        const seatId=seatDiv.dataset.seatId;if(seatSelectionMessageEl)seatSelectionMessageEl.textContent='';
        if(seatDiv.classList.contains('selected')){seatDiv.classList.remove('selected');seatDiv.classList.add('available');selectedSeatsOnMap=selectedSeatsOnMap.filter(s=>s!==seatId);}
        else if(seatDiv.classList.contains('available')){if(selectedSeatsOnMap.length<seatsUserWantsToSelect){seatDiv.classList.remove('available');seatDiv.classList.add('selected');selectedSeatsOnMap.push(seatId);}else{if(seatSelectionMessageEl)seatSelectionMessageEl.textContent=`Max ${seatsUserWantsToSelect} seats.`;}}
        if(seatModalInfoEls.seatsCurrentlySelectedCount)seatModalInfoEls.seatsCurrentlySelectedCount.textContent=selectedSeatsOnMap.length;
        updateConfirmButtonState(); console.log("MAIN.JS: Selected seats:", selectedSeatsOnMap);
    }

    function updateConfirmButtonState() {
        if(!confirmSeatSelectionButton)return;
        const canConfirm = selectedSeatsOnMap.length === seatsUserWantsToSelect && seatsUserWantsToSelect > 0;
        confirmSeatSelectionButton.disabled = !canConfirm;
        console.log(`MAIN.JS: updateConfirmBtn - Selected: ${selectedSeatsOnMap.length}, Wants: ${seatsUserWantsToSelect}, BtnDisabled: ${confirmSeatSelectionButton.disabled}`);
    }

    if (confirmSeatSelectionButton) {
        confirmSeatSelectionButton.addEventListener('click', () => {
            console.log("MAIN.JS: Confirm Seats CLICKED. Selected:", selectedSeatsOnMap.length, "Wants:", seatsUserWantsToSelect);
            if (selectedSeatsOnMap.length !== seatsUserWantsToSelect || seatsUserWantsToSelect === 0) {
                if(seatSelectionMessageEl)seatSelectionMessageEl.textContent=`Select ${seatsUserWantsToSelect>0?seatsUserWantsToSelect:'required'} seats.`; return;
            }
            if(seatSelectionModalEl)seatSelectionModalEl.modal('hide');
            preparePassengerDetailsForm(selectedSeatsOnMap);
            if(passengerDetailsModalEl)passengerDetailsModalEl.modal('show');
        });
    } else { console.error("MAIN.JS: confirmSeatSelectionButton NOT FOUND in DOM!"); }

    function preparePassengerDetailsForm(seatIds) { /* ... (Full implementation from previous) ... */
        if(!passengerFormsContainerEl || !passengerFormSeatCountEl || !passengerFormSelectedSeatsDisplayEl) return;
        passengerFormSeatCountEl.textContent = seatIds.length; passengerFormSelectedSeatsDisplayEl.textContent = seatIds.join(', ');
        if(passengerDetailsMessageAreaEl) passengerDetailsMessageAreaEl.innerHTML = ''; passengerFormsContainerEl.innerHTML = ''; const user = getCurrentUser();
        seatIds.forEach((sid, idx) => {const pNum=idx+1;let pName='',pEmail='';if(idx===0&&user){pName=user.username||'';pEmail=user.email||'';}
        const formHtml = `<div class="passenger-form-entry card mb-3"><div class="card-header bg-light">Passenger ${pNum} (Seat: <strong>${sid}</strong>)</div><div class="card-body"><div class="form-row"><div class="form-group col-md-6"><label for="passengerName${pNum}">Full Name <span class="text-danger">*</span></label><input type="text" class="form-control" id="passengerName${pNum}" value="${pName}" required></div><div class="form-group col-md-3"><label for="passengerAge${pNum}">Age <span class="text-danger">*</span></label><input type="number" class="form-control" id="passengerAge${pNum}" min="1" required></div><div class="form-group col-md-3"><label for="passengerGender${pNum}">Gender</label><select class="form-control custom-select" id="passengerGender${pNum}"><option value="">Select</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option></select></div></div>${idx === 0 ? `<div class="form-row"><div class="form-group col-md-6"><label for="passengerContact${pNum}">Contact No. <span class="text-danger">*</span></label><input type="tel" class="form-control" id="passengerContact${pNum}" required></div><div class="form-group col-md-6"><label for="passengerEmail${pNum}">Email <span class="text-danger">*</span></label><input type="email" class="form-control" id="passengerEmail${pNum}" value="${pEmail}" required></div></div>` : ''}<div class="form-group form-check mb-0"><input type="checkbox" class="form-check-input" id="isChild${pNum}"><label class="form-check-label" for="isChild${pNum}">Is child? (e.g. <12)</label></div></div></div>`;
        passengerFormsContainerEl.insertAdjacentHTML('beforeend', formHtml);});
    }

    if(backToSeatSelectionButton) { /* ... (listener as before) ... */
        backToSeatSelectionButton.addEventListener('click', () => {
            if(passengerDetailsModalEl) passengerDetailsModalEl.modal('hide');
            if(seatSelectionModalEl) { updateConfirmButtonState(); seatSelectionModalEl.modal('show');}
        });
    }

    if(confirmBookingFinalButton) { /* ... (full listener from previous, ensuring payload num_seats: selectedSeatsOnMap.length) ... */
        confirmBookingFinalButton.addEventListener('click', async () => {
            if(passengerDetailsMessageAreaEl) passengerDetailsMessageAreaEl.innerHTML = '';
            const pForm = document.getElementById('passengerDetailsForm'); if (!pForm) return; let allValid = true; const pDataArray = [];
            const pEntries = pForm.querySelectorAll('.passenger-form-entry');
            if (selectedSeatsOnMap.length !== pEntries.length || selectedSeatsOnMap.length !== seatsUserWantsToSelect) { /* display error */ return; }
            pEntries.forEach((entry, index) => { /* data collection & validation */
                const pN=index+1; const nE=entry.querySelector(`#passengerName${pN}`); const aE=entry.querySelector(`#passengerAge${pN}`); const cE=entry.querySelector(`#passengerContact${pN}`); const eE=entry.querySelector(`#passengerEmail${pN}`);
                if(!nE.value.trim()){nE.classList.add('is-invalid');allValid=false;}else{nE.classList.remove('is-invalid');} if(!aE.value.trim()||parseInt(aE.value)<=0){aE.classList.add('is-invalid');allValid=false;}else{aE.classList.remove('is-invalid');}
                if(index===0){if(!cE||!cE.value.trim()){if(cE)cE.classList.add('is-invalid');allValid=false;}else{if(cE)cE.classList.remove('is-invalid');} if(!eE||!eE.value.trim()||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(eE.value)){if(eE)eE.classList.add('is-invalid');allValid=false;}else{if(eE)eE.classList.remove('is-invalid');}}
                pDataArray.push({passenger_name:nE.value.trim(),passenger_age:parseInt(aE.value),passenger_gender:entry.querySelector(`#passengerGender${pN}`).value||null,is_child:entry.querySelector(`#isChild${pN}`).checked,seat_number:selectedSeatsOnMap[index],contact_number:index===0&&cE?cE.value.trim():null,email_address:index===0&&eE?eE.value.trim():null});
            });
            if (!allValid) { if(passengerDetailsMessageAreaEl) passengerDetailsMessageAreaEl.innerHTML = `<div class="alert alert-warning small">Fill required passenger details.</div>`; return; }
            confirmBookingFinalButton.disabled = true; confirmBookingFinalButton.innerHTML = 'Processing...'; const token = getToken();
            let payload = {num_seats:selectedSeatsOnMap.length,seat_numbers:selectedSeatsOnMap,passengers:pDataArray}; // Ensure num_seats matches selectedSeatsOnMap.length
            if(currentScheduleDetailsForModals.isVirtual){payload.is_virtual_booking=true;payload.bus_id=parseInt(currentScheduleDetailsForModals.busIdVirtual);payload.route_id=parseInt(currentScheduleDetailsForModals.routeIdVirtual);payload.departure_time=currentScheduleDetailsForModals.departureTimeVirtual;payload.arrival_time=currentScheduleDetailsForModals.arrivalTimeVirtual;payload.price_per_seat=currentScheduleDetailsForModals.pricePerSeat;}else{payload.schedule_id=parseInt(currentScheduleIdForBookingFlow);}
            console.log("MAIN.JS: Final Booking Payload:", payload);
            try {
                const res = await fetch(`${API_BASE_URL}/bookings`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify(payload)});
                const result = await res.json(); if(!res.ok) throw new Error(result.message||'Booking finalization failed');
                if(passengerDetailsModalEl)passengerDetailsModalEl.modal('hide');
                alert(`Booking Confirmed! ID: ${result.bookingId}. Seats: ${selectedSeatsOnMap.join(', ')}.`);
                selectedSeatsOnMap=[];currentScheduleIdForBookingFlow=null;seatsUserWantsToSelect=0;currentScheduleDetailsForModals={};
                if(searchForm)searchForm.dispatchEvent(new Event('submit'));
            } catch(e){console.error('MAIN.JS: Final Booking error:',e); if(passengerDetailsMessageAreaEl) passengerDetailsMessageAreaEl.innerHTML = `<div class="alert alert-danger">${e.message}</div>`; else alert(`Booking Error: ${e.message}`);
            } finally {confirmBookingFinalButton.disabled=false; confirmBookingFinalButton.innerHTML='<i class="fas fa-check-circle mr-2"></i>Confirm & Book Now';}
        });
    }

    if (typeof updateNav === 'function') updateNav();
    console.log("MAIN.JS: Initial setup complete for index.html.");
});
