/**
 * Status Routes
 * Provides system health status
 */

const express = require('express');
const { getLastPrefetchStatus } = require('../backend/cron');

const router = express.Router();

/**
 * Get system health status
 * Returns whether Bakalari API is healthy based on last prefetch
 */
router.get('/status', (_req, res) => {
    try {
        const status = getLastPrefetchStatus();
        res.json(status);
    } catch (error) {
        res.status(500).json({
            isHealthy: false,
            error: 'Failed to get status'
        });
    }
});

module.exports = router;
