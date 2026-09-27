// Varnostne glave, CORS in omejitev poskusov prijave. Testi ne potrebujejo
// baze: preverjajo glave odgovora in vmesno opremo v majhni aplikaciji.
const express = require('express');
const request = require('supertest');
const app = require('../src/app');
const { db } = require('./helpers');

afterAll(() => db.end());

describe('varnostne glave (helmet)', () => {
    it('so nastavljene na odgovorih API-ja', async () => {
        const res = await request(app).get('/');

        expect(res.headers['x-content-type-options']).toBe('nosniff');
        expect(res.headers['x-powered-by']).toBeUndefined();
    });

    it('dovolijo prikaz plakatov na spletni strani z drugega izvora', async () => {
        const res = await request(app).get('/');
        expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
    });
});

describe('CORS', () => {
    const izvor = async (origin) =>
        (await request(app).get('/').set('Origin', origin)).headers['access-control-allow-origin'];

    it('dovoli produkcijsko stran', async () => {
        expect(await izvor('https://www.kinoplex.si')).toBe('https://www.kinoplex.si');
    });

    it('dovoli Vercelove predoglede in lokalni razvoj', async () => {
        const predogled = 'https://cinema-web-git-vite-horvatiums-projects.vercel.app';
        expect(await izvor(predogled)).toBe(predogled);
        expect(await izvor('http://localhost:3000')).toBe('http://localhost:3000');
    });

    it('ne dovoli tujih strani', async () => {
        expect(await izvor('https://napadalec.example')).toBeUndefined();
        expect(await izvor('https://cinema-web.vercel.app.napadalec.example')).toBeUndefined();
    });

    it('ne omejuje zahtevkov brez glave Origin (mobilna aplikacija)', async () => {
        const res = await request(app).get('/');
        expect(res.status).toBe(200);
    });
});

describe('omejitev poskusov prijave', () => {
    // Svež modul z nizko mejo, pripet na preprosto pot, ki posnema prijavo
    const aplikacijaZMejo = (meja) => {
        let limiter;
        jest.isolateModules(() => {
            process.env.LOGIN_RATE_LIMIT = String(meja);
            ({ prijavaLimiter: limiter } = require('../src/security'));
            process.env.LOGIN_RATE_LIMIT = '1000';
        });
        const test = express();
        test.use(express.json());
        test.post('/login', limiter, (req, res) =>
            res.status(req.body.geslo === 'pravilno' ? 200 : 401).json({})
        );
        return test;
    };
    const prijava = (a, geslo) => request(a).post('/login').send({ geslo });

    it('po preveč neuspešnih poskusih vrne 429', async () => {
        const a = aplikacijaZMejo(3);
        for (let i = 0; i < 3; i++) expect((await prijava(a, 'narobe')).status).toBe(401);

        const res = await prijava(a, 'narobe');

        expect(res.status).toBe(429);
        expect(res.body.message).toMatch(/Preveč poskusov/);
    });

    it('uspešne prijave se ne štejejo', async () => {
        const a = aplikacijaZMejo(2);
        for (let i = 0; i < 5; i++) expect((await prijava(a, 'pravilno')).status).toBe(200);
        expect((await prijava(a, 'narobe')).status).toBe(401);
    });
});
