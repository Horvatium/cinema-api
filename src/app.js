// Sestavi aplikacijo Express: vmesna oprema in usmerjevalniki. Strežnika ne
// zažene (to naredi server.js), da jo lahko testi uvozijo brez odprtih vrat.
const express = require('express');
require('dotenv').config();
const fs = require('fs');
const crypto = require('crypto');
const pinoHttp = require('pino-http');
const logger = require('./logger');
const db = require('./db');
const {
    corsMiddleware,
    helmetMiddleware,
    prijavaLimiter,
    registracijaLimiter,
} = require('./security');
const app = express();

// Aplikacija teče za posrednikom (Railway), zato zaupamo glavi
// X-Forwarded-*. Brez tega bi req.protocol vračal "http" (potrditvene
// povezave in naslovi plakatov bi imeli napačno shemo), omejitev zahtevkov
// pa bi vse obiskovalce štela kot en naslov IP posrednika.
app.set('trust proxy', 1);

//Vmesna oprema
// Vsak zahtevek dobi ID (iz glave X-Request-Id ali nov) in se zabeleži z
// metodo, potjo, statusom in trajanjem; req.log nato v zapise napak doda
// isti ID. Preverjanja /health ne beležimo, ker jih Railway kliče pogosto.
app.use(
    pinoHttp({
        logger,
        genReqId: (req, res) => {
            const id = req.headers['x-request-id'] || crypto.randomUUID();
            res.setHeader('X-Request-Id', id);
            return id;
        },
        autoLogging: { ignore: (req) => req.url === '/health' },
        // V zapis gredo le ID, metoda, pot in status; glave (tudi žetoni)
        // in naslovi IP obiskovalcev ne
        serializers: {
            req: (req) => ({ id: req.id, method: req.method, url: req.url }),
            res: (res) => ({ statusCode: res.statusCode }),
        },
    })
);
app.use(helmetMiddleware);
app.use(corsMiddleware);

// Stripov webhook potrebuje surovo telo za preverjanje podpisa, zato je
// registriran pred express.json(), ki bi telo že razčlenil
app.post(
    '/api/payments/webhook',
    express.raw({ type: 'application/json' }),
    require('./routes/webhook')
);

app.use(express.json());

// Disk se priklopi prazen, zato mapo ustvarimo ob zagonu
fs.mkdirSync('uploads/posters', { recursive: true });

// Streži naložene slike s predpomnjenjem
app.use(
    '/uploads',
    express.static('uploads', {
        maxAge: '7d',
        immutable: true,
    })
);

//Poti
const authRoutes = require('./routes/auth');
const filmRoutes = require('./routes/films');
const screeningRoutes = require('./routes/screenings');
const roomRoutes = require('./routes/rooms');
const reservationRoutes = require('./routes/reservations');
const uploadRoutes = require('./routes/upload');
const notificationRoutes = require('./routes/notifications');
const paymentRoutes = require('./routes/payments');
const userRoutes = require('./routes/users');

app.use('/api/payments', paymentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/auth/login', prijavaLimiter);
app.use(['/api/auth/register', '/api/auth/resend-verification'], registracijaLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/films', filmRoutes);
app.use('/api/screenings', screeningRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/users', userRoutes);

//Testiraj pot
app.get('/', (req, res) => {
    res.json({ message: 'Cinema API deluje!' });
});

// Preverjanje delovanja za Railway in Docker: 200 samo, če se API lahko
// poveže z bazo, sicer 503, da platforma ve, da storitev ni zdrava
app.get('/health', async (req, res) => {
    try {
        await db.query('SELECT 1');
        res.json({ status: 'ok', db: 'ok' });
    } catch (err) {
        req.log.error({ err }, 'Preverjanje zdravja: baza ni dosegljiva');
        res.status(503).json({ status: 'napaka', db: 'nedosegljiva' });
    }
});

// Neznane poti vrnejo JSON namesto privzete strani HTML
app.use((req, res) => {
    res.status(404).json({ message: 'Pot ne obstaja.' });
});

// Napake, ki jih poti ne ujamejo same (Express 5 sem posreduje tudi napake
// iz async funkcij), se zabeležijo z ID zahtevka; odjemalec dobi splošno
// sporočilo brez podrobnosti o notranjosti strežnika
app.use((err, req, res, next) => {
    req.log.error(err);
    const status = err.status || err.statusCode || 500;
    res.status(status).json({
        message: status < 500 ? err.message : 'Napaka na strežniku.',
    });
});

module.exports = app;
