const request = require('supertest');
const app = require('../src/app');
const { resetData } = require('./db-utils');
const { db, bearer, ADMIN_ID, CUSTOMER_ID, screeningAt, seatIds } = require('./helpers');

beforeAll(resetData);
afterAll(() => db.end());

const reserve = (screeningId, seats, userId = CUSTOMER_ID) =>
    request(app)
        .post('/api/reservations')
        .set(bearer(userId))
        .send({ screening_id: screeningId, seat_ids: seats });

describe('POST /api/reservations', () => {
    it('books free seats and charges the screening price per seat', async () => {
        const screening = await screeningAt(1);
        const seats = await seatIds(screening.room_id, 'A', [1, 2]);

        const res = await reserve(screening.id, seats);

        expect(res.status).toBe(201);
        expect(Number(res.body.total_price)).toBeCloseTo(2 * Number(screening.price));
    });

    it('refuses seats that are already booked', async () => {
        const screening = await screeningAt(1);
        const seats = await seatIds(screening.room_id, 'A', [2, 3]);

        const res = await reserve(screening.id, seats);

        expect(res.status).toBe(409);
    });

    it('refuses seats from the seeded reservation', async () => {
        const screening = await screeningAt(0);
        const seats = await seatIds(screening.room_id, 'D', [5]);

        const res = await reserve(screening.id, seats);

        expect(res.status).toBe(409);
    });

    it('validates the request body', async () => {
        const res = await reserve(undefined, []);
        expect(res.status).toBe(400);
    });

    it('returns 404 for an unknown screening', async () => {
        const res = await reserve(999999, [1]);
        expect(res.status).toBe(404);
    });
});

describe('PUT /api/reservations/:id/cancel', () => {
    it('frees the seats of a cancelled reservation', async () => {
        const screening = await screeningAt(2);
        const seats = await seatIds(screening.room_id, 'B', [4]);

        const first = await reserve(screening.id, seats);
        expect(first.status).toBe(201);

        const cancel = await request(app)
            .put(`/api/reservations/${first.body.reservation_id}/cancel`)
            .set(bearer(CUSTOMER_ID));
        expect(cancel.status).toBe(200);

        const again = await reserve(screening.id, seats);
        expect(again.status).toBe(201);
    });

    it('does not let a user cancel a reservation that is not theirs', async () => {
        const res = await request(app).put('/api/reservations/1/cancel').set(bearer(999));
        expect(res.status).toBe(404);
    });
});

describe('GET /api/reservations', () => {
    it('is only available to admins', async () => {
        const res = await request(app).get('/api/reservations').set(bearer(CUSTOMER_ID));
        expect(res.status).toBe(403);
    });

    it('lists confirmed reservations for an admin', async () => {
        const res = await request(app).get('/api/reservations').set(bearer(ADMIN_ID, 'admin'));
        expect(res.status).toBe(200);
        expect(res.body.length).toBeGreaterThan(0);
    });
});
