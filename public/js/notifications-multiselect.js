/**
 * Notifications Multiselect Module
 * Handles the multiselect dropdown for selecting watched timetables
 */

import { state, updateState } from './state.js';
import { dom } from './dom.js';
import { saveWatchedTimetables } from './notifications-core.js';
import { renderSelectedTimetablesPreferences, getDefaultPreferences } from './notifications-preferences.js';
import { debug } from './debug.js';

/**
 * Populate multiselect dropdown options
 */
export function populateMultiselectOptions() {
    if (!dom.multiselectOptions) {
        debug.error('❌ multiselectOptions DOM element not found');
        return;
    }

    if (!state.definitions) {
        debug.error('❌ state.definitions is not defined');
        return;
    }

    debug.log('✅ Populating multiselect with definitions:', {
        classes: state.definitions.classes?.length || 0,
        teachers: state.definitions.teachers?.length || 0,
        rooms: state.definitions.rooms?.length || 0
    });

    let html = '';

    // Add Classes section
    if (state.definitions.classes && state.definitions.classes.length > 0) {
        html += '<div class="multiselect-category">Třídy</div>';

        state.definitions.classes.forEach(item => {
            const id = `watch_Class_${item.id}`;
            html += `
                <label class="multiselect-option">
                    <input type="checkbox"
                           id="${id}"
                           data-type="Class"
                           data-id="${item.id}"
                           data-name="${item.name}">
                    <span>${item.name}</span>
                </label>
            `;
        });
    }

    // Add Teachers section
    if (state.definitions.teachers && state.definitions.teachers.length > 0) {
        html += '<div class="multiselect-category">Učitelé</div>';

        state.definitions.teachers.forEach(item => {
            const id = `watch_Teacher_${item.id}`;
            html += `
                <label class="multiselect-option">
                    <input type="checkbox"
                           id="${id}"
                           data-type="Teacher"
                           data-id="${item.id}"
                           data-name="${item.name}">
                    <span>${item.name}</span>
                </label>
            `;
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

    let watchedTimetables = [...state.watchedTimetables];

    if (checkbox.checked) {
        // Add both Actual and Next schedules
        const scheduleTypes = ['Actual', 'Next'];

        scheduleTypes.forEach(scheduleType => {
            const exists = watchedTimetables.some(t =>
                t.type === type && t.id === id && t.scheduleType === scheduleType
            );

            if (!exists) {
                watchedTimetables.push({
                    type,
                    id,
                    name,
                    scheduleType,
                    notificationTypes: getDefaultPreferences()
                });
            }
        });
    } else {
        // Remove both Actual and Next schedules
        watchedTimetables = watchedTimetables.filter(t =>
            !(t.type === type && t.id === id)
        );
    }

    // Update state immediately for UI responsiveness
    updateState('watchedTimetables', watchedTimetables);
    updateMultiselectLabel();

    // Render preferences UI for selected timetables
    renderSelectedTimetablesPreferences();

    // Notify modal to update button state
    window.dispatchEvent(new CustomEvent('watchedTimetablesChanged'));

    // Save to server
    try {
        await saveWatchedTimetables(watchedTimetables);
        debug.log('Watched timetables updated:', watchedTimetables);
    } catch (error) {
        debug.error('Failed to save watched timetables:', error);
        // Revert checkbox state on error
        checkbox.checked = !checkbox.checked;
        // Revert to original state
        updateState('watchedTimetables', state.watchedTimetables);
        updateMultiselectLabel();
        renderSelectedTimetablesPreferences();
    }
}

/**
 * Update multiselect label based on selected items
 */
export function updateMultiselectLabel() {
    if (!dom.multiselectLabel) return;

    // Group by type and id to get unique timetables (since each has Actual and Next)
    const uniqueTimetables = new Map();
    state.watchedTimetables.forEach(t => {
        const key = `${t.type}_${t.id}`;
        if (!uniqueTimetables.has(key)) {
            uniqueTimetables.set(key, t);
        }
    });

    const count = uniqueTimetables.size;

    if (count === 0) {
        dom.multiselectLabel.textContent = 'Vyberte rozvrhy...';
    } else if (count === 1) {
        const item = Array.from(uniqueTimetables.values())[0];
        dom.multiselectLabel.textContent = item.name;
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

        // Check if both Actual and Next schedules are watched
        const hasActual = state.watchedTimetables.some(watched =>
            watched.type === type && watched.id === id && watched.scheduleType === 'Actual'
        );
        const hasNext = state.watchedTimetables.some(watched =>
            watched.type === type && watched.id === id && watched.scheduleType === 'Next'
        );

        // Checkbox is checked only if BOTH schedules are watched
        checkbox.checked = hasActual && hasNext;
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

    // Position dropdown using fixed positioning
    positionDropdown();

    // Focus search input
    if (dom.multiselectSearch) {
        setTimeout(() => dom.multiselectSearch.focus(), 100);
    }
}

/**
 * Position dropdown menu intelligently based on available space
 */
function positionDropdown() {
    if (!dom.multiselectTrigger || !dom.multiselectMenu) return;

    const triggerRect = dom.multiselectTrigger.getBoundingClientRect();
    const menuHeight = 400; // max-height from CSS
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - triggerRect.bottom;
    const spaceAbove = triggerRect.top;

    // Set width to match trigger
    dom.multiselectMenu.style.width = `${triggerRect.width}px`;

    // Decide whether to open above or below
    if (spaceBelow < menuHeight && spaceAbove > spaceBelow) {
        // Open above
        dom.multiselectMenu.style.bottom = `${viewportHeight - triggerRect.top}px`;
        dom.multiselectMenu.style.top = 'auto';
    } else {
        // Open below (default)
        dom.multiselectMenu.style.top = `${triggerRect.bottom}px`;
        dom.multiselectMenu.style.bottom = 'auto';
    }

    // Set horizontal position
    dom.multiselectMenu.style.left = `${triggerRect.left}px`;
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
 * Setup global event listeners for dropdown
 */
export function setupMultiselectGlobalListeners() {
    // Close on click outside
    document.addEventListener('click', (event) => {
        if (!dom.multiselectTrigger || !dom.multiselectMenu) return;

        const isClickInside = dom.multiselectTrigger.contains(event.target) ||
                             dom.multiselectMenu.contains(event.target);

        if (!isClickInside && dom.multiselectMenu.classList.contains('active')) {
            closeMultiselect();
        }
    });

    // Reposition on scroll/resize
    window.addEventListener('scroll', () => {
        if (dom.multiselectMenu && dom.multiselectMenu.classList.contains('active')) {
            positionDropdown();
        }
    }, true);

    window.addEventListener('resize', () => {
        if (dom.multiselectMenu && dom.multiselectMenu.classList.contains('active')) {
            positionDropdown();
        }
    });
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
