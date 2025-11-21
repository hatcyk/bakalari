const typeSelect = document.getElementById('typeSelect');
const valueSelect = document.getElementById('valueSelect');
const timetableGrid = document.getElementById('timetable');
const loading = document.getElementById('loading');
const errorDiv = document.getElementById('error');
const daySelector = document.getElementById('daySelector');

// Globální proměnná pro data definic
let definitions = {};
let currentTimetableData = [];
let selectedDayIndex = null;

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
        
        // Naplnit druhý select podle toho, co je vybráno v prvním
        populateValueSelect();

        // Obnovit uložený výběr z minula (LocalStorage)
        const savedType = localStorage.getItem('selectedType');
        const savedValue = localStorage.getItem('selectedValue');

        if (savedType && savedValue) {
            typeSelect.value = savedType;
            populateValueSelect(); // Překreslit možnosti
            valueSelect.value = savedValue;
            loadTimetable(); // Načíst rozvrh
        } else {
            // Defaultně zkusíme vybrat třídu ZL (4.L) pokud existuje
            typeSelect.value = 'Class';
            populateValueSelect();
            valueSelect.value = 'ZL'; 
            loadTimetable();
        }

    } catch (e) {
        showError("Nepodařilo se načíst seznamy. Běží backend?");
    }
}

// 2. Naplnění selectboxu podle typu
function populateValueSelect() {
    const type = typeSelect.value; // Class, Teacher, Room
    let data = [];

    if (type === 'Class') data = definitions.classes;
    else if (type === 'Teacher') data = definitions.teachers;
    else if (type === 'Room') data = definitions.rooms;

    valueSelect.innerHTML = '';
    
    // Seřadíme abecedně
    data.sort((a, b) => a.name.localeCompare(b.name));

    data.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item.id;
        opt.textContent = item.name;
        valueSelect.appendChild(opt);
    });
}

// 3. Načtení a vykreslení rozvrhu
async function loadTimetable() {
    const type = typeSelect.value;
    const id = valueSelect.value;

    if (!id) return;

    // Uložit do paměti pro příště
    localStorage.setItem('selectedType', type);
    localStorage.setItem('selectedValue', id);

    loading.classList.remove('hidden');
    errorDiv.classList.add('hidden');
    timetableGrid.innerHTML = '';

    try {
        const res = await fetch(`/api/timetable?type=${type}&id=${id}`);
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
    // Na mobilu zobrazit pouze vybraný den (řádek)
    const rows = document.querySelectorAll('.timetable-row');
    rows.forEach((row, index) => {
        if (index === selectedDayIndex) {
            row.classList.add('active');
        } else {
            row.classList.remove('active');
        }
    });
}

// 4. Vykreslení HTML
function renderTimetable(data) {
    const days = ['Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek'];
    const todayIndex = getTodayIndex();
    const currentHour = getCurrentHour();

    // Zjistíme všechny hodiny, které se vyskytují v rozvrhu
    const allHours = [...new Set(data.map(d => d.hour))].sort((a, b) => a - b);
    const maxHour = Math.max(...allHours, 0);

    // Vytvoříme hlavičku tabulky s hodinami
    const headerRow = document.createElement('div');
    headerRow.className = 'timetable-header';

    // První buňka - prázdná (roh)
    const cornerCell = document.createElement('div');
    cornerCell.className = 'timetable-header-cell';
    cornerCell.textContent = '';
    headerRow.appendChild(cornerCell);

    // Hlavičky pro hodiny
    for (let hour = 0; hour <= maxHour; hour++) {
        const headerCell = document.createElement('div');
        headerCell.className = 'timetable-header-cell';

        const timeInfo = lessonTimes.find(t => t.hour === hour);
        headerCell.innerHTML = `
            <div style="font-size: 0.85rem;">${hour}.</div>
            <div style="font-size: 0.65rem; font-weight: 400; margin-top: 2px; opacity: 0.8;">${timeInfo ? timeInfo.label : ''}</div>
        `;

        headerRow.appendChild(headerCell);
    }

    timetableGrid.appendChild(headerRow);

    // Vytvoříme řádky pro každý den
    days.forEach((day, dayIndex) => {
        const row = document.createElement('div');
        row.className = 'timetable-row';

        // Zvýraznění dnešního řádku
        if (dayIndex === todayIndex) {
            row.classList.add('today-row');
        }

        // První buňka - název dne
        const dayCell = document.createElement('div');
        dayCell.className = 'hour-cell';
        dayCell.innerHTML = `
            <div style="font-weight: 700;">${day}</div>
            ${dayIndex === todayIndex ? '<div class="today-badge" style="margin-top: 4px;">DNES</div>' : ''}
        `;
        row.appendChild(dayCell);

        // Buňky pro jednotlivé hodiny
        for (let hour = 0; hour <= maxHour; hour++) {
            const lessonCell = document.createElement('div');
            lessonCell.className = 'lesson-cell';

            if (dayIndex === todayIndex) {
                lessonCell.classList.add('today');
            }

            // Najdeme všechny hodiny pro tento den a hodinu
            const lessons = data.filter(d => d.day === dayIndex && d.hour === hour);

            lessons.forEach(lesson => {
                const card = document.createElement('div');
                let cardClass = 'lesson-card';
                if (lesson.changed) cardClass += ' changed';

                // Zvýraznění aktuální hodiny
                if (dayIndex === todayIndex && hour === currentHour) {
                    cardClass += ' current-time';
                }
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

            row.appendChild(lessonCell);
        }

        timetableGrid.appendChild(row);
    });

    // Aktualizovat viditelnost dnů na mobilu
    updateMobileDayView();
}

function showError(msg) {
    errorDiv.textContent = msg;
    errorDiv.classList.remove('hidden');
    loading.classList.add('hidden');
}

// Event listenery
typeSelect.addEventListener('change', () => {
    populateValueSelect();
    loadTimetable();
});

valueSelect.addEventListener('change', loadTimetable);

// Start!
init();