/**
 * Cron Routes for Vercel Cron Jobs
 * These endpoints are called by Vercel's cron scheduler
 * Protected by CRON_SECRET to prevent unauthorized access
 */

const express = require('express');
const { triggerManualPrefetch } = require('../backend/cron');
const { sendLessonReminders, getPragueTime } = require('../backend/lesson-reminder');

const router = express.Router();

/**
 * Middleware to verify Vercel Cron request
 * Vercel sends Authorization header with CRON_SECRET
 */
function verifyCronRequest(req, res, next) {
    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;

    // If CRON_SECRET is not set, allow request (for local development)
    if (!cronSecret) {
        console.warn('⚠️  CRON_SECRET not set - cron endpoint is unprotected');
        return next();
    }

    // Check if Authorization header matches
    if (authHeader === `Bearer ${cronSecret}`) {
        return next();
    }

    console.error('❌ Unauthorized cron request attempt');
    return res.status(401).json({ error: 'Unauthorized' });
}

/**
 * Prefetch cron endpoint - runs every 10 minutes
 * Called by Vercel Cron (every 10 minutes)
 */
router.get('/prefetch', verifyCronRequest, async (req, res) => {
    try {
        console.log('⏰ Vercel Cron: Prefetch triggered');

        // Start prefetch in background
        triggerManualPrefetch().catch(err =>
            console.error('Cron prefetch error:', err)
        );

        res.json({
            success: true,
            message: 'Prefetch started',
            timestamp: getPragueTime().toISOString()
        });
    } catch (error) {
        console.error('Cron prefetch endpoint error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Lesson reminders cron endpoint - runs every minute
 * Called by Vercel Cron (every minute)
 */
router.get('/lesson-reminders', verifyCronRequest, async (req, res) => {
    try {
        console.log('⏰ Vercel Cron: Lesson reminders triggered');

        // Send lesson reminders
        const result = await sendLessonReminders();

        res.json({
            success: true,
            result: result,
            timestamp: getPragueTime().toISOString()
        });
    } catch (error) {
        console.error('Cron lesson reminders error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
