const typeSelect = document.getElementById('typeSelect');
const valueSelect = document.getElementById('valueSelect');
const timetableGrid = document.getElementById('timetable');
const loading = document.getElementById('loading');
const errorDiv = document.getElementById('error');

// Globální proměnná pro data definic
let definitions = {};

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

        renderTimetable(data);

    } catch (e) {
        showError(e.message);
    } finally {
        loading.classList.add('hidden');
    }
}

// 4. Vykreslení HTML
function renderTimetable(data) {
    const days = ['Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek'];
    
    // Vytvoříme 5 sloupců pro dny
    for (let i = 0; i < 5; i++) {
        const col = document.createElement('div');
        col.className = 'day-column';
        
        // Nadpis dne
        col.innerHTML = `<div class="day-header">${days[i]}</div>`;

        // Vyfiltrujeme hodiny pro tento den a seřadíme
        const lessons = data.filter(d => d.day === i).sort((a, b) => a.hour - b.hour);

        if (lessons.length === 0) {
            col.innerHTML += `<div style="text-align:center; color:#555; padding:20px;">Volno 🎉</div>`;
        }

        lessons.forEach(lesson => {
            const card = document.createElement('div');
            card.className = `lesson-card ${lesson.changed ? 'changed' : ''}`;
            
            card.innerHTML = `
                <div class="lesson-hour">${lesson.hour}.</div>
                <div class="lesson-subject">${lesson.subject}</div>
                <div class="lesson-details">
                    <span>${lesson.teacher || ''}</span>
                    <span>${lesson.room || ''}</span>
                </div>
                ${lesson.group ? `<div style="font-size:0.7rem; color:#888; margin-top:4px;">${lesson.group}</div>` : ''}
            `;
            col.appendChild(card);
        });

        timetableGrid.appendChild(col);
    }
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