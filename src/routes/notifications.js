const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// Shrani žeton za potisna obvestila uporabnika
router.post('/token', auth, async (req, res) => {
    const { token } = req.body;

    if (!token) {
        return res.status(400).json({ message: 'Žeton je obvezen.' });
    }

    try {
        // Shrani žeton v tabelo uporabnikov
        await db.query(
            'UPDATE users SET push_token = ? WHERE id = ?',
            [token, req.user.id]
        );
        res.json({ message: 'Žeton za potisna obvestila je shranjen.' });
    } catch (_err) {
        res.status(500).json({ message: 'Napaka na strežniku.' });
    }
});

module.exports = router;