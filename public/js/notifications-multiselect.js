/**
 * Notifications Multiselect Module
 * Handles the multiselect dropdown for selecting watched timetables
 */

import { state, updateState } from './state.js';
import { dom } from './dom.js';
import { saveWatchedTimetables } from './notifications-core.js';

/**
 * Populate multiselect dropdown options
 */
export function populateMultiselectOptions() {
    if (!dom.multiselectOptions) {
        console.error('❌ multiselectOptions DOM element not found');
        return;
    }

    if (!state.definitions) {
        console.error('❌ state.definitions is not defined');
        return;
    }

    console.log('✅ Populating multiselect with definitions:', {
        classes: state.definitions.classes?.length || 0,
        teachers: state.definitions.teachers?.length || 0,
        rooms: state.definitions.rooms?.length || 0
    });

    const scheduleTypes = [
        { value: 'Actual', label: 'Aktuální' },
        { value: 'Next', label: 'Příští' }
    ];

    let html = '';

    // Add Classes section
    if (state.definitions.classes && state.definitions.classes.length > 0) {
        html += '<div class="multiselect-category">Třídy</div>';

        state.definitions.classes.forEach(item => {
            scheduleTypes.forEach(schedule => {
                const id = `watch_Class_${item.id}_${schedule.value}`;
                html += `
                    <label class="multiselect-option">
                        <input type="checkbox"
                               id="${id}"
                               data-type="Class"
                               data-id="${item.id}"
                               data-name="${item.name}"
                               data-schedule-type="${schedule.value}">
                        <span>${item.name} - ${schedule.label}</span>
                    </label>
                `;
            });
        });
    }

    // Add Teachers section
    if (state.definitions.teachers && state.definitions.teachers.length > 0) {
        html += '<div class="multiselect-category">Učitelé</div>';

        state.definitions.teachers.forEach(item => {
            scheduleTypes.forEach(schedule => {
                const id = `watch_Teacher_${item.id}_${schedule.value}`;
                html += `
                    <label class="multiselect-option">
                        <input type="checkbox"
                               id="${id}"
                               data-type="Teacher"
                               data-id="${item.id}"
                               data-name="${item.name}"
                               data-schedule-type="${schedule.value}">
                        <span>${item.name} - ${schedule.label}</span>
                    </label>
                `;
            });
        });
    }

    // Add Rooms section
    if (state.definitions.rooms && state.definitions.rooms.length > 0) {
        html += '<div class="multiselect-category">Místnosti</div>';

        state.definitions.rooms.forEach(item => {
            scheduleTypes.forEach(schedule => {
                const id = `watch_Room_${item.id}_${schedule.value}`;
                html += `
                    <label class="multiselect-option">
                        <input type="checkbox"
                               id="${id}"
                               data-type="Room"
                               data-id="${item.id}"
                               data-name="${item.name}"
                               data-schedule-type="${schedule.value}">
                        <span>${item.name} - ${schedule.label}</span>
                    </label>
                `;
            });
        });
    }

    dom.multiselectOptions.innerHTML = html;

    // Add event listeners to all checkboxes
    const checkboxes = dom.multiselectOptions.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', handleMultiselectChange);
    });
}

/**
 * Handle checkbox change in multiselect
 */
async function handleMultiselectChange(event) {
    const checkbox = event.target;
    const type = checkbox.dataset.type;
    const id = checkbox.dataset.id;
    const name = checkbox.dataset.name;
    const scheduleType = checkbox.dataset.scheduleType;

    const timetableEntry = { type, id, name, scheduleType };

    let watchedTimetables = [...state.watchedTimetables];

    if (checkbox.checked) {
        // Add to watched list
        const exists = watchedTimetables.some(t =>
            t.type === type && t.id === id && t.scheduleType === scheduleType
        );

        if (!exists) {
            watchedTimetables.push(timetableEntry);
        }
    } else {
        // Remove from watched list
        watchedTimetables = watchedTimetables.filter(t =>
            !(t.type === type && t.id === id && t.scheduleType === scheduleType)
        );
    }

    // Update state immediately for UI responsiveness
    updateState('watchedTimetables', watchedTimetables);
    updateMultiselectLabel();

    // Notify modal to update button state
    window.dispatchEvent(new CustomEvent('watchedTimetablesChanged'));

    // Save to server
    try {
        await saveWatchedTimetables(watchedTimetables);
        console.log('Watched timetables updated:', watchedTimetables);
    } catch (error) {
        console.error('Failed to save watched timetables:', error);
        // Revert checkbox state on error
        checkbox.checked = !checkbox.checked;
        // Revert state
        if (checkbox.checked) {
            watchedTimetables = watchedTimetables.filter(t =>
                !(t.type === type && t.id === id && t.scheduleType === scheduleType)
            );
        } else {
            watchedTimetables.push(timetableEntry);
        }
        updateState('watchedTimetables', watchedTimetables);
        updateMultiselectLabel();
    }
}

