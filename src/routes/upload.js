const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const auth = require('../middleware/auth');

// Configure where and how files are stored
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/posters/');
    },
    filename: (req, file, cb) => {
        // Create unique filename: timestamp + original extension
        const uniqueName = Date.now() + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});

// File filter — only allow images
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only JPG, PNG and WEBP images are allowed.'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB max
});

// ─── UPLOAD POSTER ────────────────────────────────────────────────────────────
router.post('/poster', auth, upload.single('poster'), (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Admins only.' });
    }

    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded.' });
    }

    // Return the URL path where the image can be accessed
    const imageUrl = `http://${req.get('host')}/uploads/posters/${req.file.filename}`;

    res.json({
        message: 'Image uploaded successfully!',
        url: imageUrl
    });
});

module.exports = router;