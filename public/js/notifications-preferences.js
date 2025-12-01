/**
 * Notifications Preferences Module
 * Manages notification type preferences for each watched timetable
 */

import { state } from './state.js';
import { saveWatchedTimetables } from './notifications-core.js';
import { standardizeGroupName } from './utils.js';

// Define notification types
export const NOTIFICATION_TYPES = {
    changes: {
        title: 'Změny v rozvrhu',
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>',
        options: {
            lesson_removed: {
                label: 'Odpadlé hodiny',
                description: 'Když hodina odpadne nebo je zrušená',
                default: true
            },
            substitution: {
                label: 'Suplování',
                description: 'Když se změní učitel',
                default: true
            },
            room_change: {
                label: 'Změna místnosti',
                description: 'Když se změní učebna',
                default: true
            },
            lesson_added: {
                label: 'Nové hodiny',
                description: 'Když se přidá nová hodina',
                default: false
            },
            subject_change: {
                label: 'Změna předmětu',
                description: 'Když se změní předmět',
                default: false
            }
        }
    },
    reminders: {
        title: 'Upomínky',
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
        options: {
            next_lesson_room: {
                label: 'Kam jít na další hodinu',
                description: 'Připomínka s číslem učebny před začátkem hodiny',
                default: false
            },
            next_lesson_teacher: {
                label: 'Koho máte na další hodinu',
                description: 'Připomínka s jménem učitele před začátkem hodiny',
                default: false
            },
            next_lesson_subject: {
                label: 'Co máte další hodinu',
                description: 'Připomínka s názvem předmětu před začátkem hodiny',
                default: false
            }
        }
    }
};

/**
 * Get default notification preferences
 */
export function getDefaultPreferences() {
    const preferences = {};

    for (const [groupKey, group] of Object.entries(NOTIFICATION_TYPES)) {
        preferences[groupKey] = {};
        for (const [optionKey, option] of Object.entries(group.options)) {
            preferences[groupKey][optionKey] = option.default;
        }
    }

    return preferences;
}

/**
 * Render preferences UI for selected timetables
 */
