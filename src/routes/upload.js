const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const auth = require('../middleware/auth');

// Nastavitev, kam in kako se datoteke shranjujejo
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/posters/');
    },
    filename: (req, file, cb) => {
        // Ustvari edinstveno ime datoteke: časovni žig + izvirna pripona
        const uniqueName = Date.now() + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});

// Filter datotek — dovoljene so samo slike
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Dovoljene so samo slike JPG, PNG in WEBP.'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // največ 5 MB
});

// ─── NALAGANJE PLAKATA ─────────────────────────────────────────────────────────
router.post('/poster', auth, upload.single('poster'), (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Samo skrbniki.' });
    }

    if (!req.file) {
        return res.status(400).json({ message: 'Nobena datoteka ni bila naložena.' });
    }

    // Vrni spletni naslov, prek katerega je slika dostopna
    const imageUrl = `http://${req.get('host')}/uploads/posters/${req.file.filename}`;

    res.json({
        message: 'Slika je bila uspešno naložena!',
        url: imageUrl
    });
});

module.exports = router;