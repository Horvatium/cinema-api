const request = require('supertest');
const app = require('../src/app');
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

beforeAll(resetData);
afterAll(() => db.end());

const createIntent = (screeningId, seats) =>
    request(app)
        .post('/api/payments/create-intent')
        .set(bearer(CUSTOMER_ID))
        .send({ screening_id: screeningId, seat_ids: seats });

describe('POST /api/payments/create-intent', () => {
    it('zadrži proste sedeže in vrne Stripov client secret', async () => {
        const screening = await screeningAt(5);
        const seats = await seatIds(screening.room_id, 'A', [1, 2]);

        const res = await createIntent(screening.id, seats);

        expect(res.status).toBe(200);
        expect(res.body.clientSecret).toEqual(expect.any(String));
        expect(Number(res.body.total_price)).toBeCloseTo(2 * Number(screening.price));
    });

    it('zavrne sedež iz druge dvorane', async () => {
        const screening = await screeningAt(5);
        const otherRoom = screening.room_id === 1 ? 2 : 1;
        const seats = await seatIds(otherRoom, 'E', [1]);

        const res = await createIntent(screening.id, seats);

        expect(res.status).toBe(400);
    });

    it('zavrne isti sedež, naveden dvakrat', async () => {
        const screening = await screeningAt(5);
        const [seat] = await seatIds(screening.room_id, 'E', [2]);

        const res = await createIntent(screening.id, [seat, seat]);

        expect(res.status).toBe(400);
    });

    it('zavrne predstavo, ki se je že začela', async () => {
        // Včerajšnja, da izid ni odvisen od časovnega pasu baze
        const [result] = await db.query(
            `INSERT INTO screenings (film_id, room_id, start_time, end_time, price)
             VALUES (1, 1, NOW() - INTERVAL 1 DAY, NOW() - INTERVAL 22 HOUR, 7.00)`
        );
        const seats = await seatIds(1, 'A', [1]);

        const res = await createIntent(result.insertId, seats);

        expect(res.status).toBe(400);
    });
});

describe('POST /api/payments/confirm', () => {
    const stripe = require('stripe')();

    // Stripe za dano zadržanje sporoči uspešno plačilo
    const paid = (reservationId, screeningId, userId = CUSTOMER_ID) =>
        stripe.paymentIntents.retrieve.mockResolvedValue({
            id: 'pi_test',
            status: 'succeeded',
            amount: 700,
            metadata: {
                user_id: String(userId),
                screening_id: String(screeningId),
                reservation_id: String(reservationId),
            },
        });

    const confirm = (screeningId, seats) =>
        request(app)
            .post('/api/payments/confirm')
            .set(bearer(CUSTOMER_ID))
            .send({ payment_intent_id: 'pi_test', screening_id: screeningId, seat_ids: seats });

    beforeEach(() => jest.clearAllMocks());

    it('potrdi plačano zadržanje', async () => {
        const screening = await screeningAt(6);
        const seats = await seatIds(screening.room_id, 'B', [1]);
        const hold = await createIntent(screening.id, seats);
        paid(hold.body.reservation_id, screening.id);

        const res = await confirm(screening.id, seats);

        expect(res.status).toBe(201);
        expect(stripe.refunds.create).not.toHaveBeenCalled();
    });

    it('preveri sedeže iz zadržanja, ne sedežev, ki jih pošlje odjemalec', async () => {
        const screening = await screeningAt(7);
        const [held, other] = await seatIds(screening.room_id, 'B', [2, 3]);

        // Stranka zadrži B2, a zadržanje poteče, preden je plačilo končano ...
        const hold = await createIntent(screening.id, [held]);
        await db.query(
            'UPDATE reservations SET expires_at = NOW() - INTERVAL 1 MINUTE WHERE id = ?',
            [hold.body.reservation_id]
        );
        // ... medtem pa B2 rezervira nekdo drug
        const taken = await request(app)
            .post('/api/reservations')
            .set(bearer(ADMIN_ID))
            .send({ screening_id: screening.id, seat_ids: [held] });
        expect(taken.status).toBe(201);

        // Zahtevek za potrditev navaja drug, prost sedež
        paid(hold.body.reservation_id, screening.id);
        const res = await confirm(screening.id, [other]);

        expect(res.status).toBe(409);
        expect(stripe.refunds.create).toHaveBeenCalledWith(
            { payment_intent: 'pi_test' },
            { idempotencyKey: 'refund-pi_test' }
        );
        expect(await activeBookings(screening.id, held)).toBe(1);
    });
});
