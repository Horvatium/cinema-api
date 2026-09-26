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
    it('rezervira proste sedeže in zaračuna ceno predstave na sedež', async () => {
        const screening = await screeningAt(1);
        const seats = await seatIds(screening.room_id, 'A', [1, 2]);

        const res = await reserve(screening.id, seats);

        expect(res.status).toBe(201);
        expect(Number(res.body.total_price)).toBeCloseTo(2 * Number(screening.price));
    });

    it('zavrne že rezervirane sedeže', async () => {
        const screening = await screeningAt(1);
        const seats = await seatIds(screening.room_id, 'A', [2, 3]);

        const res = await reserve(screening.id, seats);

        expect(res.status).toBe(409);
    });

    it('zavrne sedeže iz rezervacije v seedu', async () => {
        const screening = await screeningAt(0);
        const seats = await seatIds(screening.room_id, 'D', [5]);

        const res = await reserve(screening.id, seats);

        expect(res.status).toBe(409);
    });

    it('preveri vsebino zahtevka', async () => {
        const res = await reserve(undefined, []);
        expect(res.status).toBe(400);
    });

    it('za neznano predstavo vrne 404', async () => {
        const res = await reserve(999999, [1]);
        expect(res.status).toBe(404);
    });

    it('zavrne sedež iz druge dvorane', async () => {
        const screening = await screeningAt(1);
        const otherRoom = screening.room_id === 1 ? 2 : 1;
        const seats = await seatIds(otherRoom, 'E', [1]);

        const res = await reserve(screening.id, seats);

        expect(res.status).toBe(400);
    });

    it('zavrne isti sedež, naveden dvakrat', async () => {
        const screening = await screeningAt(1);
        const [seat] = await seatIds(screening.room_id, 'E', [2]);

        const res = await reserve(screening.id, [seat, seat]);

        expect(res.status).toBe(400);
    });
});

describe('PUT /api/reservations/:id/cancel', () => {
    it('preklic rezervacije sprosti sedeže', async () => {
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

    it('uporabnik ne more preklicati tuje rezervacije', async () => {
        const res = await request(app).put('/api/reservations/1/cancel').set(bearer(999));
        expect(res.status).toBe(404);
    });
});

describe('GET /api/reservations', () => {
    it('je na voljo samo skrbnikom', async () => {
        const res = await request(app).get('/api/reservations').set(bearer(CUSTOMER_ID));
        expect(res.status).toBe(403);
    });

    it('skrbniku vrne potrjene rezervacije', async () => {
        const res = await request(app).get('/api/reservations').set(bearer(ADMIN_ID, 'admin'));
        expect(res.status).toBe(200);
        expect(res.body.length).toBeGreaterThan(0);
    });
});
