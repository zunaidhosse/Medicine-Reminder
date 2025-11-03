// Simple QR Code Generator
function generateQRCode(text) {
    const canvas = document.getElementById('qrcode');
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Simple QR-like pattern (in real app, use a QR library)
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('QR CODE', canvas.width/2, canvas.height/2 - 10);
    ctx.font = '12px Arial';
    ctx.fillText('App Link:', canvas.width/2, canvas.height/2 + 10);
    ctx.fillText('medicine-reminder.app', canvas.width/2, canvas.height/2 + 25);
}

// Language translations
const translations = {
    en: {
        app_title: "Medicine Reminder",
        add_medicine: "Add Medicine",
        medicine_name: "Medicine Name",
        intake_time: "Intake Time",
        start_date: "Start Date",
        days_count: "Days Count",
        search_placeholder: "🔍 Search medicine...",
        taken: "Taken",
        take: "Take?",
        morning: "Morning",
        noon: "Noon", 
        night: "Night",
        morning_night: "Morning & Night",
        morning_noon_night: "Morning, Noon & Night"
    },
    bn: {
        app_title: "ঔষধ মনে রাখুন",
        add_medicine: "ঔষধ যোগ করুন",
        medicine_name: "ঔষধের নাম",
        intake_time: "খাওয়ার সময়",
        start_date: "শুরু তারিখ",
        days_count: "দিন সংখ্যা",
        search_placeholder: "🔍 ঔষধ খুঁজুন...",
        taken: "খেয়েছি",
        take: "খেয়েছি?",
        morning: "সকাল",
        noon: "দুপুর",
        night: "রাত",
        morning_night: "সকাল ও রাত",
        morning_noon_night: "সকাল, দুপুর ও রাত"
    }
};

let currentLanguage = 'en';

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    // Set today's date as default
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('startDate').value = today;
    
    // Load medicines
    loadMedicines();
    
    // Start timers
    startTimers();
    
    // Setup event listeners
    setupEventListeners();
    
    // Check if already installed
    checkInstallStatus();
}

function checkInstallStatus() {
    const installShown = localStorage.getItem('installPromptShown');
    if (!installShown) {
        // Show install prompt first time
        document.getElementById('installPopup').classList.remove('hidden');
    } else {
        // Already shown, proceed to main app
        showMainApp();
    }
}

function showMainApp() {
    document.getElementById('splashScreen').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
}

function setupEventListeners() {
    // Install buttons
    document.getElementById('installCancelBtn').addEventListener('click', function() {
        localStorage.setItem('installPromptShown', 'true');
        document.getElementById('installPopup').classList.add('hidden');
        showMainApp();
    });
    
    document.getElementById('installConfirmBtn').addEventListener('click', function() {
        localStorage.setItem('installPromptShown', 'true');
        document.getElementById('installPopup').classList.add('hidden');
        showMainApp();
        showToast('App installed successfully!');
    });
    
    // Add medicine
    document.getElementById('addMedicine').addEventListener('click', addMedicine);
    
    // Menu buttons
    document.getElementById('menuButton').addEventListener('click', toggleMenu);
    document.getElementById('closeMenu').addEventListener('click', toggleMenu);
    document.getElementById('menuBackdrop').addEventListener('click', toggleMenu);
    
    // Language buttons
    document.getElementById('langBn').addEventListener('click', () => switchLanguage('bn'));
    document.getElementById('langEn').addEventListener('click', () => switchLanguage('en'));
    
    // Menu actions
    document.getElementById('exportData').addEventListener('click', exportData);
    document.getElementById('importData').addEventListener('click', importData);
    document.getElementById('clearAll').addEventListener('click', clearAllData);
    document.getElementById('helpLine').addEventListener('click', showHelpLine);
    document.getElementById('shareApp').addEventListener('click', shareApp);
    
    // Modal close
    document.getElementById('closeQR').addEventListener('click', () => {
        document.getElementById('qrModal').classList.add('hidden');
    });
    
    // Search
    document.getElementById('searchInput').addEventListener('input', searchMedicines);
}

