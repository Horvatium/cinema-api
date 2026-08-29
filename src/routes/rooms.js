const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

const samoSkrbnik = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Samo skrbniki.' });
    }
    next();
};

// SEZNAM DVORAN
router.get('/', async (req, res) => {
    try {
        const [rooms] = await db.query('SELECT * FROM rooms ORDER BY name');
        res.json(rooms);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Napaka na strežniku.' });
    }
});

// DODAJANJE DVORANE
router.post('/', auth, samoSkrbnik, async (req, res) => {
    const { name, capacity } = req.body;
    if (!name || !capacity) {
        return res.status(400).json({ message: 'Ime in kapaciteta sta obvezna.' });
    }
    try {
        const [result] = await db.query(
            'INSERT INTO rooms (name, capacity) VALUES (?, ?)',
            [name, capacity]
        );
        res.status(201).json({ id: result.insertId, name, capacity });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Napaka na strežniku.' });
    }
});

// UREJANJE DVORANE
router.put('/:id', auth, samoSkrbnik, async (req, res) => {
    const { name, capacity } = req.body;
    try {
        await db.query(
            'UPDATE rooms SET name = COALESCE(?, name), capacity = COALESCE(?, capacity) WHERE id = ?',
            [name, capacity, req.params.id]
        );
        res.json({ message: 'Dvorana posodobljena.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Napaka na strežniku.' });
    }
});

// BRISANJE DVORANE
router.delete('/:id', auth, samoSkrbnik, async (req, res) => {
    try {
        const [screenings] = await db.query(
            'SELECT id FROM screenings WHERE room_id = ? AND active = 1 LIMIT 1',
            [req.params.id]
        );
        if (screenings.length > 0) {
            return res.status(409).json({
                message: 'Dvorane ni mogoče izbrisati, dokler ima aktivna predvajanja.'
            });
        }
        await db.query('DELETE FROM rooms WHERE id = ?', [req.params.id]);
        res.json({ message: 'Dvorana izbrisana.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Napaka na strežniku.' });
    }
});

module.exports = router;