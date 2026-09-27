const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { validiraj, sheme } = require('../validacija');

// Napravo poveže z uporabnikom: mobilna aplikacija sem pošlje svoj Expov
// žeton, strežnik pa ga uporabi, ko mora poslati potisno obvestilo
// (npr. ob odpovedi predvajanja).
// Shrani žeton za potisna obvestila uporabnika
router.post('/token', auth, validiraj(sheme.zetonObvestil), async (req, res) => {
    const { token } = req.body;

    try {
        // Shrani žeton v tabelo uporabnikov
        await db.query('UPDATE users SET push_token = ? WHERE id = ?', [token, req.user.id]);
        res.json({ message: 'Žeton za potisna obvestila je shranjen.' });
    } catch {
        res.status(500).json({ message: 'Napaka na strežniku.' });
    }
});

module.exports = router;
