// Stripov webhook payment_intent.succeeded potrdi rezervacijo tudi, če
// brskalnik po plačilu nikoli ne pokliče /api/payments/confirm. Dogodki so
// podpisani s pravim Stripovim algoritmom in testno skrivnostjo.
const request = require('supertest');
const app = require('../src/app');
const { sendReservationConfirmed } = require('../src/email');
const { resetData } = require('./db-utils');
const {
    db,
    bearer,
    ADMIN_ID,
    CUSTOMER_ID,
    screeningAt,
    seatIds,
    activeBookings,
} = require('./helpers');

const stripe = require('stripe')();

beforeEach(async () => {
    await resetData();
    jest.clearAllMocks();
});
afterAll(() => db.end());

// Zadrži sedeže prek API-ja in vrne podatke, ki bi jih Stripe poslal v dogodku
const zadrzi = async (vrsta, sedez, piId) => {
    const screening = await screeningAt(8);
    const seats = await seatIds(screening.room_id, vrsta, [sedez]);
    const res = await request(app)
        .post('/api/payments/create-intent')
        .set(bearer(CUSTOMER_ID))
        .send({ screening_id: screening.id, seat_ids: seats });
    expect(res.status).toBe(200);
    return {
        screening,
        seat: seats[0],
        reservationId: res.body.reservation_id,
        paymentIntent: {
            id: piId,
            object: 'payment_intent',
            status: 'succeeded',
            amount: Math.round(Number(screening.price) * 100),
            metadata: {
                user_id: String(CUSTOMER_ID),
                screening_id: String(screening.id),
                reservation_id: String(res.body.reservation_id),
            },
        },
    };
};

const posljiDogodek = (paymentIntent, { tip = 'payment_intent.succeeded', skrivnost } = {}) => {
    const payload = JSON.stringify({
        id: `evt_${paymentIntent.id}`,
        type: tip,
        data: { object: paymentIntent },
    });
    const podpis = stripe.webhooks.generateTestHeaderString({
        payload,
        secret: skrivnost || process.env.STRIPE_WEBHOOK_SECRET,
    });
    return request(app)
        .post('/api/payments/webhook')
        .set('Content-Type', 'application/json')
        .set('Stripe-Signature', podpis)
        .send(payload);
};

const status = async (reservationId) => {
    const [[r]] = await db.query('SELECT status FROM reservations WHERE id = ?', [reservationId]);
    return r.status;
};

