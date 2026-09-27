// Varnostna vmesna oprema: glave HTTP (helmet), omejitev izvora (CORS) in
// omejitev števila zahtevkov na prijavnih poteh (rate limit).
const cors = require('cors');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');

// Izvori, s katerih brskalnik sme klicati API. Privzeto produkcijska stran,
// Vercelovi predogledi projekta cinema-web in lokalni razvoj; seznam se lahko
// prepiše s CORS_ORIGINS (z vejicami ločeni naslovi).
const privzetiIzvori = [
    'https://www.kinoplex.si',
    'https://kinoplex.si',
    /^https:\/\/cinema-web[a-z0-9-]*\.vercel\.app$/,
    /^http:\/\/(localhost|127\.0\.0\.1):\d+$/,
];

const dovoljeniIzvori = () =>
    process.env.CORS_ORIGINS
        ? process.env.CORS_ORIGINS.split(',').map((izvor) => izvor.trim())
        : privzetiIzvori;

// Zahtevki brez glave Origin (mobilna aplikacija, curl, Stripe) niso
// brskalniški zahtevki z drugega izvora, zato jih CORS ne omejuje.
// Za nedovoljen izvor cors ne doda glav in brskalnik odgovor zavrne.
const corsMiddleware = cors({
    origin: (origin, callback) => {
        const dovoljen =
            !origin ||
            dovoljeniIzvori().some((izvor) =>
                izvor instanceof RegExp ? izvor.test(origin) : izvor === origin
            );
        callback(null, dovoljen);
    },
});

const helmetMiddleware = helmet({
    // Plakate iz /uploads prikazuje spletna stran z drugega izvora
    // (kinoplex.si), zato jih brskalnik mora smeti naložiti
    crossOriginResourcePolicy: { policy: 'cross-origin' },
});

// Omejitev poskusov na prijavnih poteh zaradi ugibanja gesel in množičnega
// ustvarjanja računov. Števec je ločen po naslovu IP (za posrednikom Railway
// velja 'trust proxy', zato je to naslov obiskovalca, ne posrednika).
const omejitev = (limit, windowMs, dodatno = {}) =>
    rateLimit({
        windowMs,
        limit,
        ...dodatno,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        message: { message: 'Preveč poskusov. Poskusite znova čez nekaj minut.' },
    });

// Meje se preberejo ob nalaganju modula, zato jih testi lahko spremenijo.
// Pri prijavi štejejo samo neuspešni poskusi, zato uporabniki za istim
// omrežjem (npr. v kinu) ne blokirajo drug drugega.
const prijavaLimiter = omejitev(Number(process.env.LOGIN_RATE_LIMIT) || 10, 15 * 60 * 1000, {
    skipSuccessfulRequests: true,
});
const registracijaLimiter = omejitev(Number(process.env.REGISTER_RATE_LIMIT) || 5, 60 * 60 * 1000);

module.exports = { corsMiddleware, helmetMiddleware, prijavaLimiter, registracijaLimiter };
