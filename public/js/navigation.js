import { dom } from './dom.js';
import { state, updateState } from './state.js';
import { getMondayOfWeek, getFridayOfWeek, formatDate } from './utils.js';

// Update week info display
export function updateWeekInfo() {
    const monday = getMondayOfWeek(state.weekOffset);
    const friday = getFridayOfWeek(state.weekOffset);

    const dateRange = `${formatDate(monday)} - ${formatDate(friday)}`;
    if (dom.weekDatesEl) {
        dom.weekDatesEl.textContent = dateRange;
    }
}

// Initialize week navigation
export function initWeekNavigation(loadTimetableCallback) {
    if (!dom.prevWeekBtn || !dom.nextWeekBtn) {
        console.error('Week navigation buttons not found');
        return;
    }

    dom.prevWeekBtn.addEventListener('click', () => {
        updateState('weekOffset', state.weekOffset - 1);
        updateWeekInfo();
        loadTimetableCallback();
    });

    dom.nextWeekBtn.addEventListener('click', () => {
        updateState('weekOffset', state.weekOffset + 1);
        updateWeekInfo();
        loadTimetableCallback();
    });

    // Initialize week info
    updateWeekInfo();
}
