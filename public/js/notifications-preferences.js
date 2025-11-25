/**
 * Notifications Preferences Module
 * Manages notification type preferences for each watched timetable
 */

import { state } from './state.js';
import { saveWatchedTimetables } from './notifications-core.js';

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
