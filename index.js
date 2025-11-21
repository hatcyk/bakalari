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
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
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

        // Get cookies from response
        const cookies = response.headers['set-cookie'];
        if (!cookies || cookies.length === 0) {
            return res.status(401).json({ error: 'Nepodařilo se získat přihlašovací údaje' });
        }

        // Create user ID from username
        const userId = username.toLowerCase();

        // Save cookie to KV
        await saveUserCookie(userId, cookies.join('; '));

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
    const url = `${BASE_URL}/${type}/${id}`;

    try {
        // Get user's cookie from KV
        const userCookie = await getUserCookie(req.session.userId);
        if (!userCookie) {
            return res.status(401).json({ error: 'Cookie nenalezeno. Přihlaste se znovu.' });
        }

        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Cookie': userCookie
        };

        const response = await axios.get(url, { headers });
        const $ = cheerio.load(response.data);
        const timetable = [];
        $('.bk-timetable-row').each((rowIndex, row) => {
            const dayName = $(row).find('.bk-day-day').text().trim();
            const dayIndex = ['po', 'út', 'st', 'čt', 'pá'].indexOf(dayName.toLowerCase());
            $(row).find('.bk-timetable-cell').each((cellIndex, cell) => {
                const items = $(cell).find('.day-item-hover');
                items.each((_, item) => {
                    const detailRaw = $(item).attr('data-detail');
                    if (detailRaw) {
                        try {
                            const data = JSON.parse(detailRaw);
                            timetable.push({
                                day: dayIndex,
                                dayName: dayName,
                                hour: cellIndex,
                                subject: data.subjecttext ? data.subjecttext.split('|')[0].trim() : "",
                                teacher: data.teacher,
                                room: data.room,
                                group: data.group,
                                theme: data.theme,
                                type: data.type,
                                changed: !!data.changeinfo
                            });
                        } catch (e) {}
                    }
                });
            });
        });
        res.json(timetable);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/definitions', requireAuth, async (req, res) => {
    try {
        // Get user's cookie from KV
        const userCookie = await getUserCookie(req.session.userId);
        if (!userCookie) {
            return res.status(401).json({ error: 'Cookie nenalezeno. Přihlaste se znovu.' });
        }

        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Cookie': userCookie
        };

        const response = await axios.get(`${BASE_URL}/Class/ZL`, { headers });
        const $ = cheerio.load(response.data);
        const data = { classes: [], teachers: [], rooms: [] };
        $('#selectedClass option').each((_, el) => data.classes.push({ id: $(el).val(), name: $(el).text().trim() }));
        $('#selectedTeacher option').each((_, el) => data.teachers.push({ id: $(el).val(), name: $(el).text().trim() }));
        $('#selectedRoom option').each((_, el) => data.rooms.push({ id: $(el).val(), name: $(el).text().trim() }));
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🤖 Web běží na http://localhost:${PORT}`);
});