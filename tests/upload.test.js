// Nalaganje plakatov: veljavne slike, napačne vrste in napaka pri zapisu na disk
const fs = require('fs');
const path = require('path');
const { PassThrough } = require('stream');
const request = require('supertest');
const app = require('../src/app');
const { db, bearer, ADMIN_ID, CUSTOMER_ID } = require('./helpers');

const skrbnik = bearer(ADMIN_ID, 'admin');
// Datoteka z glavo PNG; pot preverja le začetne bajte
const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(32),
]);
const nalozeno = [];

afterEach(() => jest.restoreAllMocks());
afterAll(async () => {
    nalozeno.forEach((f) => fs.rmSync(f, { force: true }));
    await db.end();
});

const nalozi = (glava, vsebina, ime, tip) =>
    request(app)
        .post('/api/upload/poster')
        .set(glava)
        .attach('poster', vsebina, { filename: ime, contentType: tip });

describe('POST /api/upload/poster', () => {
    it('shrani sliko PNG in vrne njen naslov', async () => {
        const res = await nalozi(skrbnik, png, 'plakat.png', 'image/png');

        expect(res.status).toBe(200);
        expect(res.body.url).toMatch(/\/uploads\/posters\/\d+\.png$/);
        const datoteka = path.join('uploads/posters', path.basename(res.body.url));
        nalozeno.push(datoteka);
        expect(fs.existsSync(datoteka)).toBe(true);
    });

    it('zavrne datoteko, ki ni slika', async () => {
        const res = await nalozi(skrbnik, Buffer.from('ni slika'), 'plakat.txt', 'text/plain');

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Dovoljene so samo slike JPG, PNG in WEBP.');
    });

    it('zavrne datoteko s pripono .png, ki ni prava slika', async () => {
        const res = await nalozi(skrbnik, Buffer.from('ponarejeno'), 'plakat.png', 'image/png');

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Datoteka ni veljavna slika.');
    });

    it('ob napaki pri zapisu na disk vrne 500 brez notranjih poti', async () => {
        // Kot na disku v lasti root: zapis se ne posreči (EACCES)
        jest.spyOn(fs, 'createWriteStream').mockImplementationOnce(() => {
            const tok = new PassThrough();
            process.nextTick(() =>
                tok.emit(
                    'error',
                    Object.assign(
                        new Error("EACCES: permission denied, open 'uploads/posters/x.png'"),
                        {
                            code: 'EACCES',
                        }
                    )
                )
            );
            return tok;
        });

        const res = await nalozi(skrbnik, png, 'plakat.png', 'image/png');

        expect(res.status).toBe(500);
        expect(res.body.message).toBe('Slike ni bilo mogoče shraniti.');
        expect(JSON.stringify(res.body)).not.toContain('uploads');
    });

    it('stranka ne sme nalagati', async () => {
        const res = await nalozi(bearer(CUSTOMER_ID), png, 'plakat.png', 'image/png');
        expect(res.status).toBe(403);
    });
});
