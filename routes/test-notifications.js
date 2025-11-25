/**
 * Test Notifications Routes
 * Endpoint for testing notification functionality
 */

const express = require('express');
const { getFirestore } = require('../backend/firebase-admin-init');
const { sendNotificationToTokens } = require('../backend/fcm');
const { sendLessonReminders, getNextLessonReminder, getTodayIndex } = require('../backend/lesson-reminder');

const router = express.Router();

const TEST_USER_ID = 'anonymous-1764059732165';

// Simple HTML page with test buttons
router.get('/test-ntf', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Test Notifikací</title>
    <style>
        body { font-family: sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
        button { padding: 10px 20px; margin: 10px 5px; cursor: pointer; font-size: 14px; }
        .info { background: #e3f2fd; padding: 15px; margin: 10px 0; border-radius: 5px; }
        .result { background: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 5px; white-space: pre-wrap; font-family: monospace; font-size: 12px; }
        .success { background: #c8e6c9; }
        .error { background: #ffcdd2; }
        h2 { margin-top: 30px; }
    </style>
</head>
<body>
    <h1>🔔 Test Notifikací</h1>

    <div class="info">
        <strong>Test User ID:</strong> ${TEST_USER_ID}<br>
        <strong>Endpoint:</strong> /api/test-ntf
    </div>

    <h2>1. Debug Info</h2>
    <button onclick="testAction('debug-user')">📋 Zobrazit user data</button>
    <button onclick="testAction('debug-timetable')">📅 Zobrazit rozvrh uživatele</button>
    <button onclick="testAction('debug-upcoming')">⏰ Zkontrolovat nadcházející hodiny</button>

    <h2>2. Test Lesson Reminders</h2>
    <button onclick="testAction('test-reminder')">🔔 Otestovat lesson reminder (nová logika)</button>
    <button onclick="testAction('force-reminder')">⚡ Vynutit odeslání reminder (bypass časové kontroly)</button>

    <h2>3. Obecné Notifikace</h2>
    <button onclick="testAction('test-simple')">📨 Poslat jednoduchou test notifikaci</button>
    <button onclick="testAction('test-change')">🔄 Simulovat notifikaci o změně rozvrhu</button>

    <h2>4. System Status</h2>
    <button onclick="testAction('check-tokens')">🎫 Zkontrolovat FCM tokeny</button>
    <button onclick="testAction('check-preferences')">⚙️ Zkontrolovat preference</button>

    <div id="result"></div>

    <script>
        async function testAction(action) {
            const resultDiv = document.getElementById('result');
            resultDiv.innerHTML = '<div class="result">⏳ Loading...</div>';

            try {
                const response = await fetch('/api/test-ntf/' + action);
                const data = await response.json();

                const className = data.success ? 'result success' : 'result error';
                resultDiv.innerHTML = '<div class="' + className + '">' + JSON.stringify(data, null, 2) + '</div>';
            } catch (error) {
                resultDiv.innerHTML = '<div class="result error">Error: ' + error.message + '</div>';
            }
        }
    </script>
</body>
</html>
    `);
});

// Debug: Show user data
router.get('/test-ntf/debug-user', async (req, res) => {
    try {
        const db = getFirestore();
        const userDoc = await db.collection('users').doc(TEST_USER_ID).get();

        if (!userDoc.exists) {
            return res.json({
                success: false,
                error: 'User not found',
                userId: TEST_USER_ID
            });
        }

        const userData = userDoc.data();
        res.json({
            success: true,
            userId: TEST_USER_ID,
            data: {
                hasTokens: userData.tokens && userData.tokens.length > 0,
                tokensCount: userData.tokens ? userData.tokens.length : 0,
                tokens: userData.tokens || [],
                preferences: userData.preferences,
                createdAt: userData.createdAt,
                lastUpdated: userData.lastUpdated
            }
        });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// Debug: Show user's timetable
router.get('/test-ntf/debug-timetable', async (req, res) => {
    try {
        const db = getFirestore();
        const userDoc = await db.collection('users').doc(TEST_USER_ID).get();

        if (!userDoc.exists) {
            return res.json({ success: false, error: 'User not found' });
        }

        const userData = userDoc.data();
        const watchedTimetables = userData.preferences?.watchedTimetables || [];

        if (watchedTimetables.length === 0) {
            return res.json({
                success: true,
                message: 'User has no watched timetables',
                watchedTimetables: []
            });
        }

        // Get timetable data for each watched timetable
        const timetableData = [];
        for (const watched of watchedTimetables) {
            const docKey = `${watched.type}_${watched.id}_${watched.scheduleType}`;
            const timetableDoc = await db.collection('timetables').doc(docKey).get();

            if (timetableDoc.exists) {
                const data = timetableDoc.data();
                timetableData.push({
                    name: watched.name,
                    type: watched.type,
                    id: watched.id,
                    scheduleType: watched.scheduleType,
                    notificationPreferences: watched.notificationTypes,
                    lessonsCount: data.data ? data.data.length : 0,
                    lastFetched: data.lastFetched
                });
            } else {
                timetableData.push({
                    name: watched.name,
                    type: watched.type,
                    id: watched.id,
                    scheduleType: watched.scheduleType,
                    notificationPreferences: watched.notificationTypes,
                    error: 'Timetable not found in database'
                });
            }
        }

        res.json({
            success: true,
            userId: TEST_USER_ID,
            timetables: timetableData
        });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// Debug: Check upcoming lessons
router.get('/test-ntf/debug-upcoming', async (req, res) => {
    try {
        const upcomingLesson = getNextLessonReminder();
        const todayIndex = getTodayIndex();
        const now = new Date();

        res.json({
            success: true,
            currentTime: now.toLocaleString('cs-CZ'),
            todayIndex: todayIndex,
            dayName: ['Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek'][todayIndex] || 'Víkend',
            upcomingLesson: upcomingLesson || 'No reminder to send at this time',
            note: 'Reminders: 5 min before current lesson ends (next lesson) OR 10 min before first lesson starts'
        });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// Test: Trigger lesson reminder system
router.get('/test-ntf/test-reminder', async (req, res) => {
    try {
        console.log('\n🧪 TEST: Triggering lesson reminder system...');
        const result = await sendLessonReminders();

        res.json({
            success: true,
            result: result,
            note: 'Check server console for detailed logs including debug info for ' + TEST_USER_ID
        });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// Test: Force send reminder (bypass time check)
router.get('/test-ntf/force-reminder', async (req, res) => {
    try {
        const db = getFirestore();
        const userDoc = await db.collection('users').doc(TEST_USER_ID).get();

        if (!userDoc.exists) {
            return res.json({ success: false, error: 'User not found' });
        }

        const userData = userDoc.data();
        const tokens = userData.tokens || [];

        if (tokens.length === 0) {
            return res.json({ success: false, error: 'User has no FCM tokens' });
        }

        // Get first lesson from user's timetable
        const watchedTimetables = userData.preferences?.watchedTimetables || [];
        if (watchedTimetables.length === 0) {
            return res.json({ success: false, error: 'User has no watched timetables' });
        }

        const watched = watchedTimetables[0];
        const docKey = `${watched.type}_${watched.id}_Actual`;
        const timetableDoc = await db.collection('timetables').doc(docKey).get();

        if (!timetableDoc.exists) {
            return res.json({ success: false, error: 'Timetable not found' });
        }

        const lessons = timetableDoc.data().data || [];
        const todayIndex = getTodayIndex();
        const todaysLessons = lessons.filter(l => l.day === todayIndex && l.type !== 'removed');

        if (todaysLessons.length === 0) {
            return res.json({ success: false, error: 'No lessons today' });
        }

        const lesson = todaysLessons[0];

        // Send notification
        const notification = {
            title: `Za 5 minut: ${lesson.subject}`,
            body: `${lesson.room || '?'} • ${lesson.subject} • ${lesson.teacher || '?'}`,
            data: {
                type: 'lesson_reminder',
                subject: lesson.subject,
                teacher: lesson.teacher,
                room: lesson.room,
                forced: 'true'
            }
        };

        const result = await sendNotificationToTokens(tokens, notification);

        res.json({
            success: true,
            sent: result.successCount,
            lesson: lesson,
            notification: notification
        });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// Test: Send simple notification
router.get('/test-ntf/test-simple', async (req, res) => {
    try {
        const db = getFirestore();
        const userDoc = await db.collection('users').doc(TEST_USER_ID).get();

        if (!userDoc.exists) {
            return res.json({ success: false, error: 'User not found' });
        }

        const userData = userDoc.data();
        const tokens = userData.tokens || [];

        if (tokens.length === 0) {
            return res.json({ success: false, error: 'User has no FCM tokens' });
        }

        const notification = {
            title: '🧪 Test Notifikace',
            body: 'Toto je testovací notifikace z /api/test-ntf',
            data: {
                type: 'test',
                timestamp: new Date().toISOString()
            }
        };

        const result = await sendNotificationToTokens(tokens, notification);

        res.json({
            success: true,
            sent: result.successCount,
            failed: result.failureCount,
            tokens: tokens.length
        });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// Test: Simulate change notification
router.get('/test-ntf/test-change', async (req, res) => {
    try {
        const db = getFirestore();
        const userDoc = await db.collection('users').doc(TEST_USER_ID).get();

        if (!userDoc.exists) {
            return res.json({ success: false, error: 'User not found' });
        }

        const userData = userDoc.data();
        const tokens = userData.tokens || [];

        if (tokens.length === 0) {
            return res.json({ success: false, error: 'User has no FCM tokens' });
        }

        const notification = {
            title: '🔄 Změna v rozvrhu',
            body: 'Suplování: Matematika (M. Velingerová)',
            data: {
                type: 'timetable_change',
                changeType: 'substitution',
                timestamp: new Date().toISOString()
            }
        };

        const result = await sendNotificationToTokens(tokens, notification);

        res.json({
            success: true,
            sent: result.successCount,
            failed: result.failureCount
        });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// Check tokens
router.get('/test-ntf/check-tokens', async (req, res) => {
    try {
        const db = getFirestore();
        const userDoc = await db.collection('users').doc(TEST_USER_ID).get();

        if (!userDoc.exists) {
            return res.json({ success: false, error: 'User not found' });
        }

        const userData = userDoc.data();
        const tokens = userData.tokens || [];

        res.json({
            success: true,
            userId: TEST_USER_ID,
            tokensCount: tokens.length,
            tokens: tokens,
            hasValidTokens: tokens.length > 0
        });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// Check preferences
router.get('/test-ntf/check-preferences', async (req, res) => {
    try {
        const db = getFirestore();
        const userDoc = await db.collection('users').doc(TEST_USER_ID).get();

        if (!userDoc.exists) {
            return res.json({ success: false, error: 'User not found' });
        }

        const userData = userDoc.data();
        const preferences = userData.preferences || {};
        const watchedTimetables = preferences.watchedTimetables || [];

        // Check if any reminders are enabled
        const remindersStatus = watchedTimetables.map(tt => {
            const reminders = tt.notificationTypes?.reminders || {};
            return {
                timetable: `${tt.name} (${tt.type}/${tt.id})`,
                reminders: reminders,
                hasAnyEnabled: reminders.next_lesson_room || reminders.next_lesson_teacher || reminders.next_lesson_subject
            };
        });

        res.json({
            success: true,
            userId: TEST_USER_ID,
            watchedTimetables: watchedTimetables.length,
            remindersStatus: remindersStatus,
            globalNotifications: preferences.notificationTypes || {}
        });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

module.exports = router;
