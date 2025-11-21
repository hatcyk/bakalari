import { dom } from './dom.js';

// Custom dropdown state
let currentValue = '';
let isOpen = false;
let searchInput = null;
let allOptions = [];
let changeCallback = null;

// Initialize custom dropdown
export function initCustomDropdown(onChangeCallback) {
    if (!dom.valueDropdownTrigger || !dom.valueDropdownMenu) {
        console.error('Custom dropdown elements not found');
        return;
    }

    // Store callback for later use
    changeCallback = onChangeCallback;

    // Toggle dropdown on trigger click
    dom.valueDropdownTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDropdown();
    });

    // Handle option selection
    dom.valueDropdownMenu.addEventListener('click', (e) => {
        if (e.target.classList.contains('custom-dropdown-option')) {
            const value = e.target.dataset.value;
            selectOption(value, e.target.textContent);
            closeDropdown();
            if (changeCallback) {
                changeCallback();
            }
        }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (isOpen && !dom.valueDropdown.contains(e.target)) {
            closeDropdown();
        }
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isOpen) {
            closeDropdown();
        }
    });
}

// Toggle dropdown open/close
function toggleDropdown() {
    if (isOpen) {
        closeDropdown();
    } else {
        openDropdown();
    }
}

// Open dropdown
export function openDropdown() {
    isOpen = true;
    dom.valueDropdownTrigger.classList.add('open');
    dom.valueDropdownMenu.classList.add('open');

    // Focus search input if it exists
    if (searchInput) {
        setTimeout(() => searchInput.focus(), 100);
    }
}

// Close dropdown
function closeDropdown() {
    isOpen = false;
    dom.valueDropdownTrigger.classList.remove('open');
    dom.valueDropdownMenu.classList.remove('open');

    // Clear search input
    if (searchInput) {
        searchInput.value = '';
        filterOptions('');
    }
}

// Select an option
function selectOption(value, label) {
    currentValue = value;
    dom.valueDropdownLabel.textContent = label;

    // Update selected state in menu
    dom.valueDropdownMenu.querySelectorAll('.custom-dropdown-option').forEach(opt => {
        if (opt.dataset.value === value) {
            opt.classList.add('selected');
        } else {
            opt.classList.remove('selected');
        }
    });
}

// Populate dropdown options
export function populateDropdown(items) {
    if (!dom.valueDropdownMenu) return;

    dom.valueDropdownMenu.innerHTML = '';

    // Store all options for filtering
    allOptions = items;

    // Create search input
    searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'custom-dropdown-search';
    searchInput.placeholder = 'Hledat...';

    // Add search event listener
    searchInput.addEventListener('input', (e) => {
        filterOptions(e.target.value);
    });

    // Handle Enter key to select first visible option
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            selectFirstVisibleOption();
        }
    });

    // Prevent dropdown from closing when clicking on search input
    searchInput.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    dom.valueDropdownMenu.appendChild(searchInput);

    // Create all option elements
    items.forEach(item => {
        const option = document.createElement('div');
        option.className = 'custom-dropdown-option';
        option.dataset.value = item.value;
        option.textContent = item.label;
        option.dataset.searchText = item.label.toLowerCase();

        if (item.value === currentValue) {
            option.classList.add('selected');
        }

        dom.valueDropdownMenu.appendChild(option);
    });
}

// Filter options based on search text
function filterOptions(searchText) {
    const searchLower = searchText.toLowerCase();
    const options = dom.valueDropdownMenu.querySelectorAll('.custom-dropdown-option');

    options.forEach(option => {
        const text = option.dataset.searchText;
        if (text.includes(searchLower)) {
            option.style.display = 'block';
        } else {
            option.style.display = 'none';
        }
    });
}

// Set dropdown value programmatically
export function setDropdownValue(value, label) {
    currentValue = value;
    if (label) {
        dom.valueDropdownLabel.textContent = label;
    } else {
        // Find the label from the options
        const option = dom.valueDropdownMenu.querySelector(`[data-value="${value}"]`);
        if (option) {
            dom.valueDropdownLabel.textContent = option.textContent;
        }
    }

    // Update selected state
    dom.valueDropdownMenu.querySelectorAll('.custom-dropdown-option').forEach(opt => {
        if (opt.dataset.value === value) {
            opt.classList.add('selected');
        } else {
            opt.classList.remove('selected');
        }
    });
}

// Get current dropdown value
export function getDropdownValue() {
    return currentValue;
}

// Select first visible option
function selectFirstVisibleOption() {
    const options = dom.valueDropdownMenu.querySelectorAll('.custom-dropdown-option');

    for (const option of options) {
        if (option.style.display !== 'none') {
            const value = option.dataset.value;
            const label = option.textContent;
            selectOption(value, label);
            closeDropdown();

            // Trigger the change callback
            if (changeCallback) {
                changeCallback();
            }
            break;
        }
    }
}
