const timetableGrid = document.getElementById('timetable');
const loading = document.getElementById('loading');
const errorDiv = document.getElementById('error');
const daySelector = document.getElementById('daySelector');
const themeToggle = document.getElementById('themeToggle');

// Type Buttons
const typeButtons = document.getElementById('typeButtons');

// Value Select (Custom Dropdown)
const valueSelectWrapper = document.getElementById('valueSelectWrapper');
const valueTrigger = document.getElementById('valueTrigger');
const valueOptions = document.getElementById('valueOptions');

// Globální proměnná pro data definic
let definitions = {};
let currentTimetableData = [];
let selectedDayIndex = null;
let selectedType = 'Class';
let selectedValue = null;

// Theme Management
function updateLogo(theme) {
    const headerLogo = document.getElementById('headerLogo');
    if (headerLogo) {
        headerLogo.src = theme === 'dark' ? 'spsd_logo_white.png' : 'spsd_logo.png';
    }
}

function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateLogo(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateLogo(newTheme);
}

// Initialize theme on load
initTheme();

// Theme toggle event listener
if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
}

// Custom Select Functions
function toggleSelect(selectWrapper) {
    const isOpen = selectWrapper.classList.contains('open');
    // Close all selects
    document.querySelectorAll('.custom-select').forEach(sel => sel.classList.remove('open'));
    // Toggle current select
    if (!isOpen) {
        selectWrapper.classList.add('open');
    }
}

function selectOption(selectWrapper, trigger, optionsContainer, value, text) {
    // Update trigger text
    trigger.querySelector('.select-value').textContent = text;

    // Update active state
    optionsContainer.querySelectorAll('.select-option').forEach(opt => {
        opt.classList.remove('active');
        if (opt.dataset.value === value) {
            opt.classList.add('active');
        }
    });

    // Close dropdown
    selectWrapper.classList.remove('open');
}

// Type Buttons Event Listener
typeButtons.addEventListener('click', (e) => {
    if (e.target.classList.contains('type-btn')) {
        // Remove active class from all buttons
        typeButtons.querySelectorAll('.type-btn').forEach(btn => btn.classList.remove('active'));
        // Add active class to clicked button
        e.target.classList.add('active');
        // Update selected type
        selectedType = e.target.dataset.value;
        // Reload value options and timetable
        populateValueSelect();
        loadTimetable();
    }
});

// Value Select Event Listeners
valueTrigger.addEventListener('click', () => toggleSelect(valueSelectWrapper));

valueOptions.addEventListener('click', (e) => {
    if (e.target.classList.contains('select-option')) {
        const value = e.target.dataset.value;
        const text = e.target.textContent;
        selectedValue = value;
        selectOption(valueSelectWrapper, valueTrigger, valueOptions, value, text);
        loadTimetable();
    }
});

// Close dropdowns when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.custom-select')) {
        document.querySelectorAll('.custom-select').forEach(sel => sel.classList.remove('open'));
    }
});

// Check authentication
async function checkAuth() {
    try {
        const response = await fetch('/api/auth/check');
        if (!response.ok) {
            // Not authenticated, redirect to login
            window.location.href = '/login.html';
            return false;
        }
        const data = await response.json();
        updateUserInfo(data.username);
        return true;
    } catch (error) {
        window.location.href = '/login.html';
        return false;
    }
}

// Update user info in header
function updateUserInfo(username) {
    const userInfo = document.getElementById('userInfo');
    if (userInfo) {
        userInfo.textContent = username;
    }
}

