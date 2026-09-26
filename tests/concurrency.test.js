// Two customers clicking "book" on the same seat at the same moment must not
// both get it. Each test fires several identical requests in parallel and
// checks that exactly one of them wins the seat.
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

describe('concurrent bookings of the same seat', () => {
    it('POST /api/reservations lets exactly one request win', async () => {
        const screening = await screeningAt(3);
        const [seat] = await seatIds(screening.room_id, 'C', [3]);

        const responses = await fireInParallel('/api/reservations', {
            screening_id: screening.id,
            seat_ids: [seat],
        });

        expect(statuses(responses)).toEqual([201, ...Array(PARALLEL - 1).fill(409)]);
        expect(await activeBookings(screening.id, seat)).toBe(1);
    });

    it('POST /api/payments/create-intent holds the seat for exactly one request', async () => {
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
