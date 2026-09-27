// Validacija vhodnih podatkov (src/validacija.js) na poteh API-ja
const request = require('supertest');
const app = require('../src/app');
const { resetData } = require('./db-utils');
const { db, bearer, ADMIN_ID, CUSTOMER_ID, screeningAt } = require('./helpers');

beforeAll(resetData);
afterAll(() => db.end());

const skrbnik = bearer(ADMIN_ID, 'admin');

describe('oblika napake', () => {
    it('vrne 400 s sporočilom in seznamom neveljavnih polj', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ first_name: 'Ana', email: 'ni-naslov', password: '123' });

        expect(res.status).toBe(400);
        expect(res.body.message).toEqual(expect.any(String));
        expect(res.body.napake.map((n) => n.polje).sort()).toEqual(
            ['email', 'last_name', 'password'].sort()
        );
    });
});

describe('POST /api/auth/register', () => {
    it('sprejme veljavne podatke in e-poštni naslov shrani z malimi črkami', async () => {
        const res = await request(app).post('/api/auth/register').send({
            first_name: ' Nina ',
            last_name: 'Kovač',
            email: ' Nina.Kovac@Primer.SI ',
            password: 'geslo123',
        });

        expect(res.status).toBe(201);
        const [[u]] = await db.query('SELECT first_name, email FROM users WHERE email = ?', [
            'nina.kovac@primer.si',
        ]);
        expect(u).toEqual({ first_name: 'Nina', email: 'nina.kovac@primer.si' });
    });

    it('odvečnih polj ne upošteva (npr. poskusa nastaviti vlogo)', async () => {
        const res = await request(app).post('/api/auth/register').send({
            first_name: 'Vsiljivec',
            last_name: 'Test',
            email: 'vsiljivec@primer.si',
            password: 'geslo123',
            role: 'admin',
        });

        expect(res.status).toBe(201);
        const [[u]] = await db.query('SELECT role FROM users WHERE email = ?', [
            'vsiljivec@primer.si',
        ]);
        expect(u.role).toBe('customer');
    });

    it('zavrne prekratko geslo', async () => {
        const res = await request(app).post('/api/auth/register').send({
            first_name: 'Ana',
            last_name: 'Novak',
            email: 'ana@primer.si',
            password: '12345',
        });

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Geslo mora imeti vsaj 6 znakov.');
    });
});

describe('skrbniške poti', () => {
    it('stranka dobi 403 še pred preverjanjem podatkov', async () => {
        const res = await request(app).post('/api/films').set(bearer(CUSTOMER_ID)).send({});
        expect(res.status).toBe(403);
    });

    it('film z neveljavno dolžino in starostno oceno zavrne', async () => {
        const res = await request(app).post('/api/films').set(skrbnik).send({
            title: 'Test',
            genre: 'Drama',
            duration_minutes: 'dolg',
            age_rating: 'VS',
        });

        expect(res.status).toBe(400);
        expect(res.body.napake.map((n) => n.polje).sort()).toEqual([
            'age_rating',
            'duration_minutes',
        ]);
    });

    it('film iz obrazca (števila kot nizi, prazna polja) sprejme', async () => {
        const res = await request(app).post('/api/films').set(skrbnik).send({
            title: 'Obrazec',
            title_sl: '',
            genre: 'Drama',
            duration_minutes: '95',
            age_rating: '12+',
            release_year: '',
            synopsis: '',
        });

        expect(res.status).toBe(201);
        const [[f]] = await db.query(
            'SELECT duration_minutes, release_year FROM films WHERE id = ?',
            [res.body.id]
        );
        expect(f).toEqual({ duration_minutes: 95, release_year: null });
    });

    it('predstave, ki se konča pred začetkom, ne ustvari', async () => {
        const res = await request(app).post('/api/screenings').set(skrbnik).send({
            film_id: '1',
            room_id: '1',
            start_time: '2030-01-10T20:00',
            end_time: '2030-01-10T18:00',
            price: '7.50',
        });

        expect(res.status).toBe(400);
        expect(res.body.napake[0].polje).toBe('end_time');
    });

    it('delni popravek predstave sprejme samo ceno', async () => {
        const screening = await screeningAt(10);

        const res = await request(app)
            .put(`/api/screenings/${screening.id}`)
            .set(skrbnik)
            .send({ price: '9.90' });

        expect(res.status).toBe(200);
        const [[s]] = await db.query('SELECT price FROM screenings WHERE id = ?', [screening.id]);
        expect(Number(s.price)).toBe(9.9);
    });
});

describe('rezervacije', () => {
    it('zavrne več kot 20 sedežev naenkrat', async () => {
        const screening = await screeningAt(11);
        const res = await request(app)
            .post('/api/reservations')
            .set(bearer(CUSTOMER_ID))
            .send({
                screening_id: screening.id,
                seat_ids: Array.from({ length: 21 }, (_, i) => i + 1),
            });

        expect(res.status).toBe(400);
    });

    it('zavrne sedež, ki ni številka', async () => {
        const screening = await screeningAt(11);
        const res = await request(app)
            .post('/api/reservations')
            .set(bearer(CUSTOMER_ID))
            .send({ screening_id: screening.id, seat_ids: ['A1'] });

        expect(res.status).toBe(400);
        expect(res.body.napake[0].polje).toBe('seat_ids.0');
    });
});
