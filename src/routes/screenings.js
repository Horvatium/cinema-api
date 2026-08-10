const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { sendScreeningDeleted } = require('../email');
const { sendPushNotification } = require('../push');

// Pridobi vse predstave
router.get('/', async (req, res) => {
    try {
        const [screenings] = await db.query(`
            SELECT 
                screenings.id,
                screenings.film_id,
                screenings.room_id,
                screenings.start_time,
                screenings.end_time,
                screenings.price,
                films.title AS film_title,
                films.title_sl AS film_title_sl,
                films.genre,
                films.synopsis,
                films.duration_minutes,
                films.age_rating,
                films.poster_url,
                films.backdrop_url,
                films.director,
                films.release_year,
                films.imdb_url,
                films.trailer_url,
                films.cast_members,
                rooms.name AS room_name,
                rooms.capacity
            FROM screenings
            JOIN films ON screenings.film_id = films.id
            JOIN rooms ON screenings.room_id = rooms.id
            WHERE screenings.start_time > NOW()
            ORDER BY screenings.start_time ASC
        `);
        res.json(screenings);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Napaka na strežniku.' });
    }
});

// PRIDOBI ENO PREDSTAVO Z RAZPOLOŽLJIVIMI SEDEŽI
router.get('/:id/seats', async (req, res) => {
    try {
        const [screening] = await db.query(
            'SELECT * FROM screenings WHERE id = ?', [req.params.id]
        );
        if (screening.length === 0) {
            return res.status(404).json({ message: 'Predstava ni najdena.' });
        }

        // Pridobi vse sedeže za dvorano te predstave
        // in označi, kateri so že rezervirani
        const [seats] = await db.query(`
    SELECT 
        seats.id,
        seats.row_label,
        seats.seat_number,
        CASE 
            WHEN EXISTS (
                SELECT 1
                FROM reservation_seats
                JOIN reservations 
                    ON reservation_seats.reservation_id = reservations.id
                WHERE reservation_seats.seat_id = seats.id
                    AND reservations.screening_id = ?
                    AND (reservations.status = 'confirmed'
                    OR (reservations.status = 'pending' AND reservations.expires_at > NOW()))
            ) THEN 'taken'
            ELSE 'available'
        END AS status
    FROM seats
    WHERE seats.room_id = (
        SELECT room_id FROM screenings WHERE id = ?
    )
    ORDER BY seats.row_label, seats.seat_number
`, [req.params.id, req.params.id]);

        res.json(seats);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Napaka na strežniku.' });
    }
});

// DODAJ PREDSTAVO (samo admin)
router.post('/', auth, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Samo skrbniki.' });
    }

    const { film_id, room_id, start_time, end_time, price } = req.body;

    if (!film_id || !room_id || !start_time || !end_time || !price) {
        return res.status(400).json({ message: 'Vsa polja so obvezna.' });
    }

    try {
        // Preveri ali obstajajo neskladja v urniku za isto dvorano
        const [conflicts] = await db.query(`
            SELECT id FROM screenings 
            WHERE room_id = ?
            AND id != COALESCE(?, 0)
            AND (
                (start_time < ? AND end_time > ?)
            )
        `, [room_id, null, end_time, start_time]);

        if (conflicts.length > 0) {
            return res.status(409).json({ message: 'Ta dvorana je v tem času že rezervirana.' });
        }

        const [result] = await db.query(
            'INSERT INTO screenings (film_id, room_id, start_time, end_time, price) VALUES (?, ?, ?, ?, ?)',
            [film_id, room_id, start_time, end_time, price]
        );
        res.status(201).json({ message: 'Predstava dodana uspešno!', id: result.insertId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Napaka na strežniku.' });
    }
});

// UREDI PREDSTAVO (samo admin)
router.put('/:id', auth, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Samo skrbniki.' });
    }

    const { film_id, room_id, start_time, end_time, price } = req.body;


    try {
        // Preveri ali predstava obstaja
        const [existing] = await db.query(
            'SELECT * FROM screenings WHERE id = ?', [req.params.id]
        );
        if (existing.length === 0) {
            return res.status(404).json({ message: 'Predstava ni najdena.' });
        }

        // Preveri morebitne konflikte, razen trenutne predstave
        if (room_id && start_time && end_time) {
            const [conflicts] = await db.query(`
                SELECT id FROM screenings
                WHERE room_id = ?
                AND id != ?
                AND (start_time < ? AND end_time > ?)
            `, [room_id, req.params.id, end_time, start_time]);

            if (conflicts.length > 0) {
                return res.status(409).json({
                    message: 'Ta dvorana je v tem času že rezervirana.'
                });
            }
        }

        // Preveri, koliko rezervacij obstaja za to predstavo
        const [reservations] = await db.query(`
            SELECT COUNT(*) as count FROM reservations
            WHERE screening_id = ? AND status = 'confirmed'
        `, [req.params.id]);

        await db.query(
            `UPDATE screenings SET
                film_id = COALESCE(?, film_id),
                room_id = COALESCE(?, room_id),
                start_time = COALESCE(?, start_time),
                end_time = COALESCE(?, end_time),
                price = COALESCE(?, price)
             WHERE id = ?`,
            [film_id, room_id, start_time, end_time, price, req.params.id]
        );

        res.json({
            message: 'Predstava uspešno posodobljena!',
            affectedReservations: reservations[0].count
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Napaka na strežniku.' });
    }
});

// ZBRIŠI PREDSTAVO (samo skrbniki)
router.delete('/:id', auth, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Samo skrbniki.' });
    }

    try {
        // Pred brisanjem pridobi podrobnosti predstave in vse prizadete uporabnike
        const [affected] = await db.query(`
            SELECT
                users.first_name, users.email,
                users.push_token,
                films.title AS film_title,
                screenings.start_time,
                rooms.name AS room_name
            FROM reservations
            JOIN users ON reservations.user_id = users.id
            JOIN screenings ON reservations.screening_id = screenings.id
            JOIN films ON screenings.film_id = films.id
            JOIN rooms ON screenings.room_id = rooms.id
            WHERE reservations.screening_id = ?
            AND reservations.status = 'confirmed'
        `, [req.params.id]);

        const [result] = await db.query(
            'DELETE FROM screenings WHERE id = ?', [req.params.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Predstava ni najdena.' });
        }

        // Pošlji e-pošto vsem prizadetim strankam
        affected.forEach(d => {
            sendScreeningDeleted(
                { first_name: d.first_name, email: d.email },
                d.film_title,
                { start_time: d.start_time, room_name: d.room_name }
            );
            // Pošlji potisno obvestilo, če imajo žeton
    if (d.push_token) {
        sendPushNotification(
            d.push_token,
            '⚠️ Predvajanje odpovedano',
            `${d.film_title} on ${new Date(d.start_time)
                .toLocaleDateString('en-GB', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric'
                })} je bilo odpovedano.`,
            { type: 'screening_cancelled' }
        );
    }
        });

        res.json({
            message: `Predstava izbrisana. ${affected.length} uporabnik(ov) obveščenih.`
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Napaka na strežniku.' });
    }
});

module.exports = router;