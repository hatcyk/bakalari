// DOM element references
export const dom = {
    typeButtons: null,
    scheduleTypeButtons: null,
    valueSelect: null,
    valueDropdown: null,
    valueDropdownTrigger: null,
    valueDropdownLabel: null,
    valueDropdownMenu: null,
    timetableGrid: null,
    loading: null,
    errorDiv: null,
    offlineBanner: null,
    outageBanner: null,
    daySelector: null,
    themeToggle: null,
    lessonModal: null,
    modalClose: null,
    weekViewToggle: null,
    notificationBell: null,
    notificationModal: null,
    notificationModalClose: null,
    notificationToggleEnable: null,
    notificationToggleDisable: null,
    notificationSection: null,
    iosWarning: null,
    watchedTimetablesList: null,
    multiselectTrigger: null,
    multiselectLabel: null,
    multiselectMenu: null,
    multiselectSearch: null,
    multiselectOptions: null
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
    dom.timetableGrid = document.getElementById('timetable');
    dom.loading = document.getElementById('loading');
    dom.errorDiv = document.getElementById('error');
    dom.offlineBanner = document.getElementById('offlineBanner');
    dom.outageBanner = document.getElementById('outageBanner');
    dom.daySelector = document.getElementById('daySelector');
    dom.themeToggle = document.getElementById('themeToggle');
    dom.lessonModal = document.getElementById('lessonModal');
    dom.modalClose = document.getElementById('modalClose');
    dom.weekViewToggle = document.getElementById('weekViewToggle');
    dom.notificationBell = document.getElementById('notificationBell');
    dom.notificationModal = document.getElementById('notificationModal');
    dom.notificationModalClose = document.getElementById('notificationModalClose');
    dom.notificationToggleEnable = document.getElementById('notificationToggleEnable');
    dom.notificationToggleDisable = document.getElementById('notificationToggleDisable');
    dom.notificationSection = document.getElementById('notificationSection');
    dom.iosWarning = document.getElementById('iosWarning');
    dom.watchedTimetablesList = document.getElementById('watchedTimetablesList');
    dom.multiselectTrigger = document.getElementById('multiselectTrigger');
    dom.multiselectLabel = document.getElementById('multiselectLabel');
    dom.multiselectMenu = document.getElementById('multiselectMenu');
    dom.multiselectSearch = document.getElementById('multiselectSearch');
    dom.multiselectOptions = document.getElementById('multiselectOptions');

    // Check if modal elements exist
    if (!dom.lessonModal || !dom.modalClose) {
        console.error('Modal elements not found!');
    }
}
