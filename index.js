require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const path = require('path'); // <--- DŮLEŽITÉ: Toto musí být nahoře
const os = require('os'); // Pro získání IP adresy
const fs = require('fs'); // Pro zápis do souborů

// Firebase and cron imports
const { createCustomToken, getFirestore } = require('./backend/firebase-admin-init');
const { startCronJob, triggerManualPrefetch, getCronStatus } = require('./backend/cron');
const { processPendingChanges, sendNotificationToTokens } = require('./backend/fcm');

// Debug mode
const DEBUG = process.env.DEBUG === 'true';

const app = express();
app.use(cors());
app.use(express.json()); // For parsing JSON request bodies

// Set proper MIME types for JavaScript modules
app.use((req, res, next) => {
    if (req.url.endsWith('.js')) {
        res.type('application/javascript');
    } else if (req.url.endsWith('.css')) {
        res.type('text/css');
    }
    next();
});

// ==================================================================
// DŮLEŽITÉ: TENTO ŘÁDEK ŘÍKÁ SERVERU "UKAŽ OBSAH SLOŽKY PUBLIC"
// ==================================================================
app.use(express.static(path.join(__dirname, 'public')));


// === TVOJE COOKIE ===
const MOJE_COOKIE = process.env.BAKALARI_COOKIE;

const BASE_URL_TEMPLATE = 'https://mot-spsd.bakalari.cz/Timetable/Public';
const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Cookie': MOJE_COOKIE
};

