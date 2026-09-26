const request = require('supertest');
const app = require('../src/app');
const { resetData } = require('./db-utils');
const { db } = require('./helpers');

beforeAll(resetData);
afterAll(() => db.end());

describe('POST /api/auth/login', () => {
    it('returns a JWT for valid credentials', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'demo@kinoplex.test', password: 'Demo123!' });

        expect(res.status).toBe(200);
        expect(res.body.token).toEqual(expect.any(String));
    });

    it('rejects a wrong password with 401', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'demo@kinoplex.test', password: 'wrong' });

        expect(res.status).toBe(401);
        expect(res.body.token).toBeUndefined();
    });

    it('rejects an unknown email with the same 401', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'nobody@kinoplex.test', password: 'Demo123!' });

        expect(res.status).toBe(401);
    });

    it('requires email and password', async () => {
        const res = await request(app).post('/api/auth/login').send({});
        expect(res.status).toBe(400);
    });
});

describe('auth middleware', () => {
    it('returns 401 without a token', async () => {
        const res = await request(app).get('/api/reservations/my');
        expect(res.status).toBe(401);
    });

    it('returns 403 for an invalid token', async () => {
        const res = await request(app)
            .get('/api/reservations/my')
            .set('Authorization', 'Bearer not-a-real-token');
        expect(res.status).toBe(403);
    });
});
