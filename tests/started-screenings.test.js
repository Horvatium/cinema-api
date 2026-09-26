// Screening times are the cinema's wall-clock times (Europe/Ljubljana), while
// the production server runs in UTC. A screening that started 30 minutes ago
// in Ljubljana must be treated as started, whatever time zone the server or
// the database uses.
const request = require('supertest');
const app = require('../src/app');
const { resetData } = require('./db-utils');
const { db, bearer, CUSTOMER_ID, seatIds } = require('./helpers');

// Ljubljana wall-clock time `minutes` from now, as stored in the database
const wallClock = (minutes) =>
    new Date(Date.now() + minutes * 60000)
        .toLocaleString('sv-SE', { timeZone: 'Europe/Ljubljana', hour12: false })
        .slice(0, 19);

let startedId;

beforeAll(async () => {
    await resetData();
    const [result] = await db.query(
        'INSERT INTO screenings (film_id, room_id, start_time, end_time, price) VALUES (1, 1, ?, ?, 7.00)',
        [wallClock(-30), wallClock(120)]
    );
    startedId = result.insertId;
});
afterAll(() => db.end());

describe('a screening that started 30 minutes ago', () => {
    it('is not listed in the programme', async () => {
        const res = await request(app).get('/api/screenings');
        expect(res.body.map((s) => s.id)).not.toContain(startedId);
    });

    it('cannot be booked', async () => {
        const seats = await seatIds(1, 'F', [1]);
        const res = await request(app)
            .post('/api/reservations')
            .set(bearer(CUSTOMER_ID))
            .send({ screening_id: startedId, seat_ids: seats });
        expect(res.status).toBe(400);
    });

    it('cannot be paid for', async () => {
        const seats = await seatIds(1, 'F', [2]);
        const res = await request(app)
            .post('/api/payments/create-intent')
            .set(bearer(CUSTOMER_ID))
            .send({ screening_id: startedId, seat_ids: seats });
        expect(res.status).toBe(400);
    });
});
