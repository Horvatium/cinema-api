const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const db = require('../db');
const auth = require('../middleware/auth');

// ─── CREATE PAYMENT INTENT ────────────────────────────────────────────────────
router.post('/create-intent', auth, async (req, res) => {
    const { screening_id, seat_ids } = req.body;

    if (!screening_id || !seat_ids || seat_ids.length === 0) {
        return res.status(400).json({ message: 'Screening and seats are required.' });
    }

    try {
        // Get screening price
        const [screenings] = await db.query(
            'SELECT * FROM screenings WHERE id = ?', [screening_id]
        );
        if (screenings.length === 0) {
            return res.status(404).json({ message: 'Screening not found.' });
        }

        // Check seats are still available
        const [takenSeats] = await db.query(`
            SELECT seats.id FROM seats
            JOIN reservation_seats ON seats.id = reservation_seats.seat_id
            JOIN reservations ON reservation_seats.reservation_id = reservations.id
            WHERE reservations.screening_id = ?
            AND reservations.status != 'cancelled'
            AND seats.id IN (?)
        `, [screening_id, seat_ids]);

        if (takenSeats.length > 0) {
            return res.status(409).json({
                message: 'One or more selected seats are already taken.'
            });
        }

        const total_price = screenings[0].price * seat_ids.length;

        // Create a Stripe payment intent
        // Amount must be in cents (multiply by 100)
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
        res.status(500).json({ message: 'Could not create payment.' });
    }
});

// ─── CONFIRM PAYMENT & CREATE RESERVATION ────────────────────────────────────
router.post('/confirm', auth, async (req, res) => {
    const { payment_intent_id, screening_id, seat_ids } = req.body;

    try {
        // Verify payment actually succeeded with Stripe
        const paymentIntent = await stripe.paymentIntents.retrieve(
            payment_intent_id
        );

        if (paymentIntent.status !== 'succeeded') {
            return res.status(400).json({ message: 'Payment was not successful.' });
        }

        // Verify metadata matches request (security check)
        if (paymentIntent.metadata.user_id !== req.user.id.toString() ||
            paymentIntent.metadata.screening_id !== screening_id.toString()) {
            return res.status(403).json({ message: 'Payment verification failed.' });
        }

        const connection = await db.getConnection();

        try {
            await connection.beginTransaction();

            // Double check seats are still available
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
                // Refund the payment since seats are gone
                await stripe.refunds.create({
                    payment_intent: payment_intent_id
                });
                return res.status(409).json({
                    message: 'Seats were taken while you were paying. A refund has been issued.'
                });
            }

            const total_price = paymentIntent.amount / 100;

            // Create reservation
            const [result] = await connection.query(
                'INSERT INTO reservations (user_id, screening_id, status, total_price) VALUES (?, ?, ?, ?)',
                [req.user.id, screening_id, 'confirmed', total_price]
            );

            const reservation_id = result.insertId;

            // Insert seats
            const seatValues = seat_ids.map(seat_id => [reservation_id, seat_id]);
            await connection.query(
                'INSERT INTO reservation_seats (reservation_id, seat_id) VALUES ?',
                [seatValues]
            );

            await connection.commit();

            res.status(201).json({
                message: 'Payment successful and reservation confirmed!',
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
        res.status(500).json({ message: 'Server error.' });
    }
});

module.exports = router;