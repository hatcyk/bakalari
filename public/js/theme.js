import { dom } from './dom.js';

// Theme management
export function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
}

export function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);

    if (!dom.themeToggle) return;

    const sunIcon = dom.themeToggle.querySelector('.sun-icon');
    const moonIcon = dom.themeToggle.querySelector('.moon-icon');

    if (theme === 'light') {
        sunIcon.style.display = 'none';
        moonIcon.style.display = 'block';
    } else {
        sunIcon.style.display = 'block';
        moonIcon.style.display = 'none';
    }
}

export function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
}

export function initThemeToggle() {
    if (dom.themeToggle) {
        dom.themeToggle.addEventListener('click', toggleTheme);
    }
}
