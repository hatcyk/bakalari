/**
 * Debug Utility
 * Centralized logging that respects debug mode
 */

// Check if debug mode is enabled (from localStorage or URL param)
function isDebugEnabled() {
    // Check localStorage
    if (localStorage.getItem('DEBUG_MODE') === 'true') {
        return true;
    }

    // Check URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('debug') === 'true') {
        localStorage.setItem('DEBUG_MODE', 'true');
        return true;
    }

    return false;
}

const DEBUG_ENABLED = isDebugEnabled();

/**
 * Debug logger - only logs when debug mode is enabled
 */
export const debug = {
    log: (...args) => {
        if (DEBUG_ENABLED) {
            console.log(...args);
        }
    },

    warn: (...args) => {
        if (DEBUG_ENABLED) {
            console.warn(...args);
        }
    },

    error: (...args) => {
        // Errors always show (you want to know about errors)
        console.error(...args);
    },

    info: (...args) => {
        if (DEBUG_ENABLED) {
            console.info(...args);
        }
    },

    table: (...args) => {
        if (DEBUG_ENABLED) {
            console.table(...args);
        }
    },

    group: (label) => {
        if (DEBUG_ENABLED) {
            console.group(label);
        }
    },

    groupEnd: () => {
        if (DEBUG_ENABLED) {
            console.groupEnd();
        }
    },

    // Check if debug is enabled
    isEnabled: () => DEBUG_ENABLED,

    // Enable/disable debug mode
    enable: () => {
        localStorage.setItem('DEBUG_MODE', 'true');
        console.log('🔧 Debug mode ENABLED. Reload page to apply.');
    },

    disable: () => {
        localStorage.removeItem('DEBUG_MODE');
        console.log('🔧 Debug mode DISABLED. Reload page to apply.');
    }
};

// Make debug available globally for console access
if (typeof window !== 'undefined') {
    window.debug = debug;
}
