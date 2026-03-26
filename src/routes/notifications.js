const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// Save push token for a user
router.post('/token', auth, async (req, res) => {
    const { token } = req.body;

    if (!token) {
        return res.status(400).json({ message: 'Token is required.' });
    }

    try {
        // Store token in users table
        await db.query(
            'UPDATE users SET push_token = ? WHERE id = ?',
            [token, req.user.id]
        );
        res.json({ message: 'Push token saved.' });
    } catch (_err) {
        res.status(500).json({ message: 'Server error.' });
    }
});

module.exports = router;