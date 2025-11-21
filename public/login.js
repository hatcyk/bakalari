const loginForm = document.getElementById('loginForm');
const loginBtn = document.getElementById('loginBtn');
const btnText = loginBtn.querySelector('.btn-text');
const btnLoading = loginBtn.querySelector('.btn-loading');
const errorMessage = document.getElementById('errorMessage');

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const remember = document.getElementById('remember').checked;

    if (!username || !password) {
        showError('Vyplňte všechna pole');
        return;
    }

    // Show loading state
    setLoading(true);
    hideError();

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username,
                password,
                remember
            })
        });

        const data = await response.json();

        if (response.ok) {
            // Success - redirect to main app
            window.location.href = '/';
        } else {
            // Error
            showError(data.error || 'Přihlášení se nezdařilo');
        }
    } catch (error) {
        console.error('Login error:', error);
        showError('Chyba připojení k serveru');
    } finally {
        setLoading(false);
    }
});

function setLoading(loading) {
    loginBtn.disabled = loading;
    if (loading) {
        btnText.classList.add('hidden');
        btnLoading.classList.remove('hidden');
    } else {
        btnText.classList.remove('hidden');
        btnLoading.classList.add('hidden');
    }
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
}

function hideError() {
    errorMessage.classList.add('hidden');
}

// Check if already logged in
async function checkAuth() {
    try {
        const response = await fetch('/api/auth/check');
        if (response.ok) {
            // Already logged in, redirect to main app
            window.location.href = '/';
        }
    } catch (error) {
        // Not logged in, stay on login page
    }
}

checkAuth();
