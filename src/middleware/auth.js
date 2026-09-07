const jwt = require('jsonwebtoken');
require('dotenv').config();

// Vmesna oprema, ki varuje zaščitene poti. Ob uspehu na req.user pripne
// vsebino žetona ({ id, role }), tako da poznejšim preverjanjem vloge ni
// treba v bazo.
module.exports = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    // Pričakujemo obliko "Bearer <žeton>", zato vzamemo drugi del
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Dostop zavrnjen. Ni bil predložen žeton.' });
    }

    // Podpis in rok veljavnosti preveri jwt.verify; ob napaki vrže izjemo
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        // 403 in ne 401: žeton je bil predložen, a mu ne moremo zaupati
        res.status(403).json({ message: 'Neveljaven ali potekel žeton.'});
    }
};