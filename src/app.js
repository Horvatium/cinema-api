// Sestavi aplikacijo Express: vmesna oprema in usmerjevalniki. Strežnika ne
// zažene (to naredi server.js), da jo lahko testi uvozijo brez odprtih vrat.
const express = require('express');
require('dotenv').config();
const fs = require('fs');
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
app.use(helmetMiddleware);
app.use(corsMiddleware);
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

module.exports = app;
