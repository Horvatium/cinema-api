const request = require('supertest');
const app = require('../src/app');
const { resetData } = require('./db-utils');
const { db, screeningAt, seatIds } = require('./helpers');

beforeAll(resetData);
afterAll(() => db.end());

describe('GET /api/screenings', () => {
    it('lists upcoming screenings with film and room details', async () => {
        const res = await request(app).get('/api/screenings');

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(28);
        for (const s of res.body) {
            expect(new Date(s.start_time).getTime()).toBeGreaterThan(Date.now());
            expect(s).toEqual(
                expect.objectContaining({
                    film_title: expect.any(String),
                    room_name: expect.any(String),
                })
            );
        }
    });
});

describe('GET /api/screenings/:id/seats', () => {
    it('marks seats held by the seeded reservation as taken', async () => {
        const screening = await screeningAt(0);
        const taken = await seatIds(screening.room_id, 'D', [5, 6]);

        const res = await request(app).get(`/api/screenings/${screening.id}/seats`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(60);
        const takenIds = res.body.filter((s) => s.status === 'taken').map((s) => s.id);
        expect(takenIds.sort()).toEqual(taken.sort());
    });

    it('returns 404 for an unknown screening', async () => {
        const res = await request(app).get('/api/screenings/999999/seats');
        expect(res.status).toBe(404);
    });
});
