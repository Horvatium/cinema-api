// Časi predstav so stenski časi kina (Europe/Ljubljana), produkcijski strežnik
// pa teče v UTC. Predstava, ki se je v Ljubljani začela pred 30 minutami, mora
// veljati za začeto ne glede na časovni pas strežnika ali baze.
const request = require('supertest');
const app = require('../src/app');
const { resetData } = require('./db-utils');
const { db, bearer, CUSTOMER_ID, seatIds } = require('./helpers');

// Stenski čas v Ljubljani čez `minutes` minut, kot je zapisan v bazi
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

describe('predstava, ki se je začela pred 30 minutami', () => {
    it('ni v sporedu', async () => {
        const res = await request(app).get('/api/screenings');
        expect(res.body.map((s) => s.id)).not.toContain(startedId);
    });

    it('je ni mogoče rezervirati', async () => {
        const seats = await seatIds(1, 'F', [1]);
        const res = await request(app)
            .post('/api/reservations')
            .set(bearer(CUSTOMER_ID))
            .send({ screening_id: startedId, seat_ids: seats });
        expect(res.status).toBe(400);
    });

    it('je ni mogoče plačati', async () => {
        const seats = await seatIds(1, 'F', [2]);
        const res = await request(app)
            .post('/api/payments/create-intent')
            .set(bearer(CUSTOMER_ID))
            .send({ screening_id: startedId, seat_ids: seats });
        expect(res.status).toBe(400);
    });
});
