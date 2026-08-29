const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db');
const { sendVerifyEmail } = require('../email');
require('dotenv').config();

// REGISTRACIJA
router.post('/register', async (req, res) => {
    const { first_name, last_name, email, password, phone } = req.body;

    // Preveri, ali so vsa obvezna polja izpolnjena
    if (!first_name || !last_name || !email || !password) {
        return res.status(400).json({ message: 'Prosim, izpolnite vsa obvezna polja.' });
    }

    try {
        // Preveri, ali je elektronski naslov že registriran
        const [existing] = await db.query(
            'SELECT id FROM users WHERE email = ?', [email]
        );
        if (existing.length > 0) {
            return res.status(409).json({ message: 'Račun s tem elektronskim naslovom že obstaja.' });
        }

        // Zgosti geslo
        const hashedPassword = await bcrypt.hash(password, 10);

        // Enkratni žeton za potrditev naslova
        const verifyToken = crypto.randomBytes(32).toString('hex');

        // Vstavi novega uporabnika v bazo kot še nepotrjenega
        await db.query(
            `INSERT INTO users
                (first_name, last_name, email, password, phone, email_verified, verify_token)
             VALUES (?, ?, ?, ?, ?, 0, ?)`,
            [first_name, last_name, email, hashedPassword, phone || null, verifyToken]
        );

        // Pošlji potrditveno sporočilo
        const link = `${req.protocol}://${req.get('host')}/api/auth/verify/${verifyToken}`;
        sendVerifyEmail({ first_name, email }, link);

        res.status(201).json({
            message: 'Registracija uspešna! Na vaš elektronski naslov smo poslali potrditveno povezavo.',
            requiresVerification: true
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Napaka na strežniku. Poskusite znova.' });
    }
});

// POTRDITEV ELEKTRONSKEGA NASLOVA
router.get('/verify/:token', async (req, res) => {
    try {
        const [result] = await db.query(
            `UPDATE users SET email_verified = 1, verify_token = NULL
             WHERE verify_token = ?`,
            [req.params.token]
        );

        const uspeh = result.affectedRows > 0;
        const naslov = uspeh ? 'Elektronski naslov je potrjen' : 'Povezava ni veljavna';
        const besedilo = uspeh
            ? 'Zdaj se lahko prijavite v sistem KinoPlex.'
            : 'Povezava je bila morda že uporabljena ali pa je napačna.';

        res.status(uspeh ? 200 : 400).send(`
            <html lang="sl"><head><meta charset="utf-8">
            <title>${naslov}</title></head>
            <body style="font-family:Arial,sans-serif;text-align:center;padding:60px;">
                <h2>${naslov}</h2>
                <p>${besedilo}</p>
                <p><a href="https://kinoplex.si">Nazaj na KinoPlex</a></p>
            </body></html>
        `);
    } catch (err) {
        console.error(err);
        res.status(500).send('Napaka na strežniku.');
    }
});

// PONOVNO POŠILJANJE POTRDITVENEGA SPOROČILA
router.post('/resend-verification', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: 'Elektronski naslov je obvezen.' });
    }

    try {
        const [users] = await db.query(
            'SELECT id, first_name, email_verified FROM users WHERE email = ?',
            [email]
        );

        // Enako sporočilo ne glede na izid, da naslova ni mogoče preveriti
        const splosnOdgovor = {
            message: 'Če naslov obstaja in še ni potrjen, smo nanj poslali novo potrditveno povezavo.'
        };

        if (users.length === 0 || users[0].email_verified) {
            return res.json(splosnOdgovor);
        }

        const verifyToken = crypto.randomBytes(32).toString('hex');
        await db.query(
            'UPDATE users SET verify_token = ? WHERE id = ?',
            [verifyToken, users[0].id]
        );

        const link = `${req.protocol}://${req.get('host')}/api/auth/verify/${verifyToken}`;
        sendVerifyEmail({ first_name: users[0].first_name, email }, link);

        res.json(splosnOdgovor);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Napaka na strežniku.' });
    }
});

// PRIJAVA
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Prosim, navedite elektronski naslov in geslo.' });
    }

    try {
        // Poišči uporabnika po elektronskem naslovu
        const [users] = await db.query(
            'SELECT * FROM users WHERE email = ?', [email]
        );
        if (users.length === 0) {
            return res.status(401).json({ message: 'Napačen elektronski naslov ali geslo.' });
        }

        const user = users[0];

        // Primerjaj vneseno geslo z zgoščenim geslom
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(401).json({ message: 'Napačen elektronski naslov ali geslo.' });
        }

        // Prijava je mogoča šele po potrditvi elektronskega naslova
        if (!user.email_verified) {
            return res.status(403).json({
                message: 'Elektronski naslov še ni potrjen. Preverite svojo e-pošto.'
            });
        }

        // Ustvari žeton
        const token = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
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
        res.status(500).json({ message: 'Napaka na strežniku. Poskusite znova.' });
    }
});

module.exports = router;