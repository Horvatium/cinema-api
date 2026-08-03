const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// PRIDOBI VSE FILME
router.get('/', async (req, res) => {
    try {
        const [films] = await db.query('SELECT * FROM films ORDER BY title ASC');
        res.json(films);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Napaka na strežniku.'});
    }
});

// PRIDOBI EN FILM
router.get('/:id', async (req, res) => {
    try {
        const [films] = await db.query(
            'SELECT * FROM films WHERE id = ?', [req.params.id]
        );
        if (films.length === 0) {
            return res.status(404).json({ message: 'Film ni najden.' });
        }
        res.json(films[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Napaka na strežniku.' });
    }
});

// DODAJ FIM (samo admin)
router.post('/', auth, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Samo skrbniki.' });
    }

    const { title, genre, duration_minutes, age_rating, synopsis, director, release_year, poster_url, imdb_url, trailer_url, cast_members } = req.body;

    if (!title || !genre || !duration_minutes || !age_rating) {
        return res.status(400).json({ message: 'Potrebni so: naslov, žanr, dolžina filma in starostna ocena.' });
    }

    try {
        const [result] = await db.query(
            'INSERT INTO films (title, genre, duration_minutes, age_rating, synopsis, director, release_year, poster_url, imdb_url, trailer_url, cast_members) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [title, genre, duration_minutes, age_rating, synopsis || null, director || null, release_year || null, poster_url || null,
            imdb_url || null, trailer_url || null, cast_members || null]
        );
        res.status(201).json({ message: 'Film dodan uspešno!', id: result.insertId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Napaka na strežniku.' });
    }
});

// UREDI FILM (samo admin)
router.put('/:id', auth, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Samo skrbniki.' });
    }

    const { title, genre, duration_minutes, age_rating, synopsis, director, release_year, poster_url, imdb_url,
        trailer_url, cast_members } = req.body;

    try {
        const [result] = await db.query(
            `UPDATE films SET 
                title = COALESCE(?, title),
                genre = COALESCE(?, genre),
                duration_minutes = COALESCE(?, duration_minutes),
                age_rating = COALESCE(?, age_rating),
                synopsis = COALESCE(?, synopsis),
                director = COALESCE(?, director),
                release_year = COALESCE(?, release_year),
                poster_url = COALESCE(?, poster_url),
                imdb_url = COALESCE(?, imdb_url),
                trailer_url = COALESCE(?, trailer_url),
                cast_members = COALESCE(?, cast_members)
             WHERE id = ?`,
            [title, genre, duration_minutes, age_rating, synopsis, director, release_year, poster_url, imdb_url, trailer_url, cast_members, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Film ni najden.' });
        }
        res.json({ message: 'Film uspešno posodobljen!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Napaka na strežniku.' });
    }
});

// ZBRIŠI FILM (samo admin)
router.delete('/:id', auth, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Samo skrbniki.' });
    }

    try {
        const [result] = await db.query(
            'DELETE FROM films WHERE id = ?', [req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Film ni najden.' });
        }
        res.json({ message: 'Film izbrisan uspešno!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Napaka na strežniku.' });
    }
});

module.exports = router;
