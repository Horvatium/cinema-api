const request = require('supertest');
const app = require('../src/app');
const { db } = require('./helpers');

afterAll(() => db.end());
afterEach(() => jest.restoreAllMocks());

describe('GET /health', () => {
    it('vrne 200, ko je baza dosegljiva', async () => {
        const res = await request(app).get('/health');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ status: 'ok', db: 'ok' });
    });

    it('vrne 503, ko baza ni dosegljiva', async () => {
        jest.spyOn(db, 'query').mockRejectedValueOnce(new Error('ECONNREFUSED'));

        const res = await request(app).get('/health');

        expect(res.status).toBe(503);
        expect(res.body.db).toBe('nedosegljiva');
    });
});

describe('beleženje in napake', () => {
    it('vsak odgovor nosi ID zahtevka, poslani ID pa se ohrani', async () => {
        const nov = await request(app).get('/');
        expect(nov.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);

        const poslan = await request(app).get('/').set('X-Request-Id', 'moj-id-123');
        expect(poslan.headers['x-request-id']).toBe('moj-id-123');
    });

    it('neznana pot vrne 404 v obliki JSON', async () => {
        const res = await request(app).get('/api/ne-obstaja');

        expect(res.status).toBe(404);
        expect(res.body.message).toBe('Pot ne obstaja.');
    });

    it('neveljaven JSON v zahtevku vrne 400, ne 500', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .set('Content-Type', 'application/json')
            .send('{"email": ');

        expect(res.status).toBe(400);
    });
});
