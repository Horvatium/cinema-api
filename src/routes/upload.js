const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');

// Nastavitev, kam in kako se datoteke shranjujejo
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/posters/');
    },
    filename: (req, file, cb) => {
        // Ustvari edinstveno ime datoteke: časovni žig + izvirna pripona
        const uniqueName = Date.now() + path.extname(file.originalname).toLowerCase();
        cb(null, uniqueName);
    }
});

// Dovoljene pripone in začetni bajti (podpis) posamezne slikovne vrste
const DOVOLJENE = {
    '.jpg':  Buffer.from([0xFF, 0xD8, 0xFF]),
    '.jpeg': Buffer.from([0xFF, 0xD8, 0xFF]),
    '.png':  Buffer.from([0x89, 0x50, 0x4E, 0x47]),
    '.webp': Buffer.from('RIFF', 'ascii')
};

// Prebere prvih 12 bajtov datoteke in preveri, ali ustrezajo navedeni vrsti
const preveriPodpis = (pot, ext) => {
    const glava = Buffer.alloc(12);
    const f = fs.openSync(pot, 'r');
    fs.readSync(f, glava, 0, 12, 0);
    fs.closeSync(f);

    if (ext === '.webp') {
        return glava.slice(0, 4).toString('ascii') === 'RIFF' &&
               glava.slice(8, 12).toString('ascii') === 'WEBP';
    }

    const podpis = DOVOLJENE[ext];
    return glava.slice(0, podpis.length).equals(podpis);
};

// Prvi korak: filter po priponi in po vrsti vsebine, ki jo sporoči odjemalec
const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const dovoljeneVrste = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

    if (!DOVOLJENE[ext] || !dovoljeneVrste.includes(file.mimetype)) {
        return cb(new Error('Dovoljene so samo slike JPG, PNG in WEBP.'), false);
    }
    cb(null, true);
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // največ 5 MB
});

// Preverjanje vloge pred nalaganjem, da se datoteka sploh ne zapiše na disk
const samoSkrbnik = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Samo skrbniki.' });
    }
    next();
};

// Ovoj okoli multerja, da se napake vrnejo kot JSON in ne kot privzeta stran 500
const naloziPlakat = (req, res, next) => {
    upload.single('poster')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            const sporocilo = err.code === 'LIMIT_FILE_SIZE'
                ? 'Datoteka presega dovoljeno velikost 5 MB.'
                : 'Napaka pri nalaganju datoteke.';
            return res.status(400).json({ message: sporocilo });
        }
        if (err) {
            return res.status(400).json({ message: err.message });
        }
        next();
    });
};

// ─── NALAGANJE PLAKATA ─────────────────────────────────────────────────────────
router.post('/poster', auth, samoSkrbnik, naloziPlakat, (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'Nobena datoteka ni bila naložena.' });
    }

    // Drugi korak: preverjanje dejanske vsebine datoteke
    const ext = path.extname(req.file.filename).toLowerCase();
    if (!preveriPodpis(req.file.path, ext)) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: 'Datoteka ni veljavna slika.' });
    }

    // Vrni spletni naslov, prek katerega je slika dostopna
    const imageUrl = `${req.protocol}://${req.get('host')}/uploads/posters/${req.file.filename}`;

    res.json({
        message: 'Slika je bila uspešno naložena!',
        url: imageUrl
    });
});

module.exports = router;