const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true only in production with HTTPS
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
        sameSite: 'lax'
    }
}));

// Vercel KV setup (will be initialized when deployed to Vercel)
let kv;
const hasVercelKV = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;

if (hasVercelKV) {
    // Use Vercel KV in production
    const { kv: vercelKV } = require('@vercel/kv');
    kv = vercelKV;
    console.log('✅ Using Vercel KV storage');
} else {
    // Fallback to in-memory storage for local development
    const inMemoryStore = new Map();
    kv = {
        get: async (key) => inMemoryStore.get(key),
        set: async (key, value) => {
            inMemoryStore.set(key, value);
            return value;
        },
        del: async (key) => inMemoryStore.delete(key)
    };
    console.log('⚠️  Using in-memory storage (Vercel KV not available)');
}

// ==================================================================
// DŮLEŽITÉ: TENTO ŘÁDEK ŘÍKÁ SERVERU "UKAŽ OBSAH SLOŽKY PUBLIC"
// ==================================================================
app.use(express.static(path.join(__dirname, 'public')));


// Auth middleware
const requireAuth = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Nepřihlášen' });
    }
    next();
};

const BASE_URL = 'https://mot-spsd.bakalari.cz/Timetable/Public/Actual';
const BAKALARI_LOGIN_URL = 'https://mot-spsd.bakalari.cz/api/login';
const BAKALARI_API_BASE = 'https://mot-spsd.bakalari.cz/api/3';

// Helper function to get user's cookie from KV
async function getUserCookie(userId) {
    const cookie = await kv.get(`user:${userId}:cookie`);
    return cookie;
}

// Helper function to save user's cookie to KV
async function saveUserCookie(userId, cookie) {
    await kv.set(`user:${userId}:cookie`, cookie);
}

// === AUTH API ENDPOINTY ===
app.post('/api/auth/login', async (req, res) => {
    const { username, password, remember } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Vyplňte všechna pole' });
    }

    try {
        // Authenticate with Bakaláři
        const response = await axios.post(BAKALARI_LOGIN_URL, {
            client_id: 'ANDR',
            grant_type: 'password',
            username,
            password
        }, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        // Get access token from response
        const accessToken = response.data.access_token;
        if (!accessToken) {
            return res.status(401).json({ error: 'Nepodařilo se získat přihlašovací token' });
        }

        // Get cookies from response headers
        const cookies = response.headers['set-cookie'];
        const cookieString = cookies ? cookies.join('; ') : '';

        // Create user ID from username
        const userId = username.toLowerCase();

        // Save both token and cookie to KV
        await kv.set(`user:${userId}:token`, accessToken);
        await saveUserCookie(userId, cookieString);

        // Save user session
        req.session.userId = userId;
        req.session.username = username;

        if (remember) {
            req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 30; // 30 days
        }

        res.json({ success: true, username });
    } catch (error) {
        console.error('Login error:', error);

        if (error.response && error.response.status === 401) {
            return res.status(401).json({ error: 'Nesprávné přihlašovací údaje' });
        }

        res.status(500).json({ error: 'Chyba při přihlašování' });
    }
}); 

app.get('/api/auth/check', (req, res) => {
    if (req.session.userId) {
        res.json({ authenticated: true, username: req.session.username });
    } else {
        res.status(401).json({ authenticated: false });
    }
});

app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Chyba při odhlašování' });
        }
        res.json({ success: true });
    });
});

// === TIMETABLE API ENDPOINTY ===
app.get('/api/timetable', requireAuth, async (req, res) => {
    const { type, id } = req.query;

    try {
        // Get user's token from KV
        const accessToken = await kv.get(`user:${req.session.userId}:token`);
        if (!accessToken) {
            return res.status(401).json({ error: 'Token nenalezen. Přihlaste se znovu.' });
        }

        const headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Bearer ${accessToken}`
        };

        // Try API endpoint
        try {
            const apiResponse = await axios.get('https://mot-spsd.bakalari.cz/api/3/timetable/actual', { headers });
            console.log('Timetable API response received');

            // Parse API response
            // This structure depends on Bakaláři API format
            if (apiResponse.data && apiResponse.data.Hours) {
                const timetable = [];
                apiResponse.data.Hours.forEach(hour => {
                    if (hour.Atoms) {
                        hour.Atoms.forEach(atom => {
                            timetable.push({
                                day: atom.DayOfWeek - 1, // 1=Po, convert to 0-based
                                hour: hour.BeginTime, // or atom.HourId
                                subject: atom.SubjectText || '',
                                teacher: atom.TeacherAbbrev || '',
                                room: atom.RoomAbbrev || '',
                                group: atom.GroupAbbrev || '',
                                changed: atom.Change !== null
                            });
                        });
                    }
                });
                return res.json(timetable);
            }
        } catch (apiError) {
            console.log('API timetable failed:', apiError.response?.status);
        }

        // Fallback: return empty timetable for now
        console.log(`Returning empty timetable for ${type}/${id}`);
        res.json([]);
    } catch (error) {
        console.error('Timetable error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/definitions', requireAuth, async (req, res) => {
    try {
        // Get user's token from KV
        const accessToken = await kv.get(`user:${req.session.userId}:token`);
        if (!accessToken) {
            return res.status(401).json({ error: 'Token nenalezen. Přihlaste se znovu.' });
        }

        const headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Bearer ${accessToken}`
        };

        // Try to fetch from the API - try different endpoints
        console.log('Trying API endpoints...');

        // Try /api/3/timetable/actual
        try {
            const actualResponse = await axios.get('https://mot-spsd.bakalari.cz/api/3/timetable/actual', { headers });
            console.log('Actual timetable response:', actualResponse.data);
        } catch (e) {
            console.log('Actual endpoint failed:', e.response?.status);
        }

        // Try /api/3/user
        try {
            const userResponse = await axios.get('https://mot-spsd.bakalari.cz/api/3/user', { headers });
            console.log('User response:', userResponse.data);
        } catch (e) {
            console.log('User endpoint failed:', e.response?.status);
        }

        // Fallback: use hardcoded classes from your school
        // Based on typical Czech school structure
        const data = {
            classes: [
                { id: 'ZL', name: '4.L' },
                { id: 'A1', name: '1.A' },
                { id: 'A2', name: '2.A' },
                { id: 'A3', name: '3.A' },
                { id: 'A4', name: '4.A' },
                { id: 'B1', name: '1.B' },
                { id: 'B2', name: '2.B' },
                { id: 'B3', name: '3.B' },
                { id: 'B4', name: '4.B' }
            ],
            teachers: [],
            rooms: []
        };

        console.log('Using fallback data:', data);
        res.json(data);
    } catch (e) {
        console.error('Definitions error:', e.response?.data || e.message);
        res.status(500).json({ error: e.message });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🤖 Web běží na http://localhost:${PORT}`);
});