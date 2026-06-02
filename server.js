const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

//Vmesna oprema
app.use(cors());
app.use(express.json());


// Streži naložene slike s predpomnjenjem
app.use('/uploads', express.static('uploads', {
    maxAge: '7d',
    immutable: true
}));

//Poti
const authRoutes = require('./src/routes/auth');
const filmRoutes = require('./src/routes/films');
const screeningRoutes = require('./src/routes/screenings');
const reservationRoutes = require('./src/routes/reservations');
const uploadRoutes = require('./src/routes/upload');
const auth = require('./src/middleware/auth');
const notificationRoutes = require('./src/routes/notifications');
const paymentRoutes = require('./src/routes/payments');

app.use('/api/payments', paymentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/films', filmRoutes);
app.use('/api/screenings', screeningRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/upload', uploadRoutes);


//Testiraj pot
app.get('/', (req, res) => {
    res.json({ message: 'Cinema API deluje!'});
});

//Zaženi strežnik
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Strežnik deluje na portu ${PORT}`);
});