const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

//Middleware
app.use(cors());
app.use(express.json());

// Serve uploaded images as static files
app.use('/uploads', express.static('uploads'));

//Routes
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


//Test route
app.get('/', (req, res) => {
    res.json({ message: 'Cinema API deluje!'});
});
app.get('/debug', (req, res) => {
    res.json({
        DB_HOST: process.env.DB_HOST,
        DB_PORT: process.env.DB_PORT,
        DB_USER: process.env.DB_USER,
        DB_NAME: process.env.DB_NAME,
        DB_PASSWORD: process.env.DB_PASSWORD ? 'SET' : 'NOT SET'
    });
});
//Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Strežnik deluje na portu ${PORT}`);
});