export function renderSelectedTimetablesPreferences() {
    const container = document.getElementById('selectedTimetablesList');
    const section = document.getElementById('selectedTimetablesSection');

    if (!container || !section) return;

    // If no timetables selected, hide section
    if (!state.watchedTimetables || state.watchedTimetables.length === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';
    container.innerHTML = '';

    // Render each timetable
    state.watchedTimetables.forEach((timetable, index) => {
        const item = createTimetablePreferenceItem(timetable, index);
        container.appendChild(item);
    });
}

/**
 * Create preference item for a single timetable
 */
function createTimetablePreferenceItem(timetable, index) {
    const item = document.createElement('div');
    item.className = 'timetable-preference-item';

    // Ensure timetable has notificationTypes
    if (!timetable.notificationTypes) {
        timetable.notificationTypes = getDefaultPreferences();
    }

    // Migrate groupFilters if missing (safety net)
    if (!timetable.groupFilters) {
        const oldFilter = timetable.groupFilter || 'all';
        timetable.groupFilters = [oldFilter];

        // Immediately save to persist migration
        saveWatchedTimetables(state.watchedTimetables).catch(err => {
            console.error('Failed to save migrated groupFilters:', err);
        });
    }

    // Header
    const header = document.createElement('div');
    header.className = 'timetable-preference-header';
    header.innerHTML = `
        <div class="timetable-preference-name">
            <span>${timetable.name}</span>
            <span class="timetable-preference-badge">${getScheduleTypeLabel(timetable.scheduleType)}</span>
        </div>
        <svg class="timetable-preference-arrow" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
    `;

    // Body with notification options
    const body = document.createElement('div');
    body.className = 'timetable-preference-body';

    // Group filter (pouze pro třídy)
    if (timetable.type === 'Class') {
        const groupFilterSection = document.createElement('div');
        groupFilterSection.className = 'group-filter-section';
        groupFilterSection.innerHTML = `
            <label class="group-filter-label">Filtrovat podle skupiny:</label>
            <div class="multiselect-dropdown" id="group-filter-${index}">
                <div class="multiselect-trigger">
                    <span class="multiselect-label">Načítám...</span>
                    <svg class="multiselect-arrow" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                </div>
                <div class="multiselect-menu">
                    <div class="multiselect-options"></div>
                </div>
            </div>
        `;
        body.appendChild(groupFilterSection);

        // Async načtení skupin a nastavení
        const multiselectElement = groupFilterSection.querySelector('.multiselect-dropdown');
        populateGroupFilter(multiselectElement, timetable, index);
    }

    // Render each notification type group
    for (const [groupKey, group] of Object.entries(NOTIFICATION_TYPES)) {
        // Skip reminders for Next schedule type
        if (groupKey === 'reminders' && timetable.scheduleType === 'Next') {
            continue;
        }

        const groupDiv = document.createElement('div');
        groupDiv.className = 'notification-type-group';

        // Group title
        const groupTitle = document.createElement('div');
        groupTitle.className = 'notification-type-group-title';
        groupTitle.innerHTML = `${group.icon} ${group.title}`;

        // Add note for reminders that they are only for Actual schedule
        if (groupKey === 'reminders' && timetable.scheduleType === 'Actual') {
            const note = document.createElement('span');
            note.className = 'notification-type-group-note';
            note.textContent = '(pouze pro aktuální týden)';
            groupTitle.appendChild(note);
        }

        groupDiv.appendChild(groupTitle);

        // Options
        for (const [optionKey, option] of Object.entries(group.options)) {
            const optionDiv = document.createElement('div');
            optionDiv.className = 'notification-type-option';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `pref-${index}-${groupKey}-${optionKey}`;
            checkbox.checked = timetable.notificationTypes[groupKey]?.[optionKey] ?? option.default;
            checkbox.addEventListener('change', () => {
                updateTimetablePreference(index, groupKey, optionKey, checkbox.checked);
            });

            const label = document.createElement('label');
            label.htmlFor = checkbox.id;
            label.innerHTML = `
                <div>${option.label}</div>
                <div class="notification-type-option-description">${option.description}</div>
            `;

            optionDiv.appendChild(checkbox);
            optionDiv.appendChild(label);

            // Click on the whole row to toggle
            optionDiv.addEventListener('click', (e) => {
                if (e.target !== checkbox) {
                    checkbox.checked = !checkbox.checked;
                    checkbox.dispatchEvent(new Event('change'));
                }
            });

            groupDiv.appendChild(optionDiv);
        }

        body.appendChild(groupDiv);
    }

    // Toggle expand/collapse
    header.addEventListener('click', () => {
        const isExpanded = header.classList.contains('expanded');
        if (isExpanded) {
            header.classList.remove('expanded');
            body.classList.remove('expanded');
        } else {
            header.classList.add('expanded');
            body.classList.add('expanded');
        }
    });

    item.appendChild(header);
    item.appendChild(body);

    return item;
}

/**
 * Update notification preference for a specific timetable
 */
async function updateTimetablePreference(index, groupKey, optionKey, value) {
    const timetable = state.watchedTimetables[index];

    if (!timetable.notificationTypes) {
        timetable.notificationTypes = getDefaultPreferences();
    }

    if (!timetable.notificationTypes[groupKey]) {
        timetable.notificationTypes[groupKey] = {};
    }

    timetable.notificationTypes[groupKey][optionKey] = value;

    // Save to server
    try {
        await saveWatchedTimetables(state.watchedTimetables);
        console.log(`✅ Updated preference: ${groupKey}.${optionKey} = ${value}`);
    } catch (error) {
        console.error('Failed to save preferences:', error);
    }
}

/**
 * Get human-readable label for schedule type
 */
function getScheduleTypeLabel(scheduleType) {
    const labels = {
        'Permanent': 'Stálý',
        'Actual': 'Aktuální',
        'Next': 'Příští'
    };
    return labels[scheduleType] || scheduleType;
}

/**
 * Get available groups for a watched timetable
 * @param {Object} watchedTimetable - { type, id, scheduleType }
 * @returns {Promise<Array<string>>} Array of standardized group names
 */
async function getAvailableGroups(watchedTimetable) {
    console.log('🔍 getAvailableGroups called for:', watchedTimetable);

    try {
        // Convert scheduleType to schedule parameter (Actual → actual, Next → next, Permanent → permanent)
        const scheduleParam = watchedTimetable.scheduleType.toLowerCase();
        const url = `/api/timetable?type=${watchedTimetable.type}&id=${watchedTimetable.id}&schedule=${scheduleParam}`;
        console.log('   Fetching from:', url);

        const response = await fetch(url);
        console.log('   Response status:', response.status);

        if (!response.ok) {
            console.warn('   ⚠️  Response not OK, using fallback groups');
            return ['all', 'celá', '1.sk', '2.sk']; // Fallback
        }

        // API returns array directly, not wrapped in {data: [...]}
        const lessons = await response.json();
        console.log('   Total lessons:', lessons.length);
        console.log('   Sample lessons with groups:', lessons.filter(l => l.group).slice(0, 3));

        // Extrauj unikátní skupiny
        const groupsSet = new Set(['all']);
        lessons.forEach(lesson => {
            if (lesson.group) {
                const original = lesson.group;
                const std = standardizeGroupName(lesson.group);
                console.log(`   Group found: "${original}" → "${std}"`);
                if (std) groupsSet.add(std);
            }
        });

        // Pokud jsme nenašli žádné skupiny kromě 'all', přidej výchozí 'celá'
        // (uživatel může mít rozvrh bez skupin)
        if (groupsSet.size === 1) {
            console.warn('   ⚠️ No groups found in lessons besides "all"');
            groupsSet.add('celá'); // Celá třída jako výchozí možnost
        }

        // Seřaď: all → celá → 1.sk → 2.sk ...
        const sorted = Array.from(groupsSet).sort((a, b) => {
            if (a === 'all') return -1;
            if (b === 'all') return 1;
            if (a === 'celá') return -1;
            if (b === 'celá') return 1;
            return a.localeCompare(b);
        });

        console.log('   ✅ Final groups:', sorted);
        return sorted;
    } catch (error) {
        console.error('   ❌ Failed to get groups:', error);
        return ['all', 'celá', '1.sk', '2.sk']; // Fallback
    }
}

/**
 * Populate group filter multiselect dropdown and set up listeners
 * @param {HTMLElement} multiselectElement - The multiselect dropdown element
 * @param {Object} watchedTimetable - The timetable object
 * @param {Number} index - Index in watchedTimetables array
 */
async function populateGroupFilter(multiselectElement, watchedTimetable, index) {
    console.log('📋 populateGroupFilter called');
    console.log('   Element:', multiselectElement);
    console.log('   Timetable:', watchedTimetable);
    console.log('   Current groupFilters:', watchedTimetable.groupFilters);

    const trigger = multiselectElement.querySelector('.multiselect-trigger');
    const menu = multiselectElement.querySelector('.multiselect-menu');
    const optionsContainer = multiselectElement.querySelector('.multiselect-options');
    const label = multiselectElement.querySelector('.multiselect-label');

    // Ověř, že všechny DOM elementy existují
    if (!optionsContainer) {
        console.error('❌ optionsContainer not found in multiselect element!');
        return;
    }
    if (!trigger || !menu || !label) {
        console.error('❌ Missing required multiselect elements (trigger/menu/label)!');
        return;
    }

    // Initialize groupFilters if it doesn't exist (backwards compatibility)
    if (!watchedTimetable.groupFilters) {
        // Migrate from old single groupFilter to array
        const oldFilter = watchedTimetable.groupFilter || 'all';
        watchedTimetable.groupFilters = [oldFilter];
    }

    // Load available groups
    const groups = await getAvailableGroups(watchedTimetable);
    console.log('   Got groups:', groups);

    // Render checkbox options
    optionsContainer.innerHTML = '';
    groups.forEach(group => {
        try {
        const option = document.createElement('div');
        option.className = 'multiselect-option';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `group-${index}-${group}`;
        checkbox.value = group;
        checkbox.checked = watchedTimetable.groupFilters.includes(group);

        const span = document.createElement('span');
        span.textContent = group === 'all' ? 'Všechny skupiny' :
                          group === 'celá' ? 'Celá třída' : group;

        option.appendChild(checkbox);
        option.appendChild(span);

        // Toggle on click
        option.addEventListener('click', async (e) => {
            e.stopPropagation();
            checkbox.checked = !checkbox.checked;
            await handleGroupFilterChange(checkbox, watchedTimetable, groups);
        });

        // Handle checkbox change
        checkbox.addEventListener('change', async (e) => {
            e.stopPropagation();
            await handleGroupFilterChange(checkbox, watchedTimetable, groups);
        });

        optionsContainer.appendChild(option);
        console.log(`   Added option: value="${group}", checked=${checkbox.checked}`);
        } catch (error) {
            console.error(`❌ Failed to render option for group "${group}":`, error);
        }
    });

    // Update label based on selection
    updateGroupFilterLabel(label, watchedTimetable.groupFilters);

    // Toggle dropdown on trigger click
    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isActive = menu.classList.contains('active');

        if (isActive) {
            closeGroupFilterDropdown(trigger, menu);
        } else {
            openGroupFilterDropdown(trigger, menu);
        }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!multiselectElement.contains(e.target)) {
            closeGroupFilterDropdown(trigger, menu);
        }
    });

    console.log('✅ populateGroupFilter finished');
}

