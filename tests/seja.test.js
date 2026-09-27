// Seja v piškotku httpOnly (spletna aplikacija) in zaščita pred CSRF
const request = require('supertest');
const app = require('../src/app');
const { resetData } = require('./db-utils');
const { db, bearer, CUSTOMER_ID, screeningAt, seatIds } = require('./helpers');

const STRAN = 'https://www.kinoplex.si';

beforeAll(resetData);
afterAll(() => db.end());

// Prijava kot iz brskalnika na kinoplex.si; vrne piškotek seje
const prijava = async () => {
    const res = await request(app)
        .post('/api/auth/login')
        .set('Origin', STRAN)
        .send({ email: 'demo@kinoplex.test', password: 'Demo123!' });
    expect(res.status).toBe(200);
    return res.headers['set-cookie'].find((c) => c.startsWith('kinoplex_seja='));
};
const vrednost = (piskotek) => piskotek.split(';')[0];

describe('prijava', () => {
    it('nastavi piškotek httpOnly s SameSite=Lax in rokom seje', async () => {
        const piskotek = await prijava();

        expect(piskotek).toMatch(/HttpOnly/i);
        expect(piskotek).toMatch(/SameSite=Lax/i);
        expect(piskotek).toMatch(/Path=\//);
        expect(piskotek).toMatch(/Max-Age=28800/);
    });

    it('brskalniku žetona ne vrne v odgovoru (samo v piškotku)', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .set('Origin', STRAN)
            .send({ email: 'demo@kinoplex.test', password: 'Demo123!' });

        expect(res.status).toBe(200);
        expect(res.body.token).toBeUndefined();
        expect(res.body.user.email).toBe('demo@kinoplex.test');
    });

    it('mobilni aplikaciji (brez glave Origin) žeton vrne v odgovoru', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'demo@kinoplex.test', password: 'Demo123!' });

        expect(res.body.token).toEqual(expect.any(String));
    });

    it('vrne rok seje', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'demo@kinoplex.test', password: 'Demo123!' });

        const cez = new Date(res.body.expiresAt).getTime() - Date.now();
        expect(cez).toBeGreaterThan(7.9 * 3600 * 1000);
        expect(cez).toBeLessThanOrEqual(8 * 3600 * 1000);
    });
});

describe('GET /api/auth/me', () => {
    it('s piškotkom vrne prijavljenega uporabnika', async () => {
        const piskotek = await prijava();

        const res = await request(app).get('/api/auth/me').set('Cookie', vrednost(piskotek));

        expect(res.status).toBe(200);
        expect(res.body.user).toMatchObject({ email: 'demo@kinoplex.test', role: 'customer' });
        expect(res.body.user.password).toBeUndefined();
        expect(res.body.expiresAt).toEqual(expect.any(String));
    });

    it('deluje tudi z glavo Authorization (mobilna aplikacija)', async () => {
        const res = await request(app).get('/api/auth/me').set(bearer(CUSTOMER_ID));
        expect(res.status).toBe(200);
    });

    it('brez seje vrne 401', async () => {
        const res = await request(app).get('/api/auth/me');
        expect(res.status).toBe(401);
    });
});

describe('POST /api/auth/logout', () => {
    it('pobriše piškotek seje', async () => {
        const res = await request(app).post('/api/auth/logout').set('Origin', STRAN);

        expect(res.status).toBe(200);
        const piskotek = res.headers['set-cookie'].find((c) => c.startsWith('kinoplex_seja='));
        expect(piskotek).toMatch(/Expires=Thu, 01 Jan 1970/);
    });
});

describe('zaščita pred CSRF', () => {
    const rezerviraj = async (glave) => {
        const screening = await screeningAt(12);
        const [seat] = await seatIds(screening.room_id, 'F', [9]);
        let zahtevek = request(app).post('/api/reservations');
        for (const [k, v] of Object.entries(glave)) zahtevek = zahtevek.set(k, v);
        return zahtevek.send({ screening_id: screening.id, seat_ids: [seat] });
    };

    it('zavrne zahtevek s piškotkom s tuje strani', async () => {
        const piskotek = vrednost(await prijava());

        const res = await rezerviraj({ Cookie: piskotek, Origin: 'https://napadalec.example' });

        expect(res.status).toBe(403);
    });

    it('zavrne zahtevek s piškotkom brez glave Origin', async () => {
        const piskotek = vrednost(await prijava());

        const res = await rezerviraj({ Cookie: piskotek });

        expect(res.status).toBe(403);
    });

    it('sprejme zahtevek s piškotkom s kinoplex.si', async () => {
        const piskotek = vrednost(await prijava());

        const res = await rezerviraj({ Cookie: piskotek, Origin: STRAN });

        expect(res.status).toBe(201);
    });

    it('sprejme zahtevek z glavo Authorization brez Origin (mobilna aplikacija)', async () => {
        const screening = await screeningAt(12);
        const [seat] = await seatIds(screening.room_id, 'F', [10]);

        const res = await request(app)
            .post('/api/reservations')
            .set(bearer(CUSTOMER_ID))
            .send({ screening_id: screening.id, seat_ids: [seat] });

        expect(res.status).toBe(201);
    });

    it('tuja stran ne more prijaviti uporabnika', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .set('Origin', 'https://napadalec.example')
            .send({ email: 'demo@kinoplex.test', password: 'Demo123!' });

        expect(res.status).toBe(403);
        expect(res.headers['set-cookie']).toBeUndefined();
    });

    it('CORS dovoljeni strani dovoli pošiljanje piškotkov', async () => {
        const res = await request(app).get('/api/screenings').set('Origin', STRAN);
        expect(res.headers['access-control-allow-credentials']).toBe('true');
    });
});
