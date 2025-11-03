class MedicineReminder {
    constructor() {
        this.medicines = JSON.parse(localStorage.getItem('medicines')) || [];
        this.timers = new Map();
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadMedicines();
        this.setupServiceWorker();
        this.checkInstallPrompt();
        this.startAllTimers();
        this.requestNotificationPermission();
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const page = e.currentTarget.dataset.page;
                this.showPage(page);
                document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
            });
        });

        // Menu
        document.getElementById('menuBtn').addEventListener('click', () => {
            this.showModal('menuModal');
        });

        document.getElementById('closeMenu').addEventListener('click', () => {
            this.hideModal('menuModal');
        });

        // Form
        document.getElementById('medicineForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addMedicine();
        });

        document.getElementById('cancelBtn').addEventListener('click', () => {
            this.showPage('homePage');
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            document.querySelector('[data-page="homePage"]').classList.add('active');
        });

        // Menu actions
        document.getElementById('helpLine').addEventListener('click', () => {
            window.open('https://zunaidhosse.github.io/My-contact/', '_blank');
        });

        document.getElementById('shareApp').addEventListener('click', () => {
            window.open('https://i.postimg.cc/cHL1S9Wv/qrcode-1.png', '_blank');
        });

        document.getElementById('exportData').addEventListener('click', () => {
            this.exportData();
        });

        document.getElementById('importData').addEventListener('click', () => {
            this.importData();
        });

        document.getElementById('appInfo').addEventListener('click', () => {
            this.showModal('infoModal');
        });

        document.getElementById('closeInfo').addEventListener('click', () => {
            this.hideModal('infoModal');
        });

        document.getElementById('clearData').addEventListener('click', () => {
            this.clearData();
        });

        // Install prompt
        document.getElementById('installBtn').addEventListener('click', () => {
            this.installApp();
        });

        document.getElementById('cancelInstall').addEventListener('click', () => {
            this.hideInstallPrompt();
        });

        // Test notification
        document.getElementById('triggerTest').addEventListener('click', () => {
            this.showNotification('Test Reminder', 'This is a test notification');
        });
    }

    showPage(pageId) {
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });
        document.getElementById(pageId).classList.add('active');
    }

    showModal(modalId) {
        document.getElementById(modalId).classList.add('active');
    }

    hideModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
    }

    addMedicine() {
        const formData = new FormData(document.getElementById('medicineForm'));
        const name = document.getElementById('medicineName').value;
        const timeSlots = Array.from(document.querySelectorAll('.time-slots input:checked'))
                              .map(cb => cb.value);
        const startDate = document.getElementById('startDate').value;
        const days = parseInt(document.getElementById('days').value);
        const totalPills = parseInt(document.getElementById('totalPills').value);
        const dosesPerSlot = parseInt(document.getElementById('dosesPerSlot').value) || 1;

        if (!name || timeSlots.length === 0 || !startDate || !days || !totalPills) {
            alert('Please fill all required fields');
            return;
        }

        const medicine = {
            id: Date.now().toString(),
            name,
            timeSlots,
            startDate,
            days,
            totalPills,
            dosesPerSlot,
            takenCount: 0,
            createdAt: new Date().toISOString()
        };

        this.medicines.unshift(medicine);
        this.saveMedicines();
        this.renderMedicines();
        this.scheduleMedicine(medicine);
        this.showPage('homePage');
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('[data-page="homePage"]').classList.add('active');
        document.getElementById('medicineForm').reset();
    }

    scheduleMedicine(medicine) {
        medicine.timeSlots.forEach(slot => {
            const time = this.getSlotTime(slot);
            const nextDose = this.calculateNextDose(medicine.startDate, time);
            
            if (nextDose > Date.now()) {
                const timeout = setTimeout(() => {
                    this.triggerDoseReminder(medicine, slot);
                }, nextDose - Date.now());
                
                this.timers.set(`${medicine.id}-${slot}`, timeout);
            }
        });
    }

    getSlotTime(slot) {
        const times = {
            morning: '08:00',
            noon: '12:00',
            evening: '18:00',
            night: '22:00'
        };
        return times[slot] || '08:00';
    }

    calculateNextDose(startDate, time) {
        const start = new Date(startDate);
        const [hours, minutes] = time.split(':').map(Number);
        start.setHours(hours, minutes, 0, 0);
        
        const now = new Date();
        let nextDose = new Date(start);
        
        while (nextDose <= now) {
            nextDose.setDate(nextDose.getDate() + 1);
        }
        
        return nextDose.getTime();
    }

    triggerDoseReminder(medicine, slot) {
        // Show notification
        this.showNotification(
            `Medicine Reminder: ${medicine.name}`,
            `Time to take your ${slot} dose`
        );

        // Mark as missed and update UI
        medicine.missed = true;
        this.saveMedicines();
        this.renderMedicines();

        // Reschedule for next day
        const nextDose = this.calculateNextDose(medicine.startDate, this.getSlotTime(slot));
        const timeout = setTimeout(() => {
            this.triggerDoseReminder(medicine, slot);
        }, nextDose - Date.now());
        
        this.timers.set(`${medicine.id}-${slot}`, timeout);
    }

    markAsTaken(medicineId) {
        const medicine = this.medicines.find(m => m.id === medicineId);
        if (medicine) {
            medicine.takenCount += medicine.dosesPerSlot;
            medicine.missed = false;
            this.saveMedicines();
            this.renderMedicines();
            
            // Show confirmation
            this.showNotification('Medicine Taken', `${medicine.name} marked as taken`);
        }
    }

    snoozeMedicine(medicineId, minutes = 5) {
        const medicine = this.medicines.find(m => m.id === medicineId);
        if (medicine) {
            medicine.snoozedUntil = Date.now() + (minutes * 60 * 1000);
            this.saveMedicines();
            this.renderMedicines();
            
            setTimeout(() => {
                medicine.snoozedUntil = null;
                this.saveMedicines();
                this.renderMedicines();
            }, minutes * 60 * 1000);
        }
    }

    renderMedicines() {
        const container = document.getElementById('medicinesList');
        container.innerHTML = '';

        if (this.medicines.length === 0) {
            container.innerHTML = `
                <div class="medicine-card" style="text-align: center; color: #666;">
                    <p>No medicines added yet.</p>
                    <p>Click the + button to add your first medicine.</p>
                </div>
            `;
            return;
        }

        this.medicines.forEach(medicine => {
            const remainingPills = medicine.totalPills - medicine.takenCount;
            const nextDoseTime = this.calculateNextDoseTime(medicine);
            
            const card = document.createElement('div');
            card.className = `medicine-card ${medicine.missed ? 'missed' : ''}`;
            card.innerHTML = `
                <div class="medicine-header">
                    <div class="medicine-name">${medicine.name}</div>
                    <div class="pill-count">${remainingPills} left</div>
                </div>
                <div class="countdown ${medicine.missed ? 'urgent' : ''}">
                    Next dose: ${nextDoseTime}
                </div>
                <div class="progress-bar">
                    <div class="progress" style="width: ${(medicine.takenCount / medicine.totalPills) * 100}%"></div>
                </div>
                <div class="medicine-actions">
                    <button class="btn btn-taken" onclick="app.markAsTaken('${medicine.id}')">
                        Taken
                    </button>
                    <button class="btn btn-snooze" onclick="app.snoozeMedicine('${medicine.id}')">
                        Snooze 5min
                    </button>
                </div>
            `;
            container.appendChild(card);
        });
    }

    calculateNextDoseTime(medicine) {
        const now = new Date();
        const today = new Date().toDateString();
        
        for (const slot of medicine.timeSlots) {
            const time = this.getSlotTime(slot);
            const [hours, minutes] = time.split(':').map(Number);
            const slotTime = new Date(`${today} ${time}`);
            
            if (slotTime > now) {
                return `${slot} (${time})`;
            }
        }
        
        // If all slots passed today, show first slot tomorrow
        const firstSlot = medicine.timeSlots[0];
        const time = this.getSlotTime(firstSlot);
        return `tomorrow ${firstSlot} (${time})`;
    }

    loadMedicines() {
        this.renderMedicines();
    }

    saveMedicines() {
        localStorage.setItem('medicines', JSON.stringify(this.medicines));
    }

    startAllTimers() {
        this.medicines.forEach(medicine => {
            this.scheduleMedicine(medicine);
        });
    }

    async requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            await Notification.requestPermission();
        }
    }

    showNotification(title, body) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, { body, icon: '/app-icon-192.png' });
        }
    }

    exportData() {
        const data = JSON.stringify(this.medicines, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'medicine-reminder-backup.json';
        a.click();
        URL.revokeObjectURL(url);
    }

    importData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    this.medicines = data;
                    this.saveMedicines();
                    this.renderMedicines();
                    this.startAllTimers();
                    alert('Data imported successfully!');
                } catch (error) {
                    alert('Error importing data: Invalid file format');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    clearData() {
        const password = prompt('Enter 4-digit password to clear all data:');
        if (password === '1234') { // Simple password for demo
            if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
                this.medicines = [];
                this.timers.forEach(timer => clearTimeout(timer));
                this.timers.clear();
                localStorage.removeItem('medicines');
                this.renderMedicines();
                alert('All data cleared successfully!');
            }
        } else {
            alert('Incorrect password!');
        }
    }

    setupServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/service-worker.js')
                .then(registration => {
                    console.log('SW registered: ', registration);
                })
                .catch(registrationError => {
                    console.log('SW registration failed: ', registrationError);
                });
        }
    }

    checkInstallPrompt() {
        let deferredPrompt;
        
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            document.getElementById('installPrompt').classList.add('active');
        });

        window.addEventListener('appinstalled', () => {
            document.getElementById('installPrompt').classList.remove('active');
            deferredPrompt = null;
        });
    }

    installApp() {
        if (this.deferredPrompt) {
            this.deferredPrompt.prompt();
            this.deferredPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    console.log('User accepted the install prompt');
                }
                this.deferredPrompt = null;
                this.hideInstallPrompt();
            });
        }
    }

    hideInstallPrompt() {
        document.getElementById('installPrompt').classList.remove('active');
    }
}

// Initialize app
const app = new MedicineReminder();