function toggleMenu() {
    const menu = document.getElementById('sideMenu');
    if (menu.classList.contains('hidden')) {
        menu.classList.remove('hidden');
        setTimeout(() => {
            document.querySelector('#sideMenu > div:last-child').classList.remove('-translate-x-full');
        }, 10);
    } else {
        document.querySelector('#sideMenu > div:last-child').classList.add('-translate-x-full');
        setTimeout(() => {
            menu.classList.add('hidden');
        }, 300);
    }
}

function showMedicineForm() {
    document.getElementById('medicineForm').scrollIntoView({ behavior: 'smooth' });
    toggleMenu();
}

function switchLanguage(lang) {
    currentLanguage = lang;
    applyLanguage();
    loadMedicines(); // Reload to update language
    toggleMenu();
}

function applyLanguage() {
    const trans = translations[currentLanguage];
    
    // Update all translatable elements
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (trans[key]) {
            element.textContent = trans[key];
        }
    });
    
    // Update placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
        const key = element.getAttribute('data-i18n-placeholder');
        if (trans[key]) {
            element.placeholder = trans[key];
        }
    });
    
    // Update select options (simplified)
    const timeSelect = document.getElementById('medicineTime');
    if (timeSelect) {
        timeSelect.innerHTML = `
            <option value="Morning">${trans.morning}</option>
            <option value="Noon">${trans.noon}</option>
            <option value="Night">${trans.night}</option>
            <option value="Morning & Night">${trans.morning_night}</option>
            <option value="Morning, Noon & Night">${trans.morning_noon_night}</option>
        `;
    }
}

function addMedicine() {
    const name = document.getElementById('medicineName').value.trim();
    const time = document.getElementById('medicineTime').value;
    const startDate = document.getElementById('startDate').value;
    const days = document.getElementById('medicineDays').value;
    
    if (!name || !time || !startDate || !days) {
        showToast('Please fill all fields');
        return;
    }
    
    const medicine = {
        id: Date.now(),
        name: name,
        time: time,
        startDate: startDate,
        days: parseInt(days),
        taken: false,
        createdAt: new Date().toISOString()
    };
    
    const medicines = getMedicines();
    medicines.push(medicine);
    localStorage.setItem('medicines', JSON.stringify(medicines));
    
    // Clear form
    document.getElementById('medicineName').value = '';
    document.getElementById('medicineDays').value = '';
    
    loadMedicines();
    showToast('Medicine added successfully!');
}

function getMedicines() {
    return JSON.parse(localStorage.getItem('medicines') || '[]');
}