/**
 * Handle group filter checkbox change
 */
async function handleGroupFilterChange(checkbox, watchedTimetable, allGroups) {
    const value = checkbox.value;
    const isChecked = checkbox.checked;

    console.log(`🔄 Group filter toggled: "${value}" = ${isChecked}`);

    // Handle "all" logic
    if (value === 'all') {
        if (isChecked) {
            // If "all" is checked, uncheck everything else and only keep "all"
            watchedTimetable.groupFilters = ['all'];
            // Update all other checkboxes
            const allCheckboxes = document.querySelectorAll(`input[type="checkbox"][value]:not([value="all"])`);
            allCheckboxes.forEach(cb => {
                if (cb.closest('.multiselect-dropdown') === checkbox.closest('.multiselect-dropdown')) {
                    cb.checked = false;
                }
            });
        } else {
            // Can't uncheck "all" if it's the only one
            if (watchedTimetable.groupFilters.length === 1 && watchedTimetable.groupFilters[0] === 'all') {
                checkbox.checked = true;
                return;
            }
            watchedTimetable.groupFilters = watchedTimetable.groupFilters.filter(g => g !== 'all');
        }
    } else {
        // Specific group checkbox
        if (isChecked) {
            // Remove "all" if a specific group is selected
            watchedTimetable.groupFilters = watchedTimetable.groupFilters.filter(g => g !== 'all');
            watchedTimetable.groupFilters.push(value);

            // Uncheck "all" checkbox
            const allCheckbox = checkbox.closest('.multiselect-dropdown').querySelector('input[value="all"]');
            if (allCheckbox) allCheckbox.checked = false;
        } else {
            // Remove the group
            watchedTimetable.groupFilters = watchedTimetable.groupFilters.filter(g => g !== value);

            // If nothing is selected, revert to "all"
            if (watchedTimetable.groupFilters.length === 0) {
                watchedTimetable.groupFilters = ['all'];
                const allCheckbox = checkbox.closest('.multiselect-dropdown').querySelector('input[value="all"]');
                if (allCheckbox) allCheckbox.checked = true;
            }
        }
    }

    // Update label
    const label = checkbox.closest('.multiselect-dropdown').querySelector('.multiselect-label');
    updateGroupFilterLabel(label, watchedTimetable.groupFilters);

    // Save to server
    try {
        await saveWatchedTimetables(state.watchedTimetables);
        console.log(`✅ Group filters saved successfully:`, watchedTimetable.groupFilters);
    } catch (error) {
        console.error('❌ Failed to save group filters:', error);
    }
}

