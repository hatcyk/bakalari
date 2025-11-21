// DOM element references
export const dom = {
    typeButtons: null,
    scheduleTypeButtons: null,
    valueSelect: null,
    valueDropdown: null,
    valueDropdownTrigger: null,
    valueDropdownLabel: null,
    valueDropdownMenu: null,
    groupSelect: null,
    timetableGrid: null,
    loading: null,
    errorDiv: null,
    daySelector: null,
    themeToggle: null,
    lessonModal: null,
    modalClose: null
};

// Initialize DOM references
export function initDOM() {
    dom.typeButtons = document.querySelectorAll('.type-btn');
    dom.scheduleTypeButtons = document.querySelectorAll('.schedule-type-btn');
    dom.valueSelect = document.getElementById('valueSelect'); // Keep for backward compatibility
    dom.valueDropdown = document.getElementById('valueDropdown');
    dom.valueDropdownTrigger = document.getElementById('valueDropdownTrigger');
    dom.valueDropdownLabel = document.getElementById('valueDropdownLabel');
    dom.valueDropdownMenu = document.getElementById('valueDropdownMenu');
    dom.groupSelect = document.getElementById('groupSelect');
    dom.timetableGrid = document.getElementById('timetable');
    dom.loading = document.getElementById('loading');
    dom.errorDiv = document.getElementById('error');
    dom.daySelector = document.getElementById('daySelector');
    dom.themeToggle = document.getElementById('themeToggle');
    dom.lessonModal = document.getElementById('lessonModal');
    dom.modalClose = document.getElementById('modalClose');

    // Check if modal elements exist
    if (!dom.lessonModal || !dom.modalClose) {
        console.error('Modal elements not found!');
    }
}
