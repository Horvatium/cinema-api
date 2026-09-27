// Preverjanje vloge, ločeno od auth: auth pove, kdo je uporabnik, ta funkcija
// pa, ali sme poseg izvesti. Uporablja se za auth in pred validacijo, da
// uporabnik brez pravic dobi 403, ne podrobnosti o neveljavnih poljih.
module.exports = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Samo skrbniki.' });
    }
    next();
};