/**
 * Update the multiselect label based on selected groups
 */
function updateGroupFilterLabel(label, groupFilters) {
    if (!groupFilters || groupFilters.length === 0 || groupFilters.includes('all')) {
        label.textContent = 'Všechny skupiny';
    } else if (groupFilters.length === 1) {
        const group = groupFilters[0];
        label.textContent = group === 'celá' ? 'Celá třída' : group;
    } else {
        label.textContent = `${groupFilters.length} skupiny vybrány`;
    }
}

/**
 * Open group filter dropdown with fixed positioning
 */
function openGroupFilterDropdown(trigger, menu) {
    trigger.classList.add('active');
    menu.classList.add('active');

    // Position the dropdown
    const rect = trigger.getBoundingClientRect();
    const menuHeight = menu.offsetHeight;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    // Set width to match trigger
    menu.style.width = `${rect.width}px`;
    menu.style.left = `${rect.left}px`;

    // Position above or below based on available space
    if (spaceBelow >= menuHeight || spaceBelow >= spaceAbove) {
        // Position below
        menu.style.top = `${rect.bottom}px`;
        menu.style.bottom = 'auto';
        menu.style.borderTopLeftRadius = '0';
        menu.style.borderTopRightRadius = '0';
    } else {
        // Position above
        menu.style.bottom = `${window.innerHeight - rect.top}px`;
        menu.style.top = 'auto';
        menu.style.borderBottomLeftRadius = '0';
        menu.style.borderBottomRightRadius = '0';
    }
}

/**
 * Close group filter dropdown
 */
function closeGroupFilterDropdown(trigger, menu) {
    trigger.classList.remove('active');
    menu.classList.remove('active');
}