/**
 * Update multiselect label based on selected items
 */
export function updateMultiselectLabel() {
    if (!dom.multiselectLabel) return;

    const count = state.watchedTimetables.length;

    if (count === 0) {
        dom.multiselectLabel.textContent = 'Vyberte rozvrhy...';
    } else if (count === 1) {
        const item = state.watchedTimetables[0];
        dom.multiselectLabel.textContent = `${item.name} - ${item.scheduleType}`;
    } else {
        dom.multiselectLabel.textContent = `${count} rozvrhů vybráno`;
    }
}

/**
 * Update checkboxes based on state
 */
export function updateMultiselectCheckboxes() {
    if (!dom.multiselectOptions) return;

    const checkboxes = dom.multiselectOptions.querySelectorAll('input[type="checkbox"]');

    checkboxes.forEach(checkbox => {
        const type = checkbox.dataset.type;
        const id = checkbox.dataset.id;
        const scheduleType = checkbox.dataset.scheduleType;

        const isWatched = state.watchedTimetables.some(watched =>
            watched.type === type &&
            watched.id === id &&
            watched.scheduleType === scheduleType
        );

        checkbox.checked = isWatched;
    });
}

/**
 * Toggle multiselect dropdown
 */
export function toggleMultiselect() {
    if (!dom.multiselectTrigger || !dom.multiselectMenu) return;

    const isActive = dom.multiselectMenu.classList.contains('active');

    if (isActive) {
        closeMultiselect();
    } else {
        openMultiselect();
    }
}

/**
 * Open multiselect dropdown
 */
function openMultiselect() {
    if (!dom.multiselectTrigger || !dom.multiselectMenu) return;

    dom.multiselectTrigger.classList.add('active');
    dom.multiselectMenu.classList.add('active');

    // Focus search input
    if (dom.multiselectSearch) {
        setTimeout(() => dom.multiselectSearch.focus(), 100);
    }
}

/**
 * Close multiselect dropdown
 */
function closeMultiselect() {
    if (!dom.multiselectTrigger || !dom.multiselectMenu) return;

    dom.multiselectTrigger.classList.remove('active');
    dom.multiselectMenu.classList.remove('active');

    // Clear search
    if (dom.multiselectSearch) {
        dom.multiselectSearch.value = '';
        filterMultiselectOptions('');
    }
}

/**
 * Filter multiselect options based on search
 */
export function filterMultiselectOptions(searchTerm) {
    if (!dom.multiselectOptions) return;

    const options = dom.multiselectOptions.querySelectorAll('.multiselect-option');
    const categories = dom.multiselectOptions.querySelectorAll('.multiselect-category');
    const term = searchTerm.toLowerCase();

    options.forEach(option => {
        const label = option.querySelector('span').textContent.toLowerCase();
        if (label.includes(term)) {
            option.style.display = 'flex';
        } else {
            option.style.display = 'none';
        }
    });

    // Hide categories if all options are hidden
    categories.forEach(category => {
        let nextElement = category.nextElementSibling;
        let hasVisibleOptions = false;

        while (nextElement && !nextElement.classList.contains('multiselect-category')) {
            if (nextElement.style.display !== 'none') {
                hasVisibleOptions = true;
                break;
            }
            nextElement = nextElement.nextElementSibling;
        }

        category.style.display = hasVisibleOptions ? 'block' : 'none';
    });
}
