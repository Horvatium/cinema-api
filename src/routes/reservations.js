const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { sendReservationConfirmed, sendReservationCancelled } = require('../email');

// Pridobi rezervacije
router.get('/my', auth, async (req, res) => {
    try {
        const [reservations] = await db.query(`
            SELECT 
                reservations.id,
                reservations.reserved_at,
                reservations.status,
                reservations.total_price,
                films.title AS film_title,
                films.poster_url,
                screenings.start_time,
                screenings.end_time,
                rooms.name AS room_name,
                GROUP_CONCAT(
                    CONCAT(seats.row_label, seats.seat_number) 
                    ORDER BY seats.row_label, seats.seat_number
                ) AS seats
            FROM reservations
            JOIN screenings ON reservations.screening_id = screenings.id
            JOIN films ON screenings.film_id = films.id
            JOIN rooms ON screenings.room_id = rooms.id
            LEFT JOIN reservation_seats ON reservations.id = reservation_seats.reservation_id
            LEFT JOIN seats ON reservation_seats.seat_id = seats.id
            WHERE reservations.user_id = ?
            GROUP BY reservations.id
            ORDER BY reservations.reserved_at DESC`, 
            [req.user.id]);

        res.json(reservations);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Napaka na strežniku.' });
    }
});

// Pridobi vse rezervacije (samo admin)
router.get('/', auth, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Samo admin.' });
    }

    try {
        const [reservations] = await db.query(`
            SELECT 
                reservations.id,
                reservations.reserved_at,
                reservations.status,
                reservations.total_price,
                users.first_name,
                users.last_name,
                users.email,
                films.title AS film_title,
                screenings.start_time,
                rooms.name AS room_name,
                GROUP_CONCAT(
                    CONCAT(seats.row_label, seats.seat_number)
                    ORDER BY seats.row_label, seats.seat_number
                ) AS seats
            FROM reservations
            JOIN users ON reservations.user_id = users.id
            JOIN screenings ON reservations.screening_id = screenings.id
            JOIN films ON screenings.film_id = films.id
            JOIN rooms ON screenings.room_id = rooms.id
            LEFT JOIN reservation_seats ON reservations.id = reservation_seats.reservation_id
            LEFT JOIN seats ON reservation_seats.seat_id = seats.id
            GROUP BY reservations.id
            ORDER BY reservations.reserved_at DESC
        `);

        res.json(reservations);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Napaka na strežniku.' });
    }
});

