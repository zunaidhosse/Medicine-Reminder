document.addEventListener('DOMContentLoaded', () => {

    // --- State ---
    let db = []; // Main database
    const DB_NAME = 'medicineReminderDB_v1';
    let deferredInstallPrompt = null;
    let mainTimerInterval = null;
    let currentModal = null;
    let activeMedId = null; // For modals like snooze/options

    // --- Selectors ---
    const $ = (selector) => document.querySelector(selector);
    const $$ = (selector) => document.querySelectorAll(selector);

    // Layout
    const header = $('header');
    const appContainer = $('#app-container');
    const bottomNav = $('#bottom-nav');
    const modalOverlay = $('#modal-overlay');

    // Pages
    const pages = {
        home: $('#home-page'),
        notifications: $('#notifications-page')
    };
    const medicineList = $('#medicine-list');
    const notificationList = $('#notification-list');
    const emptyHomeMessage = $('#empty-home-message');
    const emptyNotificationMessage = $('#empty-notification-message');

    // Navigation
    const menuToggle = $('#menu-toggle');
    const menuClose = $('#menu-close');
    const sidebarMenu = $('#sidebar-menu');
    const navHome = $('#nav-home');
    const navAdd = $('#nav-add');
    const navNotifications = $('#nav-notifications');
    const navButtons = [navHome, navAdd, navNotifications];

    // Sidebar Menu Buttons
    const exportBtn = $('#export-data-btn');
    const importBtn = $('#import-data-btn');
    const importFileInput = $('#import-file-input');
    const appInfoBtn = $('#app-info-btn');
    const clearDataBtn = $('#clear-all-data-btn');

    // Add/Edit Modal
    const addMedicineModal = $('#add-medicine-modal');
    const modalTitle = $('#modal-title');
    const modalCancelBtn = $('#modal-cancel-btn');
    const modalOkBtn = $('#modal-ok-btn');
    const addMedicineForm = $('#add-medicine-form');
    const editMedId = $('#edit-med-id');
    const medName = $('#med-name');
    const autoSetTimes = $('#auto-set-times');
    const startDate = $('#start-date');
    const duration = $('#duration');
    const totalPills = $('#total-pills');
    const perDose = $('#per-dose');
    
    // Slot Checkboxes & Time Inputs
    const slotCheckboxes = {
        'Sokal': $('#slot-morning'),
        'Dupur': $('#slot-noon'),
        'Bikal': $('#slot-evening'),
        'Raat': $('#slot-night')
    };
    const timeInputs = {
        'Sokal': $('#time-morning'),
        'Dupur': $('#time-noon'),
        'Bikal': $('#time-evening'),
        'Raat': $('#time-night')
    };
    const timeGroups = {
        'Sokal': $('#time-morning-group'),
        'Dupur': $('#time-noon-group'),
        'Bikal': $('#time-evening-group'),
        'Raat': $('#time-night-group')
    };
    const defaultTimes = {
        'Sokal': '08:00',
        'Dupur': '13:00',
        'Bikal': '18:00',
        'Raat': '22:00'
    };

    // Other Modals
    const pinModal = $('#pin-modal');
    const pinInput = $('#pin-input');
    const pinConfirmBtn = $('#pin-confirm-btn');
    const pinCancelBtn = $('#pin-cancel-btn');

    const infoModal = $('#info-modal');
    const infoCloseBtn = $('#info-close-btn');

    const installModal = $('#install-prompt-modal');
    const installConfirmBtn = $('#install-confirm-btn');
    const installCancelBtn = $('#install-cancel-btn');

    const optionsModal = $('#options-modal');
    const optionsEditBtn = $('#options-edit-btn');
    const optionsDeleteBtn = $('#options-delete-btn');
    const optionsCancelBtn = $('#options-cancel-btn');

    const snoozeModal = $('#snooze-modal');
    const snoozeCancelBtn = $('#snooze-cancel-btn');

    // --- Database Functions ---
    const saveDB = () => {
        try {
            localStorage.setItem(DB_NAME, JSON.stringify(db));
        } catch (e) {
            console.error("Error saving to localStorage", e);
            alert("Error saving data. Storage might be full.");
        }
    };

    const loadDB = () => {
        db = JSON.parse(localStorage.getItem(DB_NAME) || '[]');
    };

    // --- Core Logic Functions ---

    /**
     * Finds the single soonest dose time for a medicine.
     * @param {object} med - The medicine object.
     * @returns {object | null} - { time: Date, slotLabel: string, isSnoozed: boolean } or null
     */
    const findNextDose = (med) => {
        const now = Date.now();
        
        // 1. Check if snoozed
        if (med.snoozedUntil && new Date(med.snoozedUntil).getTime() > now) {
            return {
                time: new Date(med.snoozedUntil),
                slotLabel: 'Snoozed',
                isSnoozed: true
            };
        }

        // 2. Check if prescription is active
        const startDate = new Date(med.startDate).getTime();
        const endDate = startDate + (med.days * 24 * 60 * 60 * 1000);
        if (now < startDate || now > endDate) {
            return null; // Not started or already finished
        }

        // 3. Check for remaining pills
        if (med.taken >= med.total) {
            return null; // No pills left
        }

        // 4. Find the soonest 'next' time from all slots
        let soonestTime = Infinity;
        let soonestSlotLabel = null;

        med.slots.forEach(slot => {
            if (slot.next) {
                const nextTime = new Date(slot.next).getTime();
                if (nextTime < soonestTime) {
                    soonestTime = nextTime;
                    soonestSlotLabel = slot.label;
                }
            }
        });

        if (soonestTime === Infinity || soonestTime > endDate) {
            return null; // All scheduled doses finished
        }

        return {
            time: new Date(soonestTime),
            slotLabel: soonestSlotLabel,
            isSnoozed: false
        };
    };

    /**
     * Calculates the 'next' time for all slots, starting from 'fromDate'.
     * @param {object} med - The medicine object.
     * @param {Date} fromDate - The date to start calculations from.
     * @returns {object} - The updated medicine object.
     */
    const calculateInitialNextTimes = (med, fromDate) => {
        const startDate = new Date(med.startDate);
        const endDate = new Date(startDate.getTime() + (med.days * 24 * 60 * 60 * 1000));
        const fromTime = fromDate.getTime();

        med.slots.forEach(slot => {
            const [hour, minute] = slot.time.split(':');
            let nextDoseTime = new Date(startDate); // Start from the beginning
            nextDoseTime.setHours(hour, minute, 0, 0);

            // Find the first valid time >= fromDate
            while (nextDoseTime.getTime() < fromTime || nextDoseTime.getTime() < startDate.getTime()) {
                nextDoseTime.setDate(nextDoseTime.getDate() + 1);
            }

            if (nextDoseTime.getTime() > endDate.getTime()) {
                slot.next = null; // No more doses for this slot
            } else {
                slot.next = nextDoseTime.toISOString();
            }
        });
        return med;
    };

    /**
     * Updates a single slot's 'next' time after it's taken.
     * @param {object} med - The medicine object.
     * @param {string} slotLabel - The label of the slot that was taken.
     */
    const updateNextDoseForSlot = (med, slotLabel) => {
        const slot = med.slots.find(s => s.label === slotLabel);
        if (!slot || !slot.next) return med;

        const startDate = new Date(med.startDate);
        const endDate = new Date(startDate.getTime() + (med.days * 24 * 60 * 60 * 1000));
        
        let newNext = new Date(slot.next);
        newNext.setDate(newNext.getDate() + 1); // Set to the same time tomorrow

        if (newNext.getTime() > endDate.getTime()) {
            slot.next = null; // Finished
        } else {
            slot.next = newNext.toISOString();
        }
        return med;
    };

    const formatCountdown = (ms) => {
        if (ms <= 0) {
            return "00:00:00";
        }
        const totalSeconds = Math.floor(ms / 1000);
        const days = Math.floor(totalSeconds / (3600 * 24));
        const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        const pad = (num) => String(num).padStart(2, '0');

        if (days > 0) {
            return `${pad(days)}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
        }
        return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    };

    // --- UI Render Functions ---

    const renderMedicineList = () => {
        if (db.length === 0) {
            emptyHomeMessage.classList.remove('hidden');
            medicineList.innerHTML = '';
            return;
        }
        emptyHomeMessage.classList.add('hidden');
        
        // Simple render (no complex diffing)
        medicineList.innerHTML = db.map(med => createMedicineCardHTML(med)).join('');
        updateAllCards(); // Initial update
    };

    const createMedicineCardHTML = (med) => {
        const progress = Math.min(100, (med.taken / med.total) * 100);
        const remaining = med.total - med.taken;
        const slotsHTML = med.slots.map(s => `<span class="slot-tag">${s.label} (${s.time})</span>`).join('');
        
        const startDate = new Date(med.startDate);
        const endDate = new Date(startDate.getTime() + (med.days * 24 * 60 * 60 * 1000));
        const isPrescriptionActive = Date.now() >= startDate.getTime() && Date.now() <= endDate.getTime();
        const isFinished = remaining <= 0 || !isPrescriptionActive;

        return `
            <div class="medicine-card glass-panel" data-id="${med.id}" data-state="${isFinished ? 'finished' : 'active'}">
                <div class="medicine-card-content">
                    <div class="card-header">
                        <h3>${med.name}</h3>
                        <span class="remaining-pills">${remaining} left</span>
                    </div>
                    <div class="card-slots">${slotsHTML}</div>
                    <div class="card-info">
                        <span>Dose: ${med.perDose} pill(s)</span>
                        <span>Ends: ${endDate.toLocaleDateString()}</span>
                    </div>
                    <div class="countdown-timer-container">
                        <div class="countdown-timer">${isFinished ? 'COMPLETED' : 'Loading...'}</div>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-bar-fill" style="width: ${progress}%;"></div>
                    </div>
                    <div class="card-actions">
                        <button class="btn btn-success btn-taken" ${isFinished ? 'disabled' : ''}>✅ Taken</button>
                        <button class="icon-button btn-snooze" ${isFinished ? 'disabled' : ''} aria-label="Snooze">🔁</button>
                        <button class="icon-button btn-options" aria-label="Options">⋮</button>
                    </div>
                </div>
            </div>
        `;
    };

    const updateAllCards = () => {
        $$('.medicine-card').forEach(card => {
            const medId = card.dataset.id;
            const med = db.find(m => m.id === medId);
            if (!med) {
                card.remove();
                return;
            }
            updateCardUI(card, med);
        });
    };

    const updateCardUI = (card, med) => {
        const timerEl = card.querySelector('.countdown-timer');
        const takenBtn = card.querySelector('.btn-taken');
        const snoozeBtn = card.querySelector('.btn-snooze');

        const nextDose = findNextDose(med);

        if (!nextDose) {
            timerEl.textContent = 'COMPLETED';
            timerEl.classList.remove('missed');
            card.dataset.state = 'finished';
            card.classList.remove('state-missed', 'state-taken');
            takenBtn.disabled = true;
            snoozeBtn.disabled = true;
            return;
        }

        const now = Date.now();
        const diff = nextDose.time.getTime() - now;

        if (diff <= 0) {
            // Missed
            timerEl.textContent = 'MISSED';
            timerEl.classList.add('missed');
            card.dataset.state = 'missed';
            card.classList.add('state-missed');
            
            // Vibrate and notify only once when it becomes missed
            if (med.missed !== true && !nextDose.isSnoozed) {
                med.missed = true;
                saveDB();
                if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
                showNotification('Dose Missed!', `Time to take your ${med.name}.`);
            }
            takenBtn.disabled = false;
            snoozeBtn.disabled = false;
        } else {
            // Upcoming
            timerEl.textContent = formatCountdown(diff);
            timerEl.classList.remove('missed');
            card.dataset.state = nextDose.isSnoozed ? 'snoozed' : 'upcoming';
            card.classList.remove('state-missed');
            
            // Disable "Taken" until it's close (e.g., 30 mins before)
            const minutesBefore = 30 * 60 * 1000;
            if (diff > minutesBefore && !nextDose.isSnoozed) {
                takenBtn.disabled = true;
            } else {
                takenBtn.disabled = false;
            }
            snoozeBtn.disabled = false;
        }

        // Highlight active slot
        card.querySelectorAll('.slot-tag').forEach(tag => {
            tag.classList.remove('active');
            if (tag.textContent.startsWith(nextDose.slotLabel)) {
                tag.classList.add('active');
            }
        });
    };

    const renderNotificationsPage = () => {
        if (db.length === 0) {
            emptyNotificationMessage.classList.remove('hidden');
            notificationList.innerHTML = '';
            return;
        }

        emptyNotificationMessage.classList.add('hidden');
        let items = [];

        db.forEach(med => {
            const nextDose = findNextDose(med);
            let status, statusText, timeText;

            if (!nextDose) {
                status = 'completed';
                statusText = 'Completed';
                timeText = 'All doses taken or prescription finished.';
            } else {
                const diff = nextDose.time.getTime() - Date.now();
                if (diff <= 0) {
                    status = 'missed';
                    statusText = 'Missed';
                    timeText = `Was due at ${nextDose.time.toLocaleTimeString()}`;
                } else {
                    status = 'upcoming';
                    statusText = 'Upcoming';
                    timeText = `Next dose at ${nextDose.time.toLocaleTimeString()}`;
                }
            }

            items.push({
                med,
                status,
                statusText,
                timeText,
                sortTime: nextDose ? nextDose.time.getTime() : Infinity
            });
        });

        // Sort: Missed first, then Upcoming, then Completed
        items.sort((a, b) => {
            if (a.status === 'missed' && b.status !== 'missed') return -1;
            if (a.status !== 'missed' && b.status === 'missed') return 1;
            return a.sortTime - b.sortTime;
        });

        notificationList.innerHTML = items.map(item => `
            <div class="notification-item glass-panel" data-id="${item.med.id}">
                <div class="notification-info">
                    <h4>${item.med.name}</h4>
                    <p>${item.timeText}</p>
                </div>
                <div class="notification-status">
                    <span class="status ${item.status}">${item.statusText}</span>
                </div>
                ${item.status !== 'completed' ? `
                <div class="notification-actions">
                    <button class="btn btn-success btn-taken btn-sm" data-id="${item.med.id}">Taken</button>
                    <button class="btn btn-secondary btn-snooze btn-sm" data-id="${item.med.id}">Snooze</button>
                </div>
                ` : ''}
            </div>
        `).join('');
    };


    // --- Modal & Navigation Functions ---
    const openModal = (modalElement, medId = null) => {
        activeMedId = medId; // Store context
        currentModal = modalElement;
        modalElement.classList.remove('hidden');
        modalOverlay.classList.remove('hidden');
    };

    const closeModal = () => {
        if (currentModal) {
            currentModal.classList.add('hidden');
        }
        modalOverlay.classList.add('hidden');
        currentModal = null;
        activeMedId = null;
    };

    const showPage = (pageName) => {
        Object.values(pages).forEach(page => page.classList.remove('active'));
        pages[pageName].classList.add('active');

        navButtons.forEach(btn => btn.classList.remove('active'));
        if (pageName === 'home') {
            navHome.classList.add('active');
            renderMedicineList();
        } else if (pageName === 'notifications') {
            navNotifications.classList.add('active');
            renderNotificationsPage();
        }
    };

    const toggleSidebar = (forceClose = false) => {
        if (forceClose || sidebarMenu.classList.contains('open')) {
            sidebarMenu.classList.remove('open');
            modalOverlay.classList.add('hidden');
        } else {
            sidebarMenu.classList.add('open');
            modalOverlay.classList.remove('hidden');
            currentModal = sidebarMenu; // So overlay click can close it
        }
    };

    // --- Form & Action Handlers ---

    const handleFormSubmit = (e) => {
        e.preventDefault();
        
        const id = editMedId.value || Date.now().toString();
        const isEdit = !!editMedId.value;

        const selectedSlots = [];
        Object.keys(slotCheckboxes).forEach(label => {
            if (slotCheckboxes[label].checked) {
                selectedSlots.push({
                    label: label,
                    time: timeInputs[label].value,
                    next: null // Will be calculated
                });
            }
        });

        if (selectedSlots.length === 0) {
            alert('Please select at least one time slot.');
            return;
        }

        let med = {
            id: id,
            name: medName.value,
            slots: selectedSlots,
            startDate: startDate.value,
            days: parseInt(duration.value),
            total: parseInt(totalPills.value),
            perDose: parseInt(perDose.value),
            taken: isEdit ? db.find(m => m.id === id).taken : 0, // Preserve taken count on edit
            missed: isEdit ? db.find(m => m.id === id).missed : false,
            snoozedUntil: isEdit ? db.find(m => m.id === id).snoozedUntil : null
        };

        // Calculate 'next' times
        med = calculateInitialNextTimes(med, new Date());

        if (isEdit) {
            db = db.map(m => m.id === id ? med : m);
        } else {
            db.push(med);
        }

        saveDB();
        renderMedicineList();
        closeModal();
        addMedicineForm.reset();
        editMedId.value = '';
    };

    const resetAddForm = () => {
        addMedicineForm.reset();
        modalTitle.textContent = 'Add New Medicine';
        modalOkBtn.textContent = 'Add Medicine';
        editMedId.value = '';
        Object.values(timeGroups).forEach(group => group.classList.add('hidden'));
    };

    const handleAutoSetTimes = (e) => {
        if (e.target.checked) {
            Object.keys(defaultTimes).forEach(label => {
                timeInputs[label].value = defaultTimes[label];
                if (slotCheckboxes[label].checked) {
                    timeGroups[label].classList.remove('hidden');
                }
            });
        }
    };

    const handleSlotCheck = (e) => {
        c