// Logout function
async function logout() {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/login.html';
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// Utility funkce pro získání dnešního dne (0-4 = Po-Pá)
function getTodayIndex() {
    const day = new Date().getDay(); // 0=Neděle, 1=Po, ..., 5=Pá
    return day === 0 || day === 6 ? -1 : day - 1; // Vrátí -1 pro víkend
}

// Časová rozmezí hodin
const lessonTimes = [
    { hour: 0, start: [7, 10], end: [7, 55], label: '7:10-7:55' },
    { hour: 1, start: [8, 0], end: [8, 45], label: '8:00-8:45' },
    { hour: 2, start: [8, 50], end: [9, 35], label: '8:50-9:35' },
    { hour: 3, start: [9, 45], end: [10, 30], label: '9:45-10:30' },
    { hour: 4, start: [10, 50], end: [11, 35], label: '10:50-11:35' },
    { hour: 5, start: [11, 40], end: [12, 25], label: '11:40-12:25' },
    { hour: 6, start: [12, 35], end: [13, 20], label: '12:35-13:20' },
    { hour: 7, start: [13, 25], end: [14, 10], label: '13:25-14:10' },
    { hour: 8, start: [14, 20], end: [15, 5], label: '14:20-15:05' },
    { hour: 9, start: [15, 10], end: [15, 55], label: '15:10-15:55' },
    { hour: 10, start: [16, 0], end: [16, 45], label: '16:00-16:45' },
    { hour: 11, start: [16, 50], end: [17, 35], label: '16:50-17:35' },
    { hour: 12, start: [17, 40], end: [18, 25], label: '17:40-18:25' }
];

// Utility funkce pro získání aktuální hodiny (0-12)
function getCurrentHour() {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();

    for (const lesson of lessonTimes) {
        const [startH, startM] = lesson.start;
        const [endH, endM] = lesson.end;
        if ((hour > startH || (hour === startH && minute >= startM)) &&
            (hour < endH || (hour === endH && minute <= endM))) {
            return lesson.hour;
        }
    }
    return -1; // Mimo vyučování
}

// 1. Start aplikace
async function init() {
    // Check authentication first
    const isAuthenticated = await checkAuth();
    if (!isAuthenticated) {
        return;
    }

    try {
        // Načíst seznamy tříd/učitelů
        const res = await fetch('/api/definitions');
        if (!res.ok) {
            throw new Error('Unauthorized');
        }
        definitions = await res.json();
        console.log('Definitions loaded:', definitions);
        if (definitions.debug) {
            console.log('DEBUG INFO:', JSON.stringify(definitions.debug, null, 2));
            // Remove debug from definitions
            delete definitions.debug;
        }

        // Naplnit druhý select podle toho, co je vybráno v prvním
        populateValueSelect();

        // Obnovit uložený výběr z minula (LocalStorage)
        const savedType = localStorage.getItem('selectedType');
        const savedValue = localStorage.getItem('selectedValue');

        if (savedType && savedValue) {
            selectedType = savedType;
            selectedValue = savedValue;

            // Update type buttons
            typeButtons.querySelectorAll('.type-btn').forEach(btn => {
                btn.classList.remove('active');
                if (btn.dataset.value === savedType) {
                    btn.classList.add('active');
                }
            });

            populateValueSelect();

            // Update value select after population
            setTimeout(() => {
                const valueOption = valueOptions.querySelector(`[data-value="${savedValue}"]`);
                if (valueOption) {
                    selectOption(valueSelectWrapper, valueTrigger, valueOptions, savedValue, valueOption.textContent);
                }
                loadTimetable();
            }, 100);
        } else {
            // Defaultně zkusíme vybrat třídu ZL (4.L) pokud existuje
            selectedType = 'Class';
            populateValueSelect();

            setTimeout(() => {
                selectedValue = 'ZL';
                const valueOption = valueOptions.querySelector('[data-value="ZL"]');
                if (valueOption) {
                    selectOption(valueSelectWrapper, valueTrigger, valueOptions, 'ZL', valueOption.textContent);
                }
                loadTimetable();
            }, 100);
        }

    } catch (e) {
        showError("Nepodařilo se načíst seznamy. Běží backend?");
    }
}

// 2. Naplnění selectboxu podle typu
function populateValueSelect() {
    console.log('populateValueSelect called', { selectedType, definitions });
    let data = [];

    if (selectedType === 'Class') data = definitions.classes || [];
    else if (selectedType === 'Teacher') data = definitions.teachers || [];
    else if (selectedType === 'Room') data = definitions.rooms || [];

    console.log('Data for populate:', data);

    valueOptions.innerHTML = '';

    if (!data || data.length === 0) {
        console.log('No data to populate');
        const selectValue = valueTrigger.querySelector('.select-value');
        if (selectValue) {
            selectValue.textContent = '-- Žádná data --';
            selectValue.style.opacity = '0.6';
            selectValue.style.fontStyle = 'italic';
        }
        selectedValue = null;
        return;
    }

    // Seřadíme abecedně
    data.sort((a, b) => a.name.localeCompare(b.name));

    data.forEach((item, index) => {
        const opt = document.createElement('div');
        opt.className = 'select-option';
        if (index === 0) {
            opt.classList.add('active');
        }
        opt.dataset.value = item.id;
        opt.textContent = item.name;
        valueOptions.appendChild(opt);
    });

    // Reset trigger text and selected value
    if (data.length > 0) {
        valueTrigger.querySelector('.select-value').textContent = data[0].name;
        selectedValue = data[0].id;
    } else {
        valueTrigger.querySelector('.select-value').textContent = 'Vyberte...';
        selectedValue = null;
    }
}

// 3. Načtení a vykreslení rozvrhu
async function loadTimetable() {
    console.log('loadTimetable called', { selectedType, selectedValue });

    if (!selectedValue) {
        console.log('No selectedValue, returning');
        return;
    }

    // Uložit do paměti pro příště
    localStorage.setItem('selectedType', selectedType);
    localStorage.setItem('selectedValue', selectedValue);

    loading.classList.remove('hidden');
    errorDiv.classList.add('hidden');
    timetableGrid.innerHTML = '';

    try {
        const res = await fetch(`/api/timetable?type=${selectedType}&id=${selectedValue}`);
        if (!res.ok) throw new Error("Chyba serveru");

        const data = await res.json();

        if (data.error) {
            throw new Error(data.error);
        }

        currentTimetableData = data;
        createDaySelector();
        renderTimetable(data);

    } catch (e) {
        showError(e.message);
    } finally {
        loading.classList.add('hidden');
    }
}

// Vytvoření day selectoru pro mobily
function createDaySelector() {
    const days = ['Po', 'Út', 'St', 'Čt', 'Pá'];
    const todayIndex = getTodayIndex();

    // Výchozí vybraný den je dnes, nebo pondělí pokud je víkend
    if (selectedDayIndex === null) {
        selectedDayIndex = todayIndex >= 0 ? todayIndex : 0;
    }

    daySelector.innerHTML = '';

    days.forEach((day, index) => {
        const btn = document.createElement('button');
        btn.textContent = day;
        btn.className = index === selectedDayIndex ? 'active' : '';
        if (index === todayIndex) {
            btn.classList.add('today-btn');
        }
        btn.addEventListener('click', () => selectDay(index));
        daySelector.appendChild(btn);
    });
}

// Výběr dne na mobilu
function selectDay(index) {
    selectedDayIndex = index;
    createDaySelector(); // Re-render buttons
    updateMobileDayView();
}

// Aktualizace viditelnosti dnů na mobilu
function updateMobileDayView() {
    // V gridu máme: 1 corner cell + 12 header cells = 13 cells v první řadě
    // Pak pro každý den: 1 day cell + 12 lesson cells = 13 cells per row

    const allCells = timetableGrid.children;
    const headerCount = 13; // corner + 12 hour headers

    // Projdeme každý den (5 dnů)
    for (let day = 0; day < 5; day++) {
        const startIdx = headerCount + (day * 13); // day cell + 12 lessons
        const endIdx = startIdx + 13; // 1 day cell + 12 lesson cells

        for (let i = startIdx; i < endIdx && i < allCells.length; i++) {
            if (day === selectedDayIndex) {
                allCells[i].classList.add('active');
            } else {
                allCells[i].classList.remove('active');
            }
        }
    }
}

// 4. Vykreslení HTML - Pevný grid 12 hodin × 5 dnů
function renderTimetable(data) {
    console.log('renderTimetable called with data:', data);
    const days = ['Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek'];
    const todayIndex = getTodayIndex();
    const currentHour = getCurrentHour();

    // První buňka - prázdná (roh)
    const cornerCell = document.createElement('div');
    cornerCell.className = 'timetable-header-cell';
    cornerCell.textContent = '';
    timetableGrid.appendChild(cornerCell);

    // Hlavičky pro hodiny 0-11
    for (let hour = 0; hour < 12; hour++) {
        const headerCell = document.createElement('div');
        headerCell.className = 'timetable-header-cell';

        const timeInfo = lessonTimes.find(t => t.hour === hour);
        headerCell.innerHTML = `
            <div style="font-size: 0.9rem; font-weight: 700;">${hour}.</div>
            <div style="font-size: 0.7rem; font-weight: 400; margin-top: 4px; opacity: 0.7;">${timeInfo ? timeInfo.label : ''}</div>
        `;

        timetableGrid.appendChild(headerCell);
    }

    // Vytvoříme buňky pro každý den (5 dnů)
    days.forEach((day, dayIndex) => {
        // První buňka řádku - název dne
        const dayCell = document.createElement('div');
        dayCell.className = 'day-cell';
        if (dayIndex === todayIndex) {
            dayCell.classList.add('today');
        }
        dayCell.innerHTML = `
            <div style="font-weight: 700;">${day}</div>
            ${dayIndex === todayIndex ? '<div class="today-badge" style="margin-top: 4px;">DNES</div>' : ''}
        `;
        timetableGrid.appendChild(dayCell);

        // Buňky pro jednotlivé hodiny (12 hodin)
        for (let hour = 0; hour < 12; hour++) {
            const lessonCell = document.createElement('div');
            lessonCell.className = 'lesson-cell';

            if (dayIndex === todayIndex) {
                lessonCell.classList.add('today');
            }

            if (dayIndex === todayIndex && hour === currentHour) {
                lessonCell.classList.add('current-hour');
            }

            // Najdeme všechny hodiny pro tento den a hodinu
            const lessons = data.filter(d => d.day === dayIndex && d.hour === hour);

            lessons.forEach(lesson => {
                const card = document.createElement('div');
                let cardClass = 'lesson-card';
                if (lesson.changed) cardClass += ' changed';
                card.className = cardClass;

                card.innerHTML = `
                    <div class="lesson-subject">${lesson.subject}</div>
                    <div class="lesson-details">
                        ${lesson.teacher ? `<span>${lesson.teacher}</span>` : ''}
                        ${lesson.room ? `<span>${lesson.room}</span>` : ''}
                    </div>
                    ${lesson.group ? `<div class="lesson-group">${lesson.group}</div>` : ''}
                `;
                lessonCell.appendChild(card);
            });

            timetableGrid.appendChild(lessonCell);
        }
    });

    // Aktualizovat viditelnost dnů na mobilu
    updateMobileDayView();
}

function showError(msg) {
    errorDiv.textContent = msg;
    errorDiv.classList.remove('hidden');
    loading.classList.add('hidden');
}

// Start!
init();