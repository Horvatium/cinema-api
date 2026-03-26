const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
require('dotenv').config();

// REGISTER
router.post('/register', async (req, res) => {
    const { first_name, last_name, email, password, phone } = req.body;

    // Preveri, ali so vsa obvezna polja izpolnjena
    if (!first_name || !last_name || !email || !password) {
        return res.status(400).json({ message: 'Prosim, izpolnite vsa obvezna polja.'});
    }

    try {
        // Preveri ali je email že registriran
        const [existing] = await db.query(
            'SELECT id FROM users WHERE email = ?', [email]
        );
        if (existing.length > 0) {
            return res.status(409).json({ message: 'Račun s tem email-om že obstaja.'});
        }

        // Hashiraj geslo
        const hashedPassword = await bcrypt.hash(password, 10);

        // Vstavi novega uporabnika v bazo
        const [result] = await db.query(
            'INSERT INTO users (first_name, last_name, email, password, phone) VALUES (?, ?, ?, ?, ?)',
            [first_name, last_name, email, hashedPassword, phone || null]
        );

        // Ustvari žeton za novega uporabnika
        const token = jwt.sign(
            { id: result.insertId, role: 'customer' },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            message: 'Registracija uspešna!',
            token,
            user: {
                id: result.insertId,
                first_name,
                last_name,
                email,
                role: 'customer'
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Napaka na strežniku. Poskusi znova.'});
    }
});

// LOGIN
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Prosim, navedite email in geslo.'});
    }

    try {
        // Poišči uporabnika po email-u
        const [users] = await db.query(
            'SELECT * FROM users WHERE email = ?', [email]
        );
        if (users.length === 0) {
            return res.status(401).json({ message: 'Napačen email ali geslo.' });
        }

        const user = users[0];

        // Primerjaj vneseno geslo z haširanim geslom
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(401).json({ message: 'Napačen email ali geslo.'});
        }

        // Ustvari žeton
        const token = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            message: 'Prijava uspešna!',
            token,
            user: {
                id: user.id,
                first_name: user.first_name,
                last_name: user.last_name,
                email: user.email,
                role: user.role
            }
        });

        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Napaka na strežniku. Poskusi znova.'});
        }
});

module.exports = router;