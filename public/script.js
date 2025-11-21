const typeButtons = document.querySelectorAll('.type-btn');
const scheduleTypeButtons = document.querySelectorAll('.schedule-type-btn');
const valueSelect = document.getElementById('valueSelect');
const groupSelect = document.getElementById('groupSelect');
const timetableGrid = document.getElementById('timetable');
const loading = document.getElementById('loading');
const errorDiv = document.getElementById('error');
const daySelector = document.getElementById('daySelector');
const themeToggle = document.getElementById('themeToggle');

// Globální proměnná pro data definic
let definitions = {};
let currentTimetableData = [];
let selectedDayIndex = null;
let selectedType = 'Class'; // Default type
let selectedScheduleType = 'actual'; // Default schedule type
let selectedGroup = 'all'; // Default group (all)

// Subject name abbreviations
const subjectAbbreviations = {
    'Informační a komunikační technologie': 'IKT',
    'Elektrická měření': 'Elektr. měření',
    'Programové vybavení': 'Prog. vybavení',
    'Ekonomika': 'Ekonomika',
    'Tělesná výchova': 'TV',
    'Matematika': 'Matematika',
    'Anglický jazyk': 'Angličtina',
    'Český jazyk a literatura': 'Čeština',
    'Databázové systémy': 'Databáze',
    'CAD systémy': 'CAD',
    'Programování': 'Programování',
    'Hardware': 'Hardware',
    'Grafická tvorba': 'Grafika',
    'Kybernetická bezpečnost': 'Kyberbezpečnost',
    'Datové sítě': 'Datové sítě',
    'Praxe': 'Praxe'
};

// Function to abbreviate subject names
function abbreviateSubject(subjectName) {
    if (!subjectName) return '';

    // Check if there's a direct mapping
    if (subjectAbbreviations[subjectName]) {
        return subjectAbbreviations[subjectName];
    }

    // If subject name is longer than 20 characters, try to shorten it
    if (subjectName.length > 20) {
        // Try to extract acronym from capital letters
        const capitals = subjectName.match(/[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/g);
        if (capitals && capitals.length > 1) {
            return capitals.join('');
        }
        // Otherwise truncate with ellipsis
        return subjectName.substring(0, 18) + '...';
    }

    return subjectName;
}

// Function to standardize group names
function standardizeGroupName(groupName) {
    if (!groupName) return '';

    // Convert to lowercase for easier matching
    const lower = groupName.toLowerCase().trim();

    // If it contains "celá", keep as "celá"
    if (lower.includes('celá') || lower === 'cela') {
        return 'celá';
    }

    // Match patterns like "1. skupina", "1.skupina", "1 skupina", "skupina 1", etc.
    const groupMatch = lower.match(/(\d+)[\.\s]*(?:skupina|sk)?|(?:skupina|sk)[\.\s]*(\d+)/);
    if (groupMatch) {
        const groupNum = groupMatch[1] || groupMatch[2];
        return `${groupNum}.sk`;
    }

    // If the group name already contains ".sk", extract just the number part
    if (lower.includes('.sk')) {
        const numMatch = lower.match(/(\d+)\.sk/);
        if (numMatch) {
            return `${numMatch[1]}.sk`;
        }
    }

    // Return as-is if no pattern matches
    return groupName;
}

// Theme management
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    
    const sunIcon = themeToggle.querySelector('.sun-icon');
    const moonIcon = themeToggle.querySelector('.moon-icon');
    
    if (theme === 'light') {
        sunIcon.style.display = 'none';
        moonIcon.style.display = 'block';
    } else {
        sunIcon.style.display = 'block';
        moonIcon.style.display = 'none';
    }
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
}

themeToggle.addEventListener('click', toggleTheme);

// Type button handlers
function updateTypeButtons() {
    typeButtons.forEach(btn => {
        if (btn.dataset.type === selectedType) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

typeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        selectedType = btn.dataset.type;
        updateTypeButtons();
        populateValueSelect();

        // Reset and hide group selector when changing type
        selectedGroup = 'all';
        groupSelect.classList.add('hidden');
        groupSelect.disabled = true;

        loadTimetable();
    });
});

// Schedule type button handlers (Stálý/Aktuální)
function updateScheduleTypeButtons() {
    scheduleTypeButtons.forEach(btn => {
        if (btn.dataset.schedule === selectedScheduleType) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

scheduleTypeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        selectedScheduleType = btn.dataset.schedule;
        updateScheduleTypeButtons();
        loadTimetable();
    });
});

