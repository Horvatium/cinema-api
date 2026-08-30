const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// PRIDOBI VSE UPORABNIKE (samo admin)
router.get('/', auth, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Samo admin.' });
    }

    try {
        const [users] = await db.query(
            `SELECT id, first_name, last_name, email, phone, role, email_verified, created_at
             FROM users
             ORDER BY created_at DESC`
        );
        res.json(users);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Napaka na strežniku.' });
    }
});

// ZBRIŠI UPORABNIKA (samo admin)
router.delete('/:id', auth, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Samo admin.' });
    }

    const targetId = Number(req.params.id);

    // Skrbnik ne more izbrisati samega sebe
    if (targetId === req.user.id) {
        return res.status(400).json({ message: 'Svojega računa ne morete izbrisati.' });
    }

    try {
        const [target] = await db.query('SELECT role FROM users WHERE id = ?', [targetId]);
        if (target.length === 0) {
            return res.status(404).json({ message: 'Uporabnik ni najden.' });
        }

        // Če gre za skrbniški račun, preveri, da ni zadnji
        if (target[0].role === 'admin') {
            const [admins] = await db.query(
                `SELECT COUNT(*) AS count FROM users WHERE role = 'admin'`
            );
            if (admins[0].count <= 1) {
                return res.status(400).json({ message: 'Zadnjega skrbniškega računa ni mogoče izbrisati.' });
            }
        }

        const [result] = await db.query('DELETE FROM users WHERE id = ?', [targetId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Uporabnik ni najden.' });
        }
        res.json({ message: 'Uporabnik uspešno izbrisan!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Napaka na strežniku.' });
    }
});

module.exports = router;