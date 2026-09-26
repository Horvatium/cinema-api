const request = require('supertest');
const app = require('../src/app');
const { resetData } = require('./db-utils');
const { db, screeningAt, seatIds } = require('./helpers');

beforeAll(resetData);
afterAll(() => db.end());

describe('GET /api/screenings', () => {
    it('vrne prihodnje predstave s podatki o filmu in dvorani', async () => {
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

describe('časi predstav', () => {
    it('se vrnejo točno tako, kot so shranjeni, ne glede na časovni pas strežnika', async () => {
        const [[stored]] = await db.query(
            "SELECT id, DATE_FORMAT(start_time, '%Y-%m-%dT%H:%i:%s') AS wall FROM screenings ORDER BY id LIMIT 1"
        );

        const res = await request(app).get('/api/screenings');
        const screening = res.body.find((s) => s.id === stored.id);

        // Časi so stenski časi in se pošljejo kot nizi ISO v UTC
        expect(screening.start_time).toBe(`${stored.wall}.000Z`);
    });
});

describe('GET /api/screenings/:id/seats', () => {
    it('sedeže iz rezervacije v seedu označi kot zasedene', async () => {
        const screening = await screeningAt(0);
        const taken = await seatIds(screening.room_id, 'D', [5, 6]);

        const res = await request(app).get(`/api/screenings/${screening.id}/seats`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(60);
        const takenIds = res.body.filter((s) => s.status === 'taken').map((s) => s.id);
        expect(takenIds.sort()).toEqual(taken.sort());
    });

    it('za neznano predstavo vrne 404', async () => {
        const res = await request(app).get('/api/screenings/999999/seats');
        expect(res.status).toBe(404);
    });
});
