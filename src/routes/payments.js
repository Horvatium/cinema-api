const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const db = require('../db');
const auth = require('../middleware/auth');
const { validiraj, sheme } = require('../validacija');
const { stenskiCasZdaj } = require('../time');
const { preveriSedeze } = require('../seats');
const { potrdiPlacilo, ZASEDENI } = require('../potrditev');

// Koliko minut so sedeži zadržani med plačilom
const ZADRZANJE_MINUT = 10;

// USTVARI NAMERO PLAČILA IN ZADRŽI SEDEŽE
router.post('/create-intent', auth, validiraj(sheme.rezervacija), async (req, res) => {
    const { screening_id, seat_ids } = req.body;

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        // Pridobi ceno predvajanja in zakleni njegovo vrstico do konca
        // transakcije, da se zadržanja sedežev iste predstave izvajajo ena za
        // drugo (glej enak zaklep v reservations.js). Zaklep je prvi korak, da
        // vse poti, ki zasedajo sedeže, zaklepajo v enakem vrstnem redu.
        const [screenings] = await connection.query(
            'SELECT * FROM screenings WHERE id = ? AND active = 1 FOR UPDATE',
            [screening_id]
        );
        if (screenings.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Predvajanje ne obstaja.' });
        }

        // Plačilo za predstavo, ki se je že začela, ni smiselno
        if (new Date(screenings[0].start_time) < stenskiCasZdaj()) {
            await connection.rollback();
            return res.status(400).json({ message: 'Predstava se je že začela.' });
        }

        const napakaSedezev = await preveriSedeze(connection, screenings[0].room_id, seat_ids);
        if (napakaSedezev) {
            await connection.rollback();
            return res.status(400).json({ message: napakaSedezev });
        }

        // Odstrani potekla zadržanja, da se zapisi ne kopičijo
        await connection.query(`
            DELETE reservations, reservation_seats
            FROM reservations
            LEFT JOIN reservation_seats
                ON reservation_seats.reservation_id = reservations.id
            WHERE reservations.status = 'pending'
              AND reservations.expires_at < NOW()
        `);

        // Preveri, ali so sedeži še vedno na voljo
        const [takenSeats] = await connection.query(
            `
            SELECT seats.id FROM seats
            JOIN reservation_seats ON seats.id = reservation_seats.seat_id
            JOIN reservations ON reservation_seats.reservation_id = reservations.id
            WHERE reservations.screening_id = ?
            AND ${ZASEDENI}
            AND seats.id IN (?)
        `,
            [screening_id, seat_ids]
        );

        if (takenSeats.length > 0) {
            await connection.rollback();
            return res.status(409).json({
                message: 'Eden ali več izbranih sedežev je že zaseden.',
            });
        }

        const total_price = screenings[0].price * seat_ids.length;

        // Zadrži sedeže: rezervacija v stanju "pending" z rokom veljavnosti
        const [result] = await connection.query(
            `INSERT INTO reservations
                (user_id, screening_id, status, total_price, expires_at)
             VALUES (?, ?, 'pending', ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
            [req.user.id, screening_id, total_price, ZADRZANJE_MINUT]
        );
        const reservation_id = result.insertId;

        const seatValues = seat_ids.map((seat_id) => [reservation_id, seat_id]);
        await connection.query('INSERT INTO reservation_seats (reservation_id, seat_id) VALUES ?', [
            seatValues,
        ]);

        // Uporabniku vrnemo točen čas izteka zadržanja
        const [[{ expires_at }]] = await connection.query(
            'SELECT expires_at FROM reservations WHERE id = ?',
            [reservation_id]
        );

        // Ustvari namero plačila pri Stripe
        // Znesek mora biti v centih (pomnoženo s 100)
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(total_price * 100),
            currency: 'eur',
            metadata: {
                user_id: req.user.id,
                screening_id,
                reservation_id,
                seat_ids: seat_ids.join(','),
            },
        });

        await connection.commit();

        res.json({
            clientSecret: paymentIntent.client_secret,
            total_price,
            reservation_id,
            expires_at,
            publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
        });
    } catch (err) {
        await connection.rollback();
        req.log.error(err);
        res.status(500).json({ message: 'Plačila ni bilo mogoče ustvariti.' });
    } finally {
        connection.release();
    }
});

// POTRDI PLAČILO IN POTRDI REZERVACIJO
// Brskalnik pokliče to pot takoj po plačilu, da stranka potrditev vidi takoj.
// Isto rezervacijo potrdi tudi Stripov webhook (webhook.js), če se brskalnik
// po plačilu zapre; obe poti uporabljata potrdiPlacilo, ki je idempotentna.
router.post('/confirm', auth, validiraj(sheme.potrditevPlacila), async (req, res) => {
    // Sedeži se preberejo iz zadržanja v bazi, ne iz zahtevka: odjemalec bi
    // sicer lahko poslal druge (proste) sedeže in potrdil zadržanje sedežev,
    // ki jih je medtem kupil nekdo drug
    const { payment_intent_id, screening_id } = req.body;

    try {
        // Preveri, ali je plačilo pri Stripe dejansko uspelo
        const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);

        if (paymentIntent.status !== 'succeeded') {
            return res.status(400).json({ message: 'Plačilo ni bilo uspešno.' });
        }

        // Preveri, ali se metapodatki ujemajo z zahtevo (varnostno preverjanje)
        if (
            paymentIntent.metadata.user_id !== req.user.id.toString() ||
            paymentIntent.metadata.screening_id !== screening_id.toString()
        ) {
            return res.status(403).json({ message: 'Preverjanje plačila ni uspelo.' });
        }

        const { izid, reservationId, totalPrice } = await potrdiPlacilo(paymentIntent, req.log);

        switch (izid) {
            case 'potrjena':
                return res.status(201).json({
                    message: 'Plačilo je uspelo, rezervacija je potrjena!',
                    reservation_id: reservationId,
                    total_price: totalPrice,
                });
            case 'ze_potrjena':
                return res.status(200).json({
                    message: 'Rezervacija je bila že potrjena.',
                    reservation_id: reservationId,
                    total_price: totalPrice,
                });
            case 'zasedeno':
                return res.status(409).json({
                    message:
                        'Sedeži so bili zasedeni medtem, ko ste plačevali. Sredstva so bila vrnjena.',
                });
            case 'preklicana':
                return res.status(409).json({ message: 'Rezervacija je bila preklicana.' });
            default:
                return res.status(409).json({
                    message: 'Rezervacije ni bilo mogoče potrditi. Sredstva so bila vrnjena.',
                });
        }
    } catch (err) {
        req.log.error(err);
        res.status(500).json({ message: 'Napaka na strežniku.' });
    }
});

// PREKLIC ZADRŽANJA — sprosti sedeže, če uporabnik plačilo opusti
router.post('/cancel-intent', auth, validiraj(sheme.preklicZadrzanja), async (req, res) => {
    const { reservation_id } = req.body;

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const [rows] = await connection.query(
            'SELECT * FROM reservations WHERE id = ? FOR UPDATE',
            [reservation_id]
        );

        // Sprostimo lahko samo lastno, še nepotrjeno rezervacijo
        if (rows.length === 0 || rows[0].user_id !== req.user.id || rows[0].status !== 'pending') {
            await connection.rollback();
            return res.status(200).json({ message: 'Ni česa sprostiti.' });
        }

        await connection.query('DELETE FROM reservation_seats WHERE reservation_id = ?', [
            reservation_id,
        ]);
        await connection.query('DELETE FROM reservations WHERE id = ?', [reservation_id]);

        await connection.commit();
        res.json({ message: 'Sedeži so bili sproščeni.' });
    } catch (err) {
        await connection.rollback();
        req.log.error(err);
        res.status(500).json({ message: 'Napaka na strežniku.' });
    } finally {
        connection.release();
    }
});

module.exports = router;