// Ustvari rezervacijo
router.post('/', auth, async (req, res) => {
    const { screening_id, seat_ids } = req.body;

    if (!screening_id || !seat_ids || seat_ids.length === 0) {
        return res.status(400).json({ message: 'Predstava in vsaj en sedež sta potrebna.' });
    }

    // Dobi povezavo iz bazena za transakcijo
    const connection = await db.getConnection();

    try {
        // Začni transakcijo – vse poizvedbe morajo biti uspešne, sicer se nobena ne shrani
        await connection.beginTransaction();

        // Preveri ali obstaja predstava in pridobi ceno
        const [screenings] = await connection.query(
            'SELECT * FROM screenings WHERE id = ?', [screening_id]
        );
        if (screenings.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Predstava ni najdena.' });
        }

        const screening = screenings[0];

        // Preveri če je predstava v prihodnosti
        if (new Date(screening.start_time) < new Date()) {
            await connection.rollback();
            return res.status(400).json({ message: 'Ne morem rezervirati sedežev za preteklo predstavo.' });
        }

        // Preveri ali so vsi zahtevani sedeži na voljo
        const [takenSeats] = await connection.query(`
            SELECT seats.id FROM seats
            JOIN reservation_seats ON seats.id = reservation_seats.seat_id
            JOIN reservations ON reservation_seats.reservation_id = reservations.id
            WHERE reservations.screening_id = ?
            AND reservations.status != 'cancelled'
            AND seats.id IN (?)
        `, [screening_id, seat_ids]);

        if (takenSeats.length > 0) {
            await connection.rollback();
            return res.status(409).json({ message: 'One or more selected seats are already taken.' });
        }

        // Izračunaj končno ceno
        const total_price = screening.price * seat_ids.length;

        // Ustvari rezervacijo
        const [result] = await connection.query(
            'INSERT INTO reservations (user_id, screening_id, status, total_price) VALUES (?, ?, ?, ?)',
            [req.user.id, screening_id, 'confirmed', total_price]
        );

        const reservation_id = result.insertId;

        // Vstavi vsak sedež v reservation_seats
        const seatValues = seat_ids.map(seat_id => [reservation_id, seat_id]);
        await connection.query(
            'INSERT INTO reservation_seats (reservation_id, seat_id) VALUES ?',
            [seatValues]
        );

        // Končaj transakcijo – shrani vse v bazo podatkov
       await connection.commit();

// Fetch details needed for the email
const [emailData] = await db.query(`
    SELECT 
        users.first_name, users.email,
        films.title AS film_title,
        screenings.start_time,
        rooms.name AS room_name,
        GROUP_CONCAT(
            CONCAT(seats.row_label, seats.seat_number)
            ORDER BY seats.row_label, seats.seat_number
        ) AS seat_labels
    FROM reservations
    JOIN users ON reservations.user_id = users.id
    JOIN screenings ON reservations.screening_id = screenings.id
    JOIN films ON screenings.film_id = films.id
    JOIN rooms ON screenings.room_id = rooms.id
    LEFT JOIN reservation_seats ON reservations.id = reservation_seats.reservation_id
    LEFT JOIN seats ON reservation_seats.seat_id = seats.id
    WHERE reservations.id = ?
    GROUP BY reservations.id
`, [reservation_id]);

if (emailData.length > 0) {
    const d = emailData[0];
    sendReservationConfirmed(
        { first_name: d.first_name, email: d.email },
        d.film_title,
        { start_time: d.start_time, room_name: d.room_name },
        d.seat_labels,
        total_price
    );
}

        res.status(201).json({
            message: 'Rezervacija potrjena!',
            reservation_id,
            total_price
        });

    } catch (err) {
        await connection.rollback();
        console.error(err);
        res.status(500).json({ message: 'Napaka na strežniku.' });
    } finally {
        connection.release();
    }
});

//  PREKLIČI REZERVACIJO
router.put('/:id/cancel', auth, async (req, res) => {
    try {
        // Prepričaj se da rezervacija pripada temu uporabniku
        const [reservations] = await db.query(
            'SELECT * FROM reservations WHERE id = ? AND user_id = ?',
            [req.params.id, req.user.id]
        );

        if (reservations.length === 0) {
            return res.status(404).json({ message: 'Rezervacija ni najdena.' });
        }

        if (reservations[0].status === 'cancelled') {
            return res.status(400).json({ message: 'Rezervacija je že preklicana.' });
        }

        await db.query(
    'UPDATE reservations SET status = ? WHERE id = ?',
    ['cancelled', req.params.id]
);

// Fetch details for cancellation email
const [emailData] = await db.query(`
    SELECT
        users.first_name, users.email,
        films.title AS film_title,
        screenings.start_time,
        rooms.name AS room_name
    FROM reservations
    JOIN users ON reservations.user_id = users.id
    JOIN screenings ON reservations.screening_id = screenings.id
    JOIN films ON screenings.film_id = films.id
    JOIN rooms ON screenings.room_id = rooms.id
    WHERE reservations.id = ?
`, [req.params.id]);

if (emailData.length > 0) {
    const d = emailData[0];
    sendReservationCancelled(
        { first_name: d.first_name, email: d.email },
        d.film_title,
        { start_time: d.start_time, room_name: d.room_name }
    );
}


        res.json({ message: 'Rezervacija uspešno preklicana.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Napaka na strežniku.' });
    }
});

module.exports = router;