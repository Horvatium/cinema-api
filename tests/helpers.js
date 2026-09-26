const jwt = require('jsonwebtoken');
const db = require('../src/db');

// Računa iz seeda (glej seed.sql)
const ADMIN_ID = 1;
const CUSTOMER_ID = 2;

const tokenFor = (id, role = 'customer') =>
    jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '1h' });

const bearer = (id, role) => ({ Authorization: `Bearer ${tokenFor(id, role)}` });

// Vrne prihodnjo predstavo po mestu v sporedu (0 = prva)
const screeningAt = async (index) => {
    const [rows] = await db.query(
        'SELECT * FROM screenings ORDER BY start_time, id LIMIT 1 OFFSET ?',
        [index]
    );
    return rows[0];
};

const seatIds = async (roomId, row, numbers) => {
    const [rows] = await db.query(
        'SELECT id FROM seats WHERE room_id = ? AND row_label = ? AND seat_number IN (?) ORDER BY seat_number',
        [roomId, row, numbers]
    );
    return rows.map((r) => r.id);
};

// Koliko aktivnih rezervacij (potrjenih ali veljavnih zadržanj) ima sedež
const activeBookings = async (screeningId, seatId) => {
    const [[{ n }]] = await db.query(
        `SELECT COUNT(*) AS n
         FROM reservation_seats rs
         JOIN reservations r ON r.id = rs.reservation_id
         WHERE r.screening_id = ? AND rs.seat_id = ?
           AND (r.status = 'confirmed' OR (r.status = 'pending' AND r.expires_at > NOW()))`,
        [screeningId, seatId]
    );
    return Number(n);
};

module.exports = {
    ADMIN_ID,
    CUSTOMER_ID,
    tokenFor,
    bearer,
    screeningAt,
    seatIds,
    activeBookings,
    db,
};