// === API ENDPOINTY ===
app.get('/api/timetable', async (req, res) => {
    const { type, id, schedule, date } = req.query;
    // Schedule can be 'actual' (default), 'permanent', or 'next'
    let scheduleType = 'Actual';
    if (schedule === 'permanent') {
        scheduleType = 'Permanent';
    } else if (schedule === 'next') {
        scheduleType = 'Next';
    }

    // Build URL with optional date parameter
    let url = `${BASE_URL_TEMPLATE}/${scheduleType}/${type}/${id}`;
    if (date) {
        url += `?date=${date}`;
    }

    console.log(`[API] Fetching timetable: ${url}`);
    try {
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

                            // Parse change info if exists
                            let changeInfo = null;
                            if (data.changeinfo) {
                                changeInfo = {
                                    raw: data.changeinfo,
                                    description: data.changeinfo
                                };
                            }

                            // Parse subject - handle removed/absent lessons specially
                            let subject = "";
                            let teacher = data.teacher || "";
                            let finalChangeInfo = changeInfo;

                            if (data.type === "removed" && data.removedinfo) {
                                // Parse removedinfo: "Vyjmuto z rozvrhu (PŘEDMĚT, UČITEL)" nebo "Zrušeno (PŘEDMĚT, UČITEL)"
                                const match = data.removedinfo.match(/\(([^,]+),\s*([^)]+)\)/);
                                if (match) {
                                    subject = match[1].trim();  // Předmět (např. "TV")
                                    teacher = match[2].trim();  // Učitel (např. "Navrátilová Jana")
                                } else {
                                    // Fallback pokud formát neodpovídá
                                    subject = data.subjecttext ? data.subjecttext.split('|')[0].trim() : "";
                                }

                                // Přidat do changeInfo pro zobrazení v modálním okně
                                finalChangeInfo = {
                                    raw: data.removedinfo,
                                    description: data.removedinfo
                                };
                            } else if (data.type === "absent" && data.InfoAbsentName) {
                                // Pro absent hodiny použít InfoAbsentName jako subject
                                subject = data.InfoAbsentName;  // např. "přednáška"

                                // Kapitalizovat první písmeno (přednáška -> Přednáška)
                                if (subject && subject.length > 0) {
                                    subject = subject.charAt(0).toUpperCase() + subject.slice(1);
                                }

                                // Přidat absentinfo do changeInfo
                                finalChangeInfo = {
                                    raw: data.absentinfo || "Absence",
                                    description: data.absentinfo ? `${data.InfoAbsentName} (${data.absentinfo})` : data.InfoAbsentName
                                };
                            } else {
                                // Normální hodiny - původní logika
                                subject = data.subjecttext ? data.subjecttext.split('|')[0].trim() : "";
                            }

                            const lessonData = {
                                day: dayIndex,
                                dayName: dayName,
                                hour: cellIndex,
                                subject: subject,
                                teacher: teacher,
                                room: data.room,
                                group: data.group,
                                theme: data.theme,
                                type: data.type,
                                changed: !!(finalChangeInfo),
                                changeInfo: finalChangeInfo,
                                // DEBUG: Přidáme všechna surová data pro debugging
                                _rawData: data
                            };

                            timetable.push(lessonData);
                        } catch (e) { }
                    }
                });
            });
        });

        // DEBUG: Uložit všechna data do YAML souboru
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('.')[0];
        const filename = `debug_${type}_${id}_${scheduleType}_${timestamp}.yaml`;
        const debugDir = path.join(__dirname, 'debug_output');

        // Vytvořit debug složku, pokud neexistuje
        //if (!fs.existsSync(debugDir)) {
            //fs.mkdirSync(debugDir);
        //}

        const filepath = path.join(debugDir, filename);

        let yamlContent = `# DEBUG: TIMETABLE DATA\n`;
        yamlContent += `# Type: ${type}\n`;
        yamlContent += `# ID: ${id}\n`;
        yamlContent += `# Schedule: ${scheduleType}\n`;
        yamlContent += `# Date: ${date || 'N/A'}\n`;
        yamlContent += `# Timestamp: ${new Date().toISOString()}\n`;
        yamlContent += `# Total lessons: ${timetable.length}\n\n`;
        yamlContent += `lessons:\n`;

        timetable.forEach((lesson, index) => {
            yamlContent += `  - lesson_number: ${index + 1}\n`;
            yamlContent += `    day: ${lesson.day}\n`;
            yamlContent += `    dayName: "${lesson.dayName}"\n`;
            yamlContent += `    hour: ${lesson.hour}\n`;
            yamlContent += `    subject: "${lesson.subject}"\n`;
            yamlContent += `    teacher: "${lesson.teacher || ''}"\n`;
            yamlContent += `    room: "${lesson.room || ''}"\n`;
            yamlContent += `    group: "${lesson.group || ''}"\n`;
            yamlContent += `    theme: "${lesson.theme || ''}"\n`;
            yamlContent += `    type: "${lesson.type || ''}"\n`;
            yamlContent += `    changed: ${lesson.changed}\n`;

            if (lesson.changeInfo) {
                yamlContent += `    changeInfo:\n`;
                yamlContent += `      raw: "${lesson.changeInfo.raw}"\n`;
                yamlContent += `      description: "${lesson.changeInfo.description}"\n`;
            }

            yamlContent += `    rawData:\n`;
            for (const [key, value] of Object.entries(lesson._rawData)) {
                const safeValue = String(value || '').replace(/"/g, '\\"');
                yamlContent += `      ${key}: "${safeValue}"\n`;
            }
            yamlContent += `\n`;
        });

        //fs.writeFileSync(filepath, yamlContent, 'utf8');
        //console.log(`\n✅ DEBUG: Data uložena do souboru: ${filepath}\n`);

        res.json(timetable);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/definitions', async (req, res) => {
    try {
        const response = await axios.get(`${BASE_URL_TEMPLATE}/Actual/Class/ZL`, { headers });
        const $ = cheerio.load(response.data);
        const data = { classes: [], teachers: [], rooms: [] };

        // Classes
        $('#selectedClass option').each((_, el) => {
            const id = $(el).val();
            const name = $(el).text().trim();
            if (id && name) {
                data.classes.push({ id, name });
            }
        });

        // Teachers - use name as ID if value is empty
        $('#selectedTeacher option').each((_, el) => {
            let id = $(el).val();
            const name = $(el).text().trim();

            // If ID is empty but name exists, use name as ID
            if ((!id || id.trim() === '') && name) {
                id = name;
            }

            if (id && name) {
                data.teachers.push({ id, name });
            }
        });

        // Rooms
        $('#selectedRoom option').each((_, el) => {
            const id = $(el).val();
            const name = $(el).text().trim();
            if (id && name) {
                data.rooms.push({ id, name });
            }
        });

        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// === FIREBASE AUTH ENDPOINT ===
app.post('/api/auth', async (req, res) => {
    try {
        // Generate anonymous user ID (you can make this more sophisticated)
        const userId = req.body.userId || 'anonymous-' + Date.now();

        // Create custom token
        const token = await createCustomToken(userId);

        res.json({ token, userId });
    } catch (error) {
        console.error('Auth error:', error);
        res.status(500).json({ error: 'Failed to generate auth token' });
    }
});

// === MANUAL PREFETCH TRIGGER (for testing) ===
app.post('/api/prefetch/trigger', async (req, res) => {
    try {
        console.log('Manual prefetch triggered via API');
        // Don't await - let it run in background
        triggerManualPrefetch().catch(err => console.error('Manual prefetch error:', err));
        res.json({ message: 'Prefetch started in background', status: 'running' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// === CRON STATUS ENDPOINT ===
app.get('/api/prefetch/status', (req, res) => {
    const status = getCronStatus();
    res.json(status);
});

// === FCM NOTIFICATION ENDPOINTS ===

// Subscribe user device to FCM notifications
app.post('/api/fcm/subscribe', async (req, res) => {
    try {
        const { userId, token } = req.body;

        if (!userId || !token) {
            return res.status(400).json({ error: 'userId and token are required' });
        }

        const db = getFirestore();
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();

        if (userDoc.exists) {
            // Add token to existing user
            const userData = userDoc.data();
            const tokens = userData.tokens || [];

            // Avoid duplicates
            if (!tokens.includes(token)) {
                tokens.push(token);
                await userRef.update({ tokens, lastUpdated: new Date().toISOString() });
            }
        } else {
            // Create new user document
            await userRef.set({
                tokens: [token],
                preferences: {
                    watchedTimetables: []
                },
                createdAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString()
            });
        }

        res.json({ success: true, message: 'Token saved successfully' });

    } catch (error) {
        console.error('FCM subscribe error:', error);
        res.status(500).json({ error: 'Failed to save token' });
    }
});

// Unsubscribe user device from FCM notifications
app.post('/api/fcm/unsubscribe', async (req, res) => {
    try {
        const { userId, token } = req.body;

        if (!userId || !token) {
            return res.status(400).json({ error: 'userId and token are required' });
        }

        const db = getFirestore();
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();

        if (userDoc.exists) {
            const userData = userDoc.data();
            const tokens = userData.tokens || [];

            // Remove token
            const filteredTokens = tokens.filter(t => t !== token);
            await userRef.update({ tokens: filteredTokens, lastUpdated: new Date().toISOString() });

            res.json({ success: true, message: 'Token removed successfully' });
        } else {
            res.status(404).json({ error: 'User not found' });
        }

    } catch (error) {
        console.error('FCM unsubscribe error:', error);
        res.status(500).json({ error: 'Failed to remove token' });
    }
});

// Update user notification preferences (watched timetables)
app.post('/api/fcm/update-preferences', async (req, res) => {
    try {
        const { userId, watchedTimetables } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'userId is required' });
        }

        if (!Array.isArray(watchedTimetables)) {
            return res.status(400).json({ error: 'watchedTimetables must be an array' });
        }

        const db = getFirestore();
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();

        if (userDoc.exists) {
            await userRef.update({
                'preferences.watchedTimetables': watchedTimetables,
                lastUpdated: new Date().toISOString()
            });
        } else {
            // Create new user document with preferences
            await userRef.set({
                tokens: [],
                preferences: {
                    watchedTimetables: watchedTimetables
                },
                createdAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString()
            });
        }

        res.json({ success: true, message: 'Preferences updated successfully' });

    } catch (error) {
        console.error('FCM update preferences error:', error);
        res.status(500).json({ error: 'Failed to update preferences' });
    }
});

// Get user notification preferences
app.get('/api/fcm/preferences/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        const db = getFirestore();
        const userDoc = await db.collection('users').doc(userId).get();

        if (userDoc.exists) {
            const userData = userDoc.data();
            res.json({
                watchedTimetables: userData.preferences?.watchedTimetables || [],
                hasTokens: (userData.tokens || []).length > 0
            });
        } else {
            res.json({
                watchedTimetables: [],
                hasTokens: false
            });
        }

    } catch (error) {
        console.error('FCM get preferences error:', error);
        res.status(500).json({ error: 'Failed to get preferences' });
    }
});

// Manually trigger notification processing (for testing)
app.post('/api/fcm/process-changes', async (req, res) => {
    try {
        console.log('Manual notification processing triggered via API');

        // Run in background
        processPendingChanges().catch(err => console.error('Process changes error:', err));

        res.json({ message: 'Processing started in background', status: 'running' });

    } catch (error) {
        console.error('FCM process changes error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Funkce pro získání lokální IP adresy
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            // Přeskočit interní (localhost) a non-IPv4 adresy
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'IP nenalezena';
}

const PORT = 3000;
const HOST = '0.0.0.0'; // Naslouchá na všech síťových rozhraních
app.listen(PORT, HOST, () => {
    const localIP = getLocalIP();
    console.log(`http://localhost:${PORT}`);
    console.log(`http://${localIP}:${PORT}`);

    // Start cron job for automatic prefetching
    console.log('\n🔄 Starting automatic prefetch cron job...');
    startCronJob();
});