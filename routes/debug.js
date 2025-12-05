/**
 * Debug Routes
 * Development/testing endpoints (only available when DEBUG=true)
 */

const express = require('express');
const { getFirestore } = require('../backend/firebase-admin-init');
const { sendNotificationToTokens, processPendingChanges } = require('../backend/fcm');
const { sendLessonReminders } = require('../backend/lesson-reminder');
const { getScheduleStatus } = require('../backend/schedule-calculator');
const { getPragueTimeInfo } = require('../backend/timezone-manager');
const { clearNotificationsForDate } = require('../backend/notification-tracker');

const router = express.Router();
const DEBUG = process.env.DEBUG === 'true';

// Debug middleware
function requireDebugMode(req, res, next) {
    if (!DEBUG) {
        return res.status(403).json({ error: 'Debug mode is not enabled' });
    }
    next();
}

// Get debug status
router.get('/status', (req, res) => {
    res.json({
        debugMode: DEBUG,
        message: DEBUG ? 'Debug mode is enabled' : 'Debug mode is disabled'
    });
});

// Send test notification to ALL users
router.post('/test-notification-all', requireDebugMode, async (req, res) => {
    try {
        const db = getFirestore();
        const usersSnapshot = await db.collection('users').get();

        const allTokens = [];
        usersSnapshot.forEach(userDoc => {
            const userData = userDoc.data();
            if (userData.tokens && userData.tokens.length > 0) {
                allTokens.push(...userData.tokens);
            }
        });

        if (allTokens.length === 0) {
            return res.status(400).json({ error: 'No users with FCM tokens found' });
        }

        const notification = {
            title: '🧪 Testovací notifikace (všichni)',
            body: 'Debug broadcast notifikace pro všechny uživatele!',
            data: {
                type: 'test_broadcast',
                timestamp: new Date().toISOString()
            },
            icon: '/icon-192.png'
        };

        const result = await sendNotificationToTokens(allTokens, notification);

        res.json({
            success: true,
            message: `Test notification sent to ${result.successCount}/${allTokens.length} devices`,
            result: result
        });

    } catch (error) {
        console.error('Test notification all error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Simulate timetable change
router.post('/simulate-change', requireDebugMode, async (req, res) => {
    try {
        const { timetableType, timetableId, timetableName, scheduleType, changeType } = req.body;

        const db = getFirestore();

        let changes = [];

        if (changeType === 'room_change') {
            changes = [
                {
                    type: 'room_change',
                    day: 4,
                    dayName: 'pá',
                    hour: 3,
                    lesson: {
                        subject: 'Matematika',
                        teacher: 'Novák',
                        room: '11',
                        day: 4,
                        hour: 3
                    },
                    change: {
                        field: 'room',
                        oldValue: '08',
                        newValue: '11',
                        type: 'room_change'
                    },
                    description: '🧪 SIMULACE: Změna místnosti: Matematika - 08 → 11',
                    timestamp: new Date().toISOString()
                }
            ];
        } else {
            changes = [
                {
                    type: 'lesson_removed',
                    day: 1,
                    dayName: 'út',
                    hour: 3,
                    lesson: {
                        subject: 'Tělesná výchova',
                        teacher: 'Svobodová',
                        room: 'TV',
                        day: 1,
                        hour: 3
                    },
                    description: '🧪 SIMULACE: Odpadla hodina: Tělesná výchova',
                    timestamp: new Date().toISOString()
                },
                {
                    type: 'substitution',
                    day: 2,
                    dayName: 'st',
                    hour: 2,
                    lesson: {
                        subject: 'Fyzika',
                        teacher: 'Procházková',
                        room: '305',
                        day: 2,
                        hour: 2
                    },
                    change: {
                        field: 'teacher',
                        oldValue: 'Novotný',
                        newValue: 'Procházková',
                        type: 'substitution'
                    },
                    description: '🧪 SIMULACE: Suplování: Fyzika - Novotný → Procházková',
                    timestamp: new Date().toISOString()
                },
                {
                    type: 'room_change',
                    day: 4,
                    dayName: 'pá',
                    hour: 5,
                    lesson: {
                        subject: 'Angličtina',
                        teacher: 'Smith',
                        room: '202',
                        day: 4,
                        hour: 5
                    },
                    change: {
                        field: 'room',
                        oldValue: '201',
                        newValue: '202',
                        type: 'room_change'
                    },
                    description: '🧪 SIMULACE: Změna místnosti: Angličtina - 201 → 202',
                    timestamp: new Date().toISOString()
                }
            ];
        }

        const simulationName = timetableName
            ? `🧪 SIMULACE - ${timetableName}`
            : '🧪 SIMULACE - Testovací třída';

        const fakeChange = {
            timetable: {
                type: timetableType || 'Class',
                id: timetableId || 'TEST',
                name: simulationName,
                scheduleType: scheduleType || 'Actual'
            },
            changes: changes,
            timestamp: new Date().toISOString(),
            sent: false
        };

        const changeRef = await db.collection('changes').add(fakeChange);
        console.log(`✅ Fake change created: ${changeRef.id}`);

        console.log('🔔 Processing fake change and sending notifications...');
        const result = await processPendingChanges();

        res.json({
            success: true,
            message: 'Simulated notification sent',
            changeId: changeRef.id,
            change: fakeChange,
            notificationResult: result
        });

    } catch (error) {
        console.error('Simulate change error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get all users
router.get('/users', requireDebugMode, async (req, res) => {
    try {
        const db = getFirestore();
        const usersSnapshot = await db.collection('users').get();

        const users = [];
        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            users.push({
                userId: doc.id,
                tokenCount: (userData.tokens || []).length,
                tokens: userData.tokens || [],
                watchedTimetables: userData.preferences?.watchedTimetables || [],
                createdAt: userData.createdAt,
                lastUpdated: userData.lastUpdated
            });
        });

        res.json({
            count: users.length,
            users: users
        });

    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get all pending changes
router.get('/pending-changes', requireDebugMode, async (req, res) => {
    try {
        const db = getFirestore();
        const changesSnapshot = await db.collection('changes')
            .where('sent', '==', false)
            .get();

        const changes = [];
        changesSnapshot.forEach(doc => {
            changes.push({
                id: doc.id,
                ...doc.data()
            });
        });

        res.json({
            count: changes.length,
            changes: changes
        });

    } catch (error) {
        console.error('Get pending changes error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Clear all pending changes
router.delete('/clear-changes', requireDebugMode, async (req, res) => {
    try {
        const db = getFirestore();
        const changesSnapshot = await db.collection('changes').get();

        const batch = db.batch();
        changesSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();

        res.json({
            success: true,
            message: `Deleted ${changesSnapshot.size} change document(s)`
        });

    } catch (error) {
        console.error('Clear changes error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get lesson reminder schedule status
router.get('/lesson-reminder-status', requireDebugMode, async (req, res) => {
    try {
        const { time } = req.query;

        // Parse mock time if provided
        const mockTime = time ? new Date(time) : null;

        // Get Prague time info
        const timeInfo = getPragueTimeInfo(mockTime);

        // Get schedule status (requires lessonTimes from lesson-reminder.js)
        const { lessonTimes } = require('../backend/lesson-reminder');
        const scheduleStatus = getScheduleStatus(timeInfo.timeInMinutes, lessonTimes);

        res.json({
            success: true,
            mockTime: mockTime ? mockTime.toISOString() : null,
            pragueTime: timeInfo,
            schedule: scheduleStatus
        });

    } catch (error) {
        console.error('Get lesson reminder status error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Test lesson reminders with mock time
router.get('/test-lesson-reminder', requireDebugMode, async (req, res) => {
    try {
        const { time, dryRun } = req.query;

        // Parse mock time if provided (format: YYYY-MM-DDTHH:mm:ss or just HH:mm)
        let mockTime = null;
        if (time) {
            if (time.includes('T')) {
                // Full ISO format
                mockTime = new Date(time);
            } else if (time.includes(':')) {
                // Just time (HH:mm or HH:mm:ss) - use today's date
                const today = new Date();
                const [hours, minutes, seconds = 0] = time.split(':').map(Number);
                mockTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hours, minutes, seconds);
            } else {
                return res.status(400).json({ error: 'Invalid time format. Use YYYY-MM-DDTHH:mm:ss or HH:mm' });
            }
        }

        // Run lesson reminder logic
        const result = await sendLessonReminders({
            mockTime: mockTime,
            dryRun: dryRun === 'true' || dryRun === '1'
        });

        res.json({
            success: true,
            mockTime: mockTime ? mockTime.toISOString() : null,
            result: result
        });

    } catch (error) {
        console.error('Test lesson reminder error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Clear lesson notification records for a specific date
router.delete('/clear-lesson-notifications', requireDebugMode, async (req, res) => {
    try {
        const { date } = req.query;

        if (!date) {
            return res.status(400).json({ error: 'Date parameter required (format: YYYY-MM-DD)' });
        }

        const deleted = await clearNotificationsForDate(date);

        res.json({
            success: true,
            message: `Cleared ${deleted} notification records for date ${date}`,
            deleted: deleted
        });

    } catch (error) {
        console.error('Clear lesson notifications error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