// Group selector handler
groupSelect.addEventListener('change', () => {
    selectedGroup = groupSelect.value;
    timetableGrid.innerHTML = ''; // Clear the grid before re-rendering
    renderTimetable(currentTimetableData);
});

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
    try {
        // Načíst seznamy tříd/učitelů
        const res = await fetch('/api/definitions');
        definitions = await res.json();
        
        // Naplnit druhý select podle toho, co je vybráno v prvním
        populateValueSelect();

        // Obnovit uložený výběr z minula (LocalStorage)
        const savedType = localStorage.getItem('selectedType');
        const savedValue = localStorage.getItem('selectedValue');

        if (savedType && savedValue) {
            selectedType = savedType;
            updateTypeButtons();
            populateValueSelect(); // Překreslit možnosti
            valueSelect.value = savedValue;
            loadTimetable(); // Načíst rozvrh
        } else {
            // Defaultně zkusíme vybrat třídu ZL (4.L) pokud existuje
            selectedType = 'Class';
            updateTypeButtons();
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
    let data = [];

    if (selectedType === 'Class') data = definitions.classes;
    else if (selectedType === 'Teacher') data = definitions.teachers;
    else if (selectedType === 'Room') data = definitions.rooms;

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
    const id = valueSelect.value;

    if (!id) return;

    // Uložit do paměti pro příště
    localStorage.setItem('selectedType', selectedType);
    localStorage.setItem('selectedValue', id);

    loading.classList.remove('hidden');
    errorDiv.classList.add('hidden');
    timetableGrid.innerHTML = '';

    try {
        const res = await fetch(`/api/timetable?type=${selectedType}&id=${id}&schedule=${selectedScheduleType}`);
        if (!res.ok) throw new Error("Chyba serveru");

        const data = await res.json();

        if (data.error) {
            throw new Error(data.error);
        }

        currentTimetableData = data;
        populateGroupSelector(data);
        createDaySelector();
        renderTimetable(data);

    } catch (e) {
        showError(e.message);
    } finally {
        loading.classList.add('hidden');
    }
}

// Populate group selector from timetable data
function populateGroupSelector(data) {
    // Only show group selector for Class type
    if (selectedType !== 'Class') {
        groupSelect.classList.add('hidden');
        groupSelect.disabled = true;
        selectedGroup = 'all';
        return;
    }

    // Extract unique groups from the data
    const groups = new Set();
    data.forEach(lesson => {
        if (lesson.group) {
            groups.add(lesson.group);
        }
    });

    // If there are groups, show the selector
    if (groups.size > 0) {
        groupSelect.classList.remove('hidden');
        groupSelect.disabled = false;

        // Clear and repopulate
        groupSelect.innerHTML = '<option value="all">Celá třída</option>';

        // Sort groups and standardize names
        const sortedGroups = Array.from(groups).sort();
        sortedGroups.forEach(group => {
            const opt = document.createElement('option');
            opt.value = group;
            opt.textContent = standardizeGroupName(group);
            groupSelect.appendChild(opt);
        });

        // Restore selected group if it exists, otherwise reset to 'all'
        if (sortedGroups.includes(selectedGroup)) {
            groupSelect.value = selectedGroup;
        } else {
            selectedGroup = 'all';
            groupSelect.value = 'all';
        }
    } else {
        groupSelect.classList.add('hidden');
        groupSelect.disabled = true;
        selectedGroup = 'all';
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
            let lessons = data.filter(d => d.day === dayIndex && d.hour === hour);

            // Filter by selected group
            if (selectedGroup !== 'all') {
                lessons = lessons.filter(d => d.group === selectedGroup || !d.group);
            }

            lessons.forEach(lesson => {
                const card = document.createElement('div');
                let cardClass = 'lesson-card';
                if (lesson.changed) cardClass += ' changed';

                // Zvýraznění aktuální hodiny
                if (dayIndex === todayIndex && hour === currentHour) {
                    cardClass += ' current-time';
                }
                card.className = cardClass;

                const displaySubject = abbreviateSubject(lesson.subject);
                const displayGroup = standardizeGroupName(lesson.group);
                card.innerHTML = `
                    <div class="lesson-subject" title="${lesson.subject}">${displaySubject}</div>
                    <div class="lesson-details">
                        ${lesson.teacher ? `<span>${lesson.teacher}</span>` : ''}
                        ${lesson.room ? `<span>${lesson.room}</span>` : ''}
                    </div>
                    ${lesson.group ? `<div class="lesson-group">${displayGroup}</div>` : ''}
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
valueSelect.addEventListener('change', loadTimetable);

// Start!
initTheme();
init();