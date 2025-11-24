/**
 * Prefetch Routes
 * Handles manual prefetch triggers and status
 */

const express = require('express');
const { triggerManualPrefetch, getCronStatus } = require('../backend/cron');

const router = express.Router();

// Manual prefetch trigger
router.post('/trigger', async (req, res) => {
    try {
        console.log('Manual prefetch triggered via API');
        triggerManualPrefetch().catch(err => console.error('Manual prefetch error:', err));
        res.json({ message: 'Prefetch started in background', status: 'running' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Cron status endpoint
router.get('/status', (req, res) => {
    const status = getCronStatus();
    res.json(status);
});

module.exports = router;
