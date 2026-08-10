const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const db = require('../db');
const auth = require('../middleware/auth');
const { sendReservationConfirmed } = require('../email');

// USTVARI NAMERO PLAČILA 
router.post('/create-intent', auth, async (req, res) => {
    const { screening_id, seat_ids } = req.body;

    if (!screening_id || !seat_ids || seat_ids.length === 0) {
        return res.status(400).json({ message: 'Predvajanje in sedeži so obvezni.' });
    }

    try {
        // Pridobi ceno predvajanja
        const [screenings] = await db.query(
            'SELECT * FROM screenings WHERE id = ?', [screening_id]
        );
        if (screenings.length === 0) {
            return res.status(404).json({ message: 'Predvajanje ne obstaja.' });
        }

        // Preveri, ali so sedeži še vedno na voljo
        const [takenSeats] = await db.query(`
            SELECT seats.id FROM seats
            JOIN reservation_seats ON seats.id = reservation_seats.seat_id
            JOIN reservations ON reservation_seats.reservation_id = reservations.id
            WHERE reservations.screening_id = ?
            AND (reservations.status = 'confirmed'
     OR (reservations.status = 'pending' AND reservations.expires_at > NOW()))
            AND seats.id IN (?)
        `, [screening_id, seat_ids]);

        if (takenSeats.length > 0) {
            return res.status(409).json({
                message: 'Eden ali več izbranih sedežev je že zaseden.'
            });
        }

        const total_price = screenings[0].price * seat_ids.length;

        // Ustvari namero plačila pri Stripe
        // Znesek mora biti v centih (pomnoženo s 100)
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(total_price * 100),
            currency: 'eur',
            metadata: {
                user_id: req.user.id,
                screening_id,
                seat_ids: seat_ids.join(','),
            }
        });

        res.json({
            clientSecret: paymentIntent.client_secret,
            total_price,
            publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Plačila ni bilo mogoče ustvariti.' });
    }
});

// POTRDI PLAČILO IN USTVARI REZERVACIJO 
router.post('/confirm', auth, async (req, res) => {
    const { payment_intent_id, screening_id, seat_ids } = req.body;

    try {
        // Preveri, ali je plačilo pri Stripe dejansko uspelo
        const paymentIntent = await stripe.paymentIntents.retrieve(
            payment_intent_id
        );

        if (paymentIntent.status !== 'succeeded') {
            return res.status(400).json({ message: 'Plačilo ni bilo uspešno.' });
        }

        // Preveri, ali se metapodatki ujemajo z zahtevo (varnostno preverjanje)
        if (paymentIntent.metadata.user_id !== req.user.id.toString() ||
            paymentIntent.metadata.screening_id !== screening_id.toString()) {
            return res.status(403).json({ message: 'Preverjanje plačila ni uspelo.' });
        }

        const connection = await db.getConnection();

        try {
            await connection.beginTransaction();

            // Ponovno preveri, ali so sedeži še vedno na voljo
            const [takenSeats] = await connection.query(`
                SELECT seats.id FROM seats
                JOIN reservation_seats ON seats.id = reservation_seats.seat_id
                JOIN reservations ON reservation_seats.reservation_id = reservations.id
                WHERE reservations.screening_id = ?
                AND (reservations.status = 'confirmed'
     OR (reservations.status = 'pending' AND reservations.expires_at > NOW()))
                AND seats.id IN (?)
            `, [screening_id, seat_ids]);

            if (takenSeats.length > 0) {
                await connection.rollback();
                // Vrni sredstva, ker sedeži medtem niso več na voljo
                await stripe.refunds.create({
                    payment_intent: payment_intent_id
                });
                return res.status(409).json({
                    message: 'Sedeži so bili zasedeni medtem, ko ste plačevali. Sredstva so bila vrnjena.'
                });
            }

            const total_price = paymentIntent.amount / 100;

            // Ustvari rezervacijo
            const [result] = await connection.query(
                'INSERT INTO reservations (user_id, screening_id, status, total_price) VALUES (?, ?, ?, ?)',
                [req.user.id, screening_id, 'confirmed', total_price]
            );

            const reservation_id = result.insertId;

            // Vstavi sedeže
            const seatValues = seat_ids.map(seat_id => [reservation_id, seat_id]);
            await connection.query(
                'INSERT INTO reservation_seats (reservation_id, seat_id) VALUES ?',
                [seatValues]
            );

            await connection.commit();
// Podatki za potrditveno e-sporočilo
            try {
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

                console.log('emailData rows (payments):', emailData.length);

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
            } catch (mailErr) {
                console.error('Napaka pri pripravi e-sporočila:', mailErr.message);
            }
            res.status(201).json({
                message: 'Plačilo je uspelo, rezervacija je potrjena!',
                reservation_id,
                total_price
            });

        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Napaka na strežniku.' });
    }
});

module.exports = router;
