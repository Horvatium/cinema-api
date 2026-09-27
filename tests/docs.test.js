// Dokumentacija OpenAPI: dostopnost in ujemanje s potmi v kodi
const request = require('supertest');
const app = require('../src/app');
const openapi = require('../src/openapi');
const { db } = require('./helpers');

afterAll(() => db.end());

describe('dokumentacija API-ja', () => {
    it('/api/openapi.json vrne specifikacijo OpenAPI 3.1', async () => {
        const res = await request(app).get('/api/openapi.json');

        expect(res.status).toBe(200);
        expect(res.body.openapi).toBe('3.1.0');
        expect(Object.keys(res.body.paths).length).toBeGreaterThan(20);
    });

    it('/api/docs prikaže Swagger UI', async () => {
        const res = await request(app).get('/api/docs/');

        expect(res.status).toBe(200);
        expect(res.text).toContain('swagger-ui');
    });

    // Vsaka dokumentirana pot mora v API-ju obstajati. Zahtevki so brez
    // prijave in brez telesa, zato ničesar ne spremenijo (vrnejo 400/401).
    const klici = Object.entries(openapi.paths).flatMap(([pot, metode]) =>
        Object.keys(metode)
            .filter((m) => ['get', 'post', 'put', 'delete'].includes(m))
            .map((m) => [m.toUpperCase(), pot])
    );

    it.each(klici)('%s %s obstaja v API-ju', async (metoda, pot) => {
        const url = pot.replace(/\{[^}]+\}/g, '1');

        const res = await request(app)[metoda.toLowerCase()](url);

        expect(res.body?.message).not.toBe('Pot ne obstaja.');
    });
});
