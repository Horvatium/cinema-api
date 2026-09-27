// Potrditev plačane rezervacije. Uporabljata jo dve poti, ki lahko prideta
// v poljubnem vrstnem redu ali celo hkrati:
//   - POST /api/payments/confirm, ki ga pokliče brskalnik takoj po plačilu
//   - Stripov webhook payment_intent.succeeded, ki pride tudi, če uporabnik
//     po plačilu zapre brskalnik
// Zato mora biti potrditev idempotentna: drugi klic za isto plačilo ne sme
// znova poslati e-pošte ali znova vrniti denarja.
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const db = require('./db');
const { sendReservationConfirmed } = require('./email');

// Pogoj, ki določa, kateri zapisi sedež dejansko zasedajo
const ZASEDENI = `(reservations.status = 'confirmed'
     OR (reservations.status = 'pending' AND reservations.expires_at > NOW()))`;

// Vrne denar za plačilo. Ključ idempotentnosti zagotovi, da Stripe denar
// vrne le enkrat, tudi če ga zahtevata obe poti.
const vrniDenar = (paymentIntentId) =>
    stripe.refunds.create(
        { payment_intent: paymentIntentId },
        { idempotencyKey: `refund-${paymentIntentId}` }
    );

// Pošlje potrditveno e-sporočilo; napaka pri pošiljanju ne sme vplivati na
// že potrjeno rezervacijo
const posljiPotrditev = async (reservationId, totalPrice, log) => {
    try {
        const [emailData] = await db.query(
            `
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
        `,
            [reservationId]
        );

        if (emailData.length > 0) {
            const d = emailData[0];
            sendReservationConfirmed(
                { first_name: d.first_name, email: d.email },
                d.film_title,
                { start_time: d.start_time, room_name: d.room_name },
                d.seat_labels,
                totalPrice
            );
        }
    } catch (err) {
        log.error({ err, reservationId }, 'Napaka pri pripravi e-sporočila');
    }
};

// Potrdi rezervacijo za uspešno plačilo. paymentIntent mora biti prebran pri
// Stripu (ali iz podpisanega webhooka), zato so njegovi metapodatki zaupanja
// vredni: nastavi jih strežnik v /create-intent.
// Vrne { izid, reservationId, totalPrice }, kjer je izid:
//   'potrjena'     rezervacija je bila pravkar potrjena
//   'ze_potrjena'  rezervacija je bila potrjena že prej (ponovljen klic)
//   'vrnjeno'      zadržanja ni več (poteklo in počiščeno) ali ne pripada
//                  plačniku; denar je vrnjen
//   'zasedeno'     sedeže je medtem kupil nekdo drug; denar je vrnjen
//   'preklicana'   rezervacija je že preklicana (npr. ob prejšnjem vračilu);
//                  ničesar ne spremenimo in denarja ne vračamo znova
const potrdiPlacilo = async (paymentIntent, log) => {
    const reservationId = Number(paymentIntent.metadata.reservation_id);
    const userId = Number(paymentIntent.metadata.user_id);
    const screeningId = Number(paymentIntent.metadata.screening_id);
    const totalPrice = paymentIntent.amount / 100;

    const connection = await db.getConnection();
    let izid;

    try {
        await connection.beginTransaction();

        // Isti vrstni red zaklepanja kot pri zadržanju in rezervaciji (najprej
        // predstava), da se poti ne zakleneta med sabo. Zaklep tudi poskrbi,
        // da se sočasna klica za isto plačilo izvedeta eden za drugim.
        await connection.query('SELECT id FROM screenings WHERE id = ? FOR UPDATE', [screeningId]);
        const [rows] = await connection.query(
            'SELECT * FROM reservations WHERE id = ? FOR UPDATE',
            [reservationId]
        );
        const rezervacija = rows[0];

        if (!rezervacija || rezervacija.user_id !== userId) {
            // Zadržanje je poteklo in bilo počiščeno ali ne pripada plačniku
            izid = 'vrnjeno';
        } else if (rezervacija.status === 'confirmed') {
            izid = 'ze_potrjena';
        } else if (rezervacija.status === 'canceled') {
            izid = 'preklicana';
        } else {
            // Zadržanje je morda poteklo — preveri, ali so njegove sedeže medtem
            // zasedle druge rezervacije
            const [zasedeni] = await connection.query(
                `
                SELECT own.seat_id FROM reservation_seats own
                JOIN reservation_seats other
                    ON other.seat_id = own.seat_id AND other.reservation_id != own.reservation_id
                JOIN reservations ON reservations.id = other.reservation_id
                WHERE own.reservation_id = ?
                AND reservations.screening_id = ?
                AND ${ZASEDENI}
            `,
                [reservationId, rezervacija.screening_id]
            );

            if (zasedeni.length > 0) {
                // Zadržanje prekličemo, da drugi klic ve, da je obdelano. Denar
                // vrnemo še pred commitom: če vračilo spodleti, se preklic
                // razveljavi in ponovni poskus (Stripe webhook ponovi) ga opravi.
                await connection.query(
                    "UPDATE reservations SET status = 'canceled', expires_at = NULL WHERE id = ?",
                    [reservationId]
                );
                await vrniDenar(paymentIntent.id);
                izid = 'zasedeno';
            } else {
                await connection.query(
                    "UPDATE reservations SET status = 'confirmed', expires_at = NULL WHERE id = ?",
                    [reservationId]
                );
                izid = 'potrjena';
            }
        }

        await connection.commit();
    } catch (err) {
        await connection.rollback();
        throw err;
    } finally {
        connection.release();
    }

    // Ostali klici zunanjih storitev so po koncu transakcije, da zaklepi ne
    // čakajo na omrežje. Vračilo ob 'vrnjeno' v bazi ne spremeni ničesar, zato
    // ga ponovni poskus preprosto znova izvede (ključ idempotentnosti).
    if (izid === 'vrnjeno') {
        await vrniDenar(paymentIntent.id);
    }
    if (izid === 'vrnjeno' || izid === 'zasedeno') {
        log.warn({ reservationId, izid }, 'Plačilo ni bilo potrjeno, denar je vrnjen');
    } else if (izid === 'potrjena') {
        await posljiPotrditev(reservationId, totalPrice, log);
        log.info({ reservationId }, 'Rezervacija potrjena');
    }

    return { izid, reservationId, totalPrice };
};

module.exports = { potrdiPlacilo, ZASEDENI };
