const request = require('supertest');
const app = require('../src/app');
const { resetData } = require('./db-utils');
const { db, bearer, CUSTOMER_ID, screeningAt, seatIds } = require('./helpers');

beforeAll(resetData);
afterAll(() => db.end());

const createIntent = (screeningId, seats) =>
    request(app)
        .post('/api/payments/create-intent')
        .set(bearer(CUSTOMER_ID))
        .send({ screening_id: screeningId, seat_ids: seats });

describe('POST /api/payments/create-intent', () => {
    it('holds free seats and returns a Stripe client secret', async () => {
        const screening = await screeningAt(5);
        const seats = await seatIds(screening.room_id, 'A', [1, 2]);

        const res = await createIntent(screening.id, seats);

        expect(res.status).toBe(200);
        expect(res.body.clientSecret).toEqual(expect.any(String));
        expect(Number(res.body.total_price)).toBeCloseTo(2 * Number(screening.price));
    });

    it('refuses a seat from a different room', async () => {
        const screening = await screeningAt(5);
        const otherRoom = screening.room_id === 1 ? 2 : 1;
        const seats = await seatIds(otherRoom, 'E', [1]);

        const res = await createIntent(screening.id, seats);

        expect(res.status).toBe(400);
    });

    it('refuses the same seat listed twice', async () => {
        const screening = await screeningAt(5);
        const [seat] = await seatIds(screening.room_id, 'E', [2]);

        const res = await createIntent(screening.id, [seat, seat]);

        expect(res.status).toBe(400);
    });

    it('refuses a screening that has already started', async () => {
        const [result] = await db.query(
            `INSERT INTO screenings (film_id, room_id, start_time, end_time, price)
             VALUES (1, 1, NOW() - INTERVAL 1 HOUR, NOW() + INTERVAL 1 HOUR, 7.00)`
        );
        const seats = await seatIds(1, 'A', [1]);

        const res = await createIntent(result.insertId, seats);

        expect(res.status).toBe(400);
    });
});
