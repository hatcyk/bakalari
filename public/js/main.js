import { initDOM, dom } from './dom.js';
import { state, updateState } from './state.js';
import { initTheme, initThemeToggle } from './theme.js';
import { initModalListeners } from './modal.js';
import { loadTimetable, populateValueSelect, createDaySelector, initWeekViewToggle } from './timetable.js';
import { fetchDefinitions } from './api.js';
import { initCustomDropdown, setDropdownValue, getDropdownValue, openDropdown } from './dropdown.js';
import { buildTeacherAbbreviationMap, shouldAutoSwitchToNextWeek } from './utils.js';
import { initSunData } from './suntime.js';
import { initializeFirebase, authenticateWithFirebase } from './firebase-client.js';
import { registerServiceWorker, initializeMessaging, initNotificationButton, showNotificationModal, closeNotificationModal, enableNotifications, disableNotificationsHandler, toggleMultiselect, filterMultiselectOptions } from './notifications.js';

/**
 * Cleanup old Service Workers (especially sw.js)
 * Prevents duplicate notifications from multiple SW
 */
async function cleanupOldServiceWorkers() {
    try {
        if (!('serviceWorker' in navigator)) {
            return;
        }

        const registrations = await navigator.serviceWorker.getRegistrations();
        let cleanedCount = 0;
        const oldSWs = [];

        for (const registration of registrations) {
            const scriptURL = registration.active?.scriptURL || '';

            // Remove any SW that is NOT firebase-messaging-sw.js
            if (scriptURL && !scriptURL.includes('firebase-messaging-sw.js')) {
                console.log(`🗑️ Cleaning up old Service Worker: ${scriptURL}`);
                oldSWs.push(scriptURL);
                await registration.unregister();
                cleanedCount++;
            }
        }

        if (cleanedCount > 0) {
            console.log(`✅ Cleaned up ${cleanedCount} old Service Worker(s):`, oldSWs);
            console.warn('⚠️ Stránka bude obnovena pro dokončení změn...');

            // Force reload after cleanup to ensure SW changes take effect
            setTimeout(() => {
                console.log('🔄 Reloading aplikace...');
                window.location.reload();
            }, 1000);
        }
    } catch (error) {
        console.error('❌ Failed to cleanup Service Workers:', error);
    }
}

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

        // Initialize Firebase
        console.log('Initializing Firebase...');
        await initializeFirebase(window.firebaseConfig);
        await authenticateWithFirebase();
        console.log('Firebase ready!');

        // Cleanup old Service Workers before initializing new ones
        await cleanupOldServiceWorkers();

        // Initialize Service Worker and Notifications
        registerServiceWorker().catch(err => console.error('Service Worker registration failed:', err));
        initializeMessaging().catch(err => console.error('Firebase Messaging initialization failed:', err));

        // Initialize sun data (async, doesn't block)
        initSunData().catch(err => console.error('Failed to load sun data:', err));

        // Initialize modal listeners with error handling
        initModalListeners();

        // Initialize custom dropdown
        initCustomDropdown(loadTimetable);

        // Fetch definitions
        const definitions = await fetchDefinitions();
        updateState('definitions', definitions);

        // Expose state and dom to window for debugging
        if (typeof window !== 'undefined') {
            window.debugState = state;
            window.debugDom = dom;
        }

        // Build teacher abbreviation map with collision detection
        const abbreviationMap = buildTeacherAbbreviationMap(definitions.teachers || []);
        updateState('teacherAbbreviationMap', abbreviationMap);

        // Populate value select
        populateValueSelect();

        // Initialize event listeners
        initTypeButtons();
        initScheduleTypeButtons();
        initWeekViewToggle();
        initNotificationButton();

        // Initialize notification modal listeners
        if (dom.notificationModalClose) {
            dom.notificationModalClose.addEventListener('click', closeNotificationModal);
        }
        if (dom.notificationToggleEnable) {
            dom.notificationToggleEnable.addEventListener('click', enableNotifications);
        }
        if (dom.notificationToggleDisable) {
            dom.notificationToggleDisable.addEventListener('click', disableNotificationsHandler);
        }
        if (dom.multiselectTrigger) {
            dom.multiselectTrigger.addEventListener('click', toggleMultiselect);
        }
        if (dom.multiselectSearch) {
            dom.multiselectSearch.addEventListener('input', (e) => {
                filterMultiselectOptions(e.target.value);
            });
        }
        if (dom.notificationModal) {
            dom.notificationModal.addEventListener('click', (e) => {
                if (e.target === dom.notificationModal) {
                    closeNotificationModal();
                }
            });
        }
        // Close multiselect when clicking outside
        document.addEventListener('click', (e) => {
            if (dom.multiselectTrigger && dom.multiselectMenu) {
                if (!dom.multiselectTrigger.contains(e.target) && !dom.multiselectMenu.contains(e.target)) {
                    if (dom.multiselectMenu.classList.contains('active')) {
                        toggleMultiselect();
                    }
                }
            }
        });

        // Restore saved selection
        const savedType = localStorage.getItem('selectedType');
        const savedValue = localStorage.getItem('selectedValue');

        // Check if we should auto-switch to next week (Friday afternoon)
        if (shouldAutoSwitchToNextWeek() && state.selectedScheduleType === 'actual') {
            console.log('Friday afternoon detected - auto-switching to next week');
            updateState('selectedScheduleType', 'next');
            updateScheduleTypeButtons();
        }

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
    } finally {
        if (dom.loading) {
            dom.loading.classList.add('hidden');
        }
    }
}

// Start application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
