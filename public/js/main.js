import { initDOM, dom } from './dom.js';
import { state, updateState } from './state.js';
import { initTheme, initThemeToggle } from './theme.js';
import { initModalListeners } from './modal.js';
import { loadTimetable, populateValueSelect, createDaySelector } from './timetable.js';
import { fetchDefinitions } from './api.js';
import { initCustomDropdown, setDropdownValue, getDropdownValue, openDropdown } from './dropdown.js';

// Type button handlers
function updateTypeButtons() {
    dom.typeButtons.forEach(btn => {
        if (btn.dataset.type === state.selectedType) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

function initTypeButtons() {
    if (!dom.typeButtons) return;

    dom.typeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const wasTypeChanged = state.selectedType !== btn.dataset.type;

            updateState('selectedType', btn.dataset.type);
            updateTypeButtons();
            populateValueSelect();

            // Clear dropdown display when switching types
            setDropdownValue('', 'Vyberte...');

            // Reset and hide group selector when changing type
            updateState('selectedGroup', 'all');
            dom.groupSelect.classList.add('hidden');

            // Auto-open dropdown only when switching types manually (clicking the button)
            // Don't open when coming from modal where value is already pre-selected
            if (wasTypeChanged) {
                setTimeout(() => openDropdown(), 100);
            }
        });
    });
}

// Schedule type button handlers
function updateScheduleTypeButtons() {
    dom.scheduleTypeButtons.forEach(btn => {
        if (btn.dataset.schedule === state.selectedScheduleType) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

function initScheduleTypeButtons() {
    if (!dom.scheduleTypeButtons) return;

    dom.scheduleTypeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            updateState('selectedScheduleType', btn.dataset.schedule);
            updateScheduleTypeButtons();
            loadTimetable();
        });
    });
}

// Group selector handler
function initGroupSelector() {
    if (!dom.groupSelect) return;

    // Use event delegation to handle button clicks
    dom.groupSelect.addEventListener('click', async (e) => {
        if (e.target.classList.contains('group-btn')) {
            const group = e.target.dataset.group;
            updateState('selectedGroup', group);
            console.log('Group changed to:', state.selectedGroup);

            // Update active button
            dom.groupSelect.querySelectorAll('.group-btn').forEach(btn => {
                if (btn.dataset.group === group) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });

            // Re-render timetable
            dom.timetableGrid.innerHTML = '';
            createDaySelector();

            // Re-render with current data
            const { renderTimetable } = await import('./timetable.js');
            renderTimetable(state.currentTimetableData);
        }
    });
}

// Value select handler (now handled by custom dropdown)
// The custom dropdown will call loadTimetable on selection

// Initialize application
async function init() {
    try {
        // Initialize DOM references first
        initDOM();

        // Initialize theme
        initTheme();
        initThemeToggle();

        // Initialize modal listeners with error handling
        initModalListeners();

        // Initialize custom dropdown
        initCustomDropdown(loadTimetable);

        // Fetch definitions
        const definitions = await fetchDefinitions();
        updateState('definitions', definitions);

        // Populate value select
        populateValueSelect();

        // Initialize event listeners
        initTypeButtons();
        initScheduleTypeButtons();
        initGroupSelector();

        // Restore saved selection
        const savedType = localStorage.getItem('selectedType');
        const savedValue = localStorage.getItem('selectedValue');

        if (savedType && savedValue) {
            updateState('selectedType', savedType);
            updateTypeButtons();
            populateValueSelect();
            setDropdownValue(savedValue);
            await loadTimetable();
        } else {
            // Default to class ZL
            updateState('selectedType', 'Class');
            updateTypeButtons();
            populateValueSelect();
            setDropdownValue('ZL');
            await loadTimetable();
        }

    } catch (e) {
        console.error('Initialization error:', e);
        if (dom.errorDiv) {
            dom.errorDiv.textContent = "Nepodařilo se načíst seznamy. Běží backend?";
            dom.errorDiv.classList.remove('hidden');
        }
    }
}

// Start application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