describe('POST /api/payments/webhook', () => {
    it('potrdi zadržanje, ko brskalnik /confirm nikoli ne pokliče', async () => {
        const { reservationId, paymentIntent } = await zadrzi('C', 1, 'pi_wh_1');

        const res = await posljiDogodek(paymentIntent);

        expect(res.status).toBe(200);
        expect(await status(reservationId)).toBe('confirmed');
        expect(sendReservationConfirmed).toHaveBeenCalledTimes(1);
    });

    it('zavrne dogodek z neveljavnim podpisom', async () => {
        const { reservationId, paymentIntent } = await zadrzi('C', 2, 'pi_wh_2');

        const res = await posljiDogodek(paymentIntent, { skrivnost: 'whsec_ponarejena' });

        expect(res.status).toBe(400);
        expect(await status(reservationId)).toBe('pending');
    });

    it('zavrne dogodek brez podpisa', async () => {
        const res = await request(app)
            .post('/api/payments/webhook')
            .set('Content-Type', 'application/json')
            .send(JSON.stringify({ type: 'payment_intent.succeeded' }));

        expect(res.status).toBe(400);
    });

    it('ponovljen dogodek ne pošlje druge e-pošte in ne vrne denarja', async () => {
        const { reservationId, paymentIntent } = await zadrzi('C', 3, 'pi_wh_3');

        await posljiDogodek(paymentIntent);
        const drugic = await posljiDogodek(paymentIntent);

        expect(drugic.status).toBe(200);
        expect(await status(reservationId)).toBe('confirmed');
        expect(sendReservationConfirmed).toHaveBeenCalledTimes(1);
        expect(stripe.refunds.create).not.toHaveBeenCalled();
    });

    it('sočasna webhook in /confirm rezervacijo potrdita samo enkrat', async () => {
        const { screening, reservationId, paymentIntent } = await zadrzi('C', 4, 'pi_wh_4');
        stripe.paymentIntents.retrieve.mockResolvedValue(paymentIntent);

        const [wh, potrditev] = await Promise.all([
            posljiDogodek(paymentIntent),
            request(app)
                .post('/api/payments/confirm')
                .set(bearer(CUSTOMER_ID))
                .send({ payment_intent_id: paymentIntent.id, screening_id: screening.id }),
        ]);

        expect(wh.status).toBe(200);
        expect([200, 201]).toContain(potrditev.status);
        expect(await status(reservationId)).toBe('confirmed');
        expect(sendReservationConfirmed).toHaveBeenCalledTimes(1);
    });

    it('če je sedež medtem prodan, denar vrne natanko enkrat', async () => {
        const { screening, seat, reservationId, paymentIntent } = await zadrzi('C', 5, 'pi_wh_5');
        // Zadržanje poteče, sedež pa kupi nekdo drug
        await db.query(
            'UPDATE reservations SET expires_at = NOW() - INTERVAL 1 MINUTE WHERE id = ?',
            [reservationId]
        );
        const drugi = await request(app)
            .post('/api/reservations')
            .set(bearer(ADMIN_ID))
            .send({ screening_id: screening.id, seat_ids: [seat] });
        expect(drugi.status).toBe(201);

        await posljiDogodek(paymentIntent);
        await posljiDogodek(paymentIntent);

        expect(stripe.refunds.create).toHaveBeenCalledTimes(1);
        expect(stripe.refunds.create).toHaveBeenCalledWith(
            { payment_intent: 'pi_wh_5' },
            { idempotencyKey: 'refund-pi_wh_5' }
        );
        expect(await status(reservationId)).toBe('canceled');
        expect(await activeBookings(screening.id, seat)).toBe(1);
    });

    it('če vračilo spodleti, Stripe dobi 500 in ponovni poskus denar vrne', async () => {
        const { screening, seat, reservationId, paymentIntent } = await zadrzi('C', 6, 'pi_wh_6');
        await db.query(
            'UPDATE reservations SET expires_at = NOW() - INTERVAL 1 MINUTE WHERE id = ?',
            [reservationId]
        );
        await request(app)
            .post('/api/reservations')
            .set(bearer(ADMIN_ID))
            .send({ screening_id: screening.id, seat_ids: [seat] });
        stripe.refunds.create.mockRejectedValueOnce(new Error('Stripe ni dosegljiv'));

        const prvic = await posljiDogodek(paymentIntent);
        expect(prvic.status).toBe(500);
        expect(await status(reservationId)).toBe('pending');

        const drugic = await posljiDogodek(paymentIntent);
        expect(drugic.status).toBe(200);
        expect(await status(reservationId)).toBe('canceled');
        expect(stripe.refunds.create).toHaveBeenCalledTimes(2);
    });

    it('druge vrste dogodkov potrdi brez sprememb', async () => {
        const { reservationId, paymentIntent } = await zadrzi('C', 7, 'pi_wh_7');

        const res = await posljiDogodek(paymentIntent, { tip: 'payment_intent.created' });

        expect(res.status).toBe(200);
        expect(await status(reservationId)).toBe('pending');
    });

    it('brez nastavljene skrivnosti vrne 500', async () => {
        const { paymentIntent } = await zadrzi('C', 8, 'pi_wh_8');
        const skrivnost = process.env.STRIPE_WEBHOOK_SECRET;
        delete process.env.STRIPE_WEBHOOK_SECRET;

        try {
            const res = await posljiDogodek(paymentIntent, { skrivnost });
            expect(res.status).toBe(500);
        } finally {
            process.env.STRIPE_WEBHOOK_SECRET = skrivnost;
        }
    });
});