function loadMedicines() {
    const medicines = getMedicines();
    const container = document.getElementById('medicineList');
    const trans = translations[currentLanguage];
    
    if (medicines.length === 0) {
        container.innerHTML = `
            <div class="neumorphic rounded-2xl p-6 text-center">
                <i class="fas fa-pills text-gray-400 text-4xl mb-4"></i>
                <p class="text-gray-600">No medicines added yet</p>
                <p class="text-gray-500 text-sm mt-2">Add your first medicine using the form above</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = medicines.map(medicine => `
        <div class="neumorphic rounded-2xl p-5 fade-in" data-id="${medicine.id}">
            <div class="flex justify-between items-start mb-3">
                <h3 class="text-lg font-semibold text-gray-800">${medicine.name}</h3>
                <button class="delete-btn neumorphic-btn w-8 h-8 flex items-center justify-center rounded-full text-red-500">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            
            <div class="grid grid-cols-2 gap-4 mb-4">
                <div class="flex items-center">
                    <i class="fas fa-clock text-blue-500 mr-2"></i>
                    <span class="text-gray-700">${medicine.time}</span>
                </div>
                <div class="flex items-center">
                    <i class="fas fa-calendar text-green-500 mr-2"></i>
                    <span class="text-gray-700">${medicine.days} days</span>
                </div>
                <div class="flex items-center">
                    <i class="fas fa-play-circle text-purple-500 mr-2"></i>
                    <span class="text-gray-700">${new Date(medicine.startDate).toLocaleDateString()}</span>
                </div>
                <div class="flex items-center">
                    <i class="fas fa-flag-checkered text-red-500 mr-2"></i>
                    <span class="text-gray-700">${calculateEndDate(medicine.startDate, medicine.days)}</span>
                </div>
            </div>
            
            <div class="flex justify-between items-center">
                <div class="timer">Next dose</div>
                <button class="take-btn ${medicine.taken ? 'bg-green-500 text-white' : 'neumorphic-btn text-gray-700'} px-4 py-2 rounded-xl">
                    ${medicine.taken ? '✅ ' + trans.taken : trans.take}
                </button>
            </div>
        </div>
    `).join('');
    
    // Add event listeners
    medicines.forEach(medicine => {
        const card = document.querySelector(`[data-id="${medicine.id}"]`);
        if (card) {
            card.querySelector('.take-btn').addEventListener('click', () => markAsTaken(medicine.id));
            card.querySelector('.delete-btn').addEventListener('click', () => deleteMedicine(medicine.id));
        }
    });
}

function calculateEndDate(startDate, days) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + parseInt(days) - 1);
    return date.toLocaleDateString();
}

function markAsTaken(id) {
    const medicines = getMedicines();
    const medicine = medicines.find(m => m.id === id);
    if (medicine) {
        medicine.taken = true;
        localStorage.setItem('medicines', JSON.stringify(medicines));
        loadMedicines();
        showToast('Medicine marked as taken!');
    }
}

function deleteMedicine(id) {
    if (confirm('Are you sure you want to delete this medicine?')) {
        const medicines = getMedicines().filter(m => m.id !== id);
        localStorage.setItem('medicines', JSON.stringify(medicines));
        loadMedicines();
        showToast('Medicine deleted successfully!');
    }
}

function searchMedicines() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    const cards = document.querySelectorAll('#medicineList > div');
    
    cards.forEach(card => {
        const name = card.querySelector('h3').textContent.toLowerCase();
        if (name.includes(query)) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}

function startTimers() {
    // Simple timer implementation
    setInterval(() => {
        // Timer logic can be added here
    }, 1000);
}

function exportData() {
    const medicines = getMedicines();
    const dataStr = JSON.stringify(medicines, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = 'medicine-data.json';
    link.click();
    
    showToast('Data exported successfully!');
    toggleMenu();
}

function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = e => {
        const file = e.target.files[0];
        const reader = new FileReader();
        
        reader.onload = event => {
            try {
                const medicines = JSON.parse(event.target.result);
                if (Array.isArray(medicines)) {
                    localStorage.setItem('medicines', JSON.stringify(medicines));
                    loadMedicines();
                    showToast('Data imported successfully!');
                }
            } catch (error) {
                showToast('Error importing data');
            }
        };
        
        reader.readAsText(file);
    };
    
    input.click();
    toggleMenu();
}

function clearAllData() {
    if (confirm('Are you sure you want to delete all data?')) {
        localStorage.removeItem('medicines');
        loadMedicines();
        showToast('All data cleared!');
        toggleMenu();
    }
}

function showHelpLine() {
    window.open('https://zunaidhosse.github.io/My-contact/', '_blank');
    toggleMenu();
}

function shareApp() {
    generateQRCode('https://zunaidhosse.github.io/medicine-reminder/');
    document.getElementById('qrModal').classList.remove('hidden');
    toggleMenu();
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// PWA Installation
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById('installButton').classList.remove('hidden');
    
    document.getElementById('installButton').addEventListener('click', () => {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                showToast('App installed successfully!');
            }
            deferredPrompt = null;
        });
    });
});

// Service Worker Registration
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js')
        .then(() => console.log('Service Worker Registered'))
        .catch(err => console.log('Service Worker Registration Failed'));
}