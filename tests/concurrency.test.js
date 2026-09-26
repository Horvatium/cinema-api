// Dve stranki, ki v istem trenutku rezervirata isti sedež, ga ne smeta dobiti
// obe. Vsak test hkrati pošlje več enakih zahtevkov in preveri, da sedež dobi
// natanko eden.
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

const PARALLEL = 8;

beforeEach(resetData);
afterAll(() => db.end());

const fireInParallel = (path, body) =>
    Promise.all(
        Array.from({ length: PARALLEL }, (_, i) =>
            request(app)
                .post(path)
                .set(bearer(i % 2 ? CUSTOMER_ID : ADMIN_ID))
                .send(body)
        )
    );

const statuses = (responses) => responses.map((r) => r.status).sort();

describe('sočasne rezervacije istega sedeža', () => {
    it('POST /api/reservations: uspe natanko en zahtevek', async () => {
        const screening = await screeningAt(3);
        const [seat] = await seatIds(screening.room_id, 'C', [3]);

        const responses = await fireInParallel('/api/reservations', {
            screening_id: screening.id,
            seat_ids: [seat],
        });

        expect(statuses(responses)).toEqual([201, ...Array(PARALLEL - 1).fill(409)]);
        expect(await activeBookings(screening.id, seat)).toBe(1);
    });

    it('POST /api/payments/create-intent: sedež zadrži natanko en zahtevek', async () => {
        const screening = await screeningAt(4);
        const [seat] = await seatIds(screening.room_id, 'C', [4]);

        const responses = await fireInParallel('/api/payments/create-intent', {
            screening_id: screening.id,
            seat_ids: [seat],
        });

        expect(statuses(responses)).toEqual([200, ...Array(PARALLEL - 1).fill(409)]);
        expect(await activeBookings(screening.id, seat)).toBe(1);
    });
});
