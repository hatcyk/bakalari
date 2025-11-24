/**
 * Authentication Routes
 * Handles Firebase authentication
 */

const express = require('express');
const { createCustomToken } = require('../backend/firebase-admin-init');

const router = express.Router();

// Firebase auth endpoint
router.post('/auth', async (req, res) => {
    try {
        const userId = req.body.userId || 'anonymous-' + Date.now();
        const token = await createCustomToken(userId);
        res.json({ token, userId });
    } catch (error) {
        console.error('Auth error:', error);
        res.status(500).json({ error: 'Failed to generate auth token' });
    }
});

module.exports = router;
