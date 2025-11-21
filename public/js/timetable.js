import { dom } from './dom.js';
import { state, updateState } from './state.js';
import { days, daysShort, lessonTimes } from './constants.js';
import {
    abbreviateSubject,
    abbreviateTeacherName,
    standardizeGroupName,
    getTodayIndex,
    getCurrentHour,
    parseGroupName
} from './utils.js';
import { showLessonModal } from './modal.js';
import { fetchTimetable } from './api.js';
import { getMondayOfWeek } from './utils.js';
import { populateDropdown, getDropdownValue } from './dropdown.js';

// Populate value selector
export function populateValueSelect() {
    let data = [];

    if (state.selectedType === 'Class') data = state.definitions.classes;
    else if (state.selectedType === 'Teacher') data = state.definitions.teachers;
    else if (state.selectedType === 'Room') data = state.definitions.rooms;

    // Sort alphabetically
    data.sort((a, b) => a.name.localeCompare(b.name));

    // Convert to dropdown format and filter out empty values
    const items = data
        .filter(item => item.id && item.id.trim() !== '' && item.name && item.name.trim() !== '')
        .map(item => ({
            value: item.id,
            label: item.name
        }));

    // Populate custom dropdown
    populateDropdown(items);
}

// Populate group selector
export function populateGroupSelector(data) {
    if (!dom.groupSelect) return;

    // Only show group selector for Class type
    if (state.selectedType !== 'Class') {
        dom.groupSelect.classList.add('hidden');
        updateState('selectedGroup', 'all');
        return;
    }

    // Get the currently selected class ID
    const currentClassId = getDropdownValue();
    if (!currentClassId) {
        dom.groupSelect.classList.add('hidden');
        return;
    }

    // Extract unique groups for the CURRENT CLASS only
    const groupsForClass = new Set();
    data.forEach(lesson => {
        if (lesson.group) {
            const parsed = parseGroupName(lesson.group);
            if (parsed && parsed.classId === currentClassId) {
                // Store the full group name as value, display name for text
                groupsForClass.add(lesson.group);
            }
        }
    });

    // If there are groups for this class, show the selector
    if (groupsForClass.size > 0) {
        dom.groupSelect.classList.remove('hidden');

        // Clear and repopulate with buttons
        dom.groupSelect.innerHTML = '';

        // Sort groups by group number
        const sortedGroups = Array.from(groupsForClass).sort((a, b) => {
            const parsedA = parseGroupName(a);
            const parsedB = parseGroupName(b);
            if (parsedA && parsedB) {
                return parsedA.groupName.localeCompare(parsedB.groupName);
            }
            return 0;
        });

        // Add "Celá třída" button
        const allBtn = document.createElement('button');
        allBtn.className = 'group-btn';
        allBtn.textContent = 'Celá třída';
        allBtn.dataset.group = 'all';
        if (state.selectedGroup === 'all') {
            allBtn.classList.add('active');
        }
        dom.groupSelect.appendChild(allBtn);

        // Add group buttons
        sortedGroups.forEach(group => {
            const btn = document.createElement('button');
            btn.className = 'group-btn';
            btn.dataset.group = group;
            const parsed = parseGroupName(group);
            btn.textContent = parsed ? standardizeGroupName(parsed.groupName) : group;
            if (state.selectedGroup === group) {
                btn.classList.add('active');
            }
            dom.groupSelect.appendChild(btn);
        });

        // Restore selected group if it exists, otherwise reset to 'all'
        if (!sortedGroups.includes(state.selectedGroup) && state.selectedGroup !== 'all') {
            updateState('selectedGroup', 'all');
            // Update active button state to reflect the reset
            dom.groupSelect.querySelectorAll('.group-btn').forEach(btn => {
                if (btn.dataset.group === 'all') {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        }
    } else {
        dom.groupSelect.classList.add('hidden');
        updateState('selectedGroup', 'all');
    }
}

// Create day selector for mobile
export function createDaySelector() {
    if (!dom.daySelector) return;

    const todayIndex = getTodayIndex();

    // Výchozí vybraný den je dnes, nebo pondělí pokud je víkend
    if (state.selectedDayIndex === null) {
        updateState('selectedDayIndex', todayIndex >= 0 ? todayIndex : 0);
    }

    dom.daySelector.innerHTML = '';

    daysShort.forEach((day, index) => {
        const btn = document.createElement('button');
        btn.textContent = day;
        btn.className = index === state.selectedDayIndex ? 'active' : '';
        if (index === todayIndex) {
            btn.classList.add('today-btn');
        }
        btn.addEventListener('click', () => selectDay(index));
        dom.daySelector.appendChild(btn);
    });
}

// Select day on mobile
function selectDay(index) {
    updateState('selectedDayIndex', index);
    createDaySelector();
    updateMobileDayView();
}

// Update mobile day view
function updateMobileDayView() {
    const rows = document.querySelectorAll('.timetable-row');
    rows.forEach((row, index) => {
        if (index === state.selectedDayIndex) {
            row.classList.add('active');
        } else {
            row.classList.remove('active');
        }
    });
}

// Render timetable
export function renderTimetable(data) {
    if (!dom.timetableGrid) return;

    const todayIndex = getTodayIndex();
    const currentHour = getCurrentHour();

    // Zjistíme všechny hodiny, které se vyskytují v rozvrhu
    const allHours = [...new Set(data.map(d => d.hour))].sort((a, b) => a - b);
    const maxHour = Math.max(...allHours, -1);

    // Check if timetable is completely empty (no lessons at all)
    const isCompletelyEmpty = data.length === 0 || maxHour < 0;

    // Vytvoříme hlavičku tabulky s hodinami
    const headerRow = document.createElement('div');
    headerRow.className = 'timetable-header';

    // První buňka - prázdná (roh)
    const cornerCell = document.createElement('div');
    cornerCell.className = 'timetable-header-cell';
    cornerCell.textContent = '';
    headerRow.appendChild(cornerCell);

    // Hlavičky pro hodiny - pokud je rozvrh úplně prázdný, zobrazíme jen jeden sloupec
    if (isCompletelyEmpty) {
        const headerCell = document.createElement('div');
        headerCell.className = 'timetable-header-cell';
        const timeInfo = lessonTimes.find(t => t.hour === 0);
        headerCell.innerHTML = `
            <div style="font-size: 0.85rem;">0.</div>
            <div style="font-size: 0.65rem; font-weight: 400; margin-top: 2px; opacity: 0.8;">${timeInfo ? timeInfo.label : ''}</div>
        `;
        headerRow.appendChild(headerCell);
    } else {
        // Zobrazíme všechny hodiny
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
    }

    dom.timetableGrid.appendChild(headerRow);

    // Vytvoříme řádky pro každý den
    days.forEach((day, dayIndex) => {
        const row = document.createElement('div');
        row.className = 'timetable-row';

        // Zvýraznění dnešního řádku
        if (dayIndex === todayIndex) {
            row.classList.add('today-row');
        }

        // Check if day has any lessons
        const dayLessons = data.filter(d => d.day === dayIndex);
        const hasDayLessons = dayLessons.length > 0;

        // První buňka - název dne
        const dayCell = document.createElement('div');
        dayCell.className = 'hour-cell';
        dayCell.innerHTML = `
            <div class="day-name-container">
                <div style="font-weight: 700;">${day}</div>
                ${dayIndex === todayIndex ? '<div class="today-badge">DNES</div>' : ''}
            </div>
        `;
        row.appendChild(dayCell);

        // If no lessons for this day, show empty message
        if (!hasDayLessons && (maxHour >= 0 || isCompletelyEmpty)) {
            row.classList.add('empty-day');
            const emptyMessageCell = document.createElement('div');
            emptyMessageCell.className = 'empty-day-message';

            // Determine reason for no lessons
            let message = 'Žádná výuka';
            if (dayIndex === 5 || dayIndex === 6) {
                message = 'Víkend';
            }

            emptyMessageCell.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                <span>${message}</span>
            `;
            row.appendChild(emptyMessageCell);
        } else if (hasDayLessons) {
            // Buňky pro jednotlivé hodiny (only if there are lessons)
            for (let hour = 0; hour <= maxHour; hour++) {
                const lessonCell = document.createElement('div');
                lessonCell.className = 'lesson-cell';

                if (dayIndex === todayIndex) {
                    lessonCell.classList.add('today');
                }

                // Najdeme všechny hodiny pro tento den a hodinu
                let lessons = data.filter(d => d.day === dayIndex && d.hour === hour);

                // Filter by selected group
                if (state.selectedGroup !== 'all') {
                    lessons = lessons.filter(d => d.group === state.selectedGroup || !d.group);
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
                    const displayTeacher = abbreviateTeacherName(lesson.teacher);
                    const displayGroup = standardizeGroupName(lesson.group);
                    card.innerHTML = `
                        <div class="lesson-subject" title="${lesson.subject}">${displaySubject}</div>
                        <div class="lesson-details">
                            ${lesson.teacher ? `<span title="${lesson.teacher}">${displayTeacher}</span>` : ''}
                            ${lesson.room ? `<span>${lesson.room}</span>` : ''}
                        </div>
                        ${lesson.group ? `<div class="lesson-group">${displayGroup}</div>` : ''}
                    `;

                    // Add click event to show modal
                    card.style.cursor = 'pointer';
                    card.addEventListener('click', () => showLessonModal(lesson));

                    lessonCell.appendChild(card);
                });

                row.appendChild(lessonCell);
            }
        }

        dom.timetableGrid.appendChild(row);
    });

    // Aktualizovat viditelnost dnů na mobilu
    updateMobileDayView();
}

// Load timetable
export async function loadTimetable() {
    if (!dom.loading || !dom.errorDiv || !dom.timetableGrid) {
        console.error('Required DOM elements not found');
        return;
    }

    const id = getDropdownValue();

    if (!id) return;

    // Uložit do paměti pro příště
    localStorage.setItem('selectedType', state.selectedType);
    localStorage.setItem('selectedValue', id);

    dom.loading.classList.remove('hidden');
    dom.errorDiv.classList.add('hidden');
    dom.timetableGrid.innerHTML = '';

    try {
        // Calculate the Monday of the selected week for the API
        const monday = getMondayOfWeek(state.weekOffset);
        const dateParam = monday.toISOString().split('T')[0]; // Format: YYYY-MM-DD

        const data = await fetchTimetable(state.selectedType, id, state.selectedScheduleType, dateParam);

        updateState('currentTimetableData', data);
        populateGroupSelector(data);
        createDaySelector();
        renderTimetable(data);

    } catch (e) {
        dom.errorDiv.textContent = e.message;
        dom.errorDiv.classList.remove('hidden');
    } finally {
        dom.loading.classList.add('hidden');
    }
}
