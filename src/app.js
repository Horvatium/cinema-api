// Sestavi aplikacijo Express: vmesna oprema in usmerjevalniki. Strežnika ne
// zažene (to naredi server.js), da jo lahko testi uvozijo brez odprtih vrat.
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const fs = require('fs');
const app = express();

//Vmesna oprema
app.use(cors());
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
app.use('/api/auth', authRoutes);
app.use('/api/films', filmRoutes);
app.use('/api/screenings', screeningRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/upload', uploadRoutes);
// Aplikacija teče za posrednikom (Railway), zato zaupamo glavi
// X-Forwarded-Proto. Brez tega bi req.protocol vračal "http" in bi
// potrditvene povezave ter naslovi plakatov nastali z napačno shemo.
app.set('trust proxy', 1);
app.use('/api/users', userRoutes);

//Testiraj pot
app.get('/', (req, res) => {
    res.json({ message: 'Cinema API deluje!' });
});

module.exports = app;
