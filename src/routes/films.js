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

// DODAJ FILM (samo admin)
router.post('/', auth, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Samo skrbniki.' });
    }

    const { title, title_sl, genre, duration_minutes, age_rating, synopsis, director, release_year, poster_url, backdrop_url, imdb_url, trailer_url, cast_members } = req.body;

    if (!title || !genre || !duration_minutes || !age_rating) {
        return res.status(400).json({ message: 'Potrebni so: naslov, žanr, dolžina filma in starostna ocena.' });
    }

    try {
        const [result] = await db.query(
            'INSERT INTO films (title, title_sl, genre, duration_minutes, age_rating, synopsis, director, release_year, poster_url, backdrop_url, imdb_url, trailer_url, cast_members) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [title, title_sl || null, genre, duration_minutes, age_rating, synopsis || null, director || null, release_year || null, poster_url || null,
            backdrop_url || null, imdb_url || null, trailer_url || null, cast_members || null]
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

    const { title, title_sl, genre, duration_minutes, age_rating, synopsis, director, release_year, poster_url, backdrop_url, imdb_url,
        trailer_url, cast_members } = req.body;

    try {
        const [result] = await db.query(
            `UPDATE films SET 
                title = COALESCE(?, title),
                title_sl = COALESCE(?, title_sl),
                genre = COALESCE(?, genre),
                duration_minutes = COALESCE(?, duration_minutes),
                age_rating = COALESCE(?, age_rating),
                synopsis = COALESCE(?, synopsis),
                director = COALESCE(?, director),
                release_year = COALESCE(?, release_year),
                poster_url = COALESCE(?, poster_url),
                backdrop_url = COALESCE(?, backdrop_url),
                imdb_url = COALESCE(?, imdb_url),
                trailer_url = COALESCE(?, trailer_url),
                cast_members = COALESCE(?, cast_members)
             WHERE id = ?`,
            [title, title_sl, genre, duration_minutes, age_rating, synopsis, director, release_year, poster_url, backdrop_url, imdb_url, trailer_url, cast_members, req.params.id]
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
        // Preveri, ali ima film aktivna predvajanja — brez tega bi CASCADE
        // brez opozorila izbrisal tudi predvajanja in (morebiti plačane)
        // rezervacije zanje. Skrbnik naj predvajanja najprej izbriše prek
        // screenings.js, ki prizadete stranke o tem obvesti.
        const [screenings] = await db.query(
            'SELECT id FROM screenings WHERE film_id = ? AND active = 1 LIMIT 1',
            [req.params.id]
        );
        if (screenings.length > 0) {
            return res.status(409).json({
                message: 'Filma ni mogoče izbrisati, dokler ima aktivna predvajanja.'
            });
        }

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