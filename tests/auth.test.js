const request = require('supertest');
const app = require('../src/app');
const { resetData } = require('./db-utils');
const { db } = require('./helpers');

beforeAll(resetData);
afterAll(() => db.end());

describe('POST /api/auth/login', () => {
    it('za pravilne podatke vrne JWT', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'demo@kinoplex.test', password: 'Demo123!' });

        expect(res.status).toBe(200);
        expect(res.body.token).toEqual(expect.any(String));
    });

    it('napačno geslo zavrne s 401', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'demo@kinoplex.test', password: 'wrong' });

        expect(res.status).toBe(401);
        expect(res.body.token).toBeUndefined();
    });

    it('neznan e-poštni naslov zavrne z enakim 401', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'nobody@kinoplex.test', password: 'Demo123!' });

        expect(res.status).toBe(401);
    });

    it('zahteva e-poštni naslov in geslo', async () => {
        const res = await request(app).post('/api/auth/login').send({});
        expect(res.status).toBe(400);
    });
});

describe('vmesna oprema auth', () => {
    it('brez žetona vrne 401', async () => {
        const res = await request(app).get('/api/reservations/my');
        expect(res.status).toBe(401);
    });

    it('za neveljaven žeton vrne 403', async () => {
        const res = await request(app)
            .get('/api/reservations/my')
            .set('Authorization', 'Bearer not-a-real-token');
        expect(res.status).toBe(403);
    });
});
