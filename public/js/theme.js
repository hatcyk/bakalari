import { dom } from './dom.js';
import { isNightTime } from './suntime.js';

// Theme management
export function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
}

export function setTheme(theme, skipWarning = false) {
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

function showNightWarning(callback) {
    const overlay = document.createElement('div');
    overlay.className = 'theme-warning-overlay';
    overlay.innerHTML = `
        <div class="theme-warning-dialog">
            <div class="theme-warning-header">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <h3>Přepnout na světlý režim?</h3>
            </div>
            <div class="theme-warning-body">
                <p>Venku je tma. Tmavý režim je šetrnější k očím a baterii.</p>
                <p>Opravdu chcete přepnout na světlý režim?</p>
            </div>
            <div class="theme-warning-actions">
                <button class="theme-warning-btn theme-warning-cancel">Zrušit</button>
                <button class="theme-warning-btn theme-warning-confirm">Přepnout</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Fade in
    requestAnimationFrame(() => {
        overlay.classList.add('visible');
    });

    const confirmBtn = overlay.querySelector('.theme-warning-confirm');
    const cancelBtn = overlay.querySelector('.theme-warning-cancel');

    const closeDialog = (confirmed) => {
        overlay.classList.remove('visible');
        setTimeout(() => {
            overlay.remove();
        }, 300);

        if (confirmed) {
            callback();
        }
    };

    confirmBtn.addEventListener('click', () => closeDialog(true));
    cancelBtn.addEventListener('click', () => closeDialog(false));
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeDialog(false);
    });
}

export function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    // Check if switching to light mode during nighttime
    if (newTheme === 'light' && isNightTime()) {
        showNightWarning(() => {
            setTheme(newTheme);
        });
    } else {
        setTheme(newTheme);
    }
}

export function initThemeToggle() {
    if (dom.themeToggle) {
        dom.themeToggle.addEventListener('click', toggleTheme);
    }
}
