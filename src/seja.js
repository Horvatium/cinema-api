// Seja spletne aplikacije v piškotku httpOnly. JavaScript na strani žetona ne
// more prebrati, zato ga pri morebitnem XSS ni mogoče ukrasti. Mobilna
// aplikacija in Swagger še naprej pošiljata žeton v glavi Authorization.
const IME_PISKOTKA = 'kinoplex_seja';
const TRAJANJE_MS = 8 * 60 * 60 * 1000; // enako kot rok JWT (8 h)

// Secure (samo HTTPS) v produkciji; lokalno API teče na http://localhost
const varno = () =>
    process.env.COOKIE_SECURE
        ? process.env.COOKIE_SECURE === 'true'
        : process.env.NODE_ENV === 'production';

// SameSite=Lax: brskalnik piškotek pošlje z istega mesta (kinoplex.si ->
// api.kinoplex.si), ne pa z zahtevki, ki jih sproži tuja stran
const moznosti = () => ({ httpOnly: true, secure: varno(), sameSite: 'lax', path: '/' });

const nastaviSejo = (res, token) =>
    res.cookie(IME_PISKOTKA, token, { ...moznosti(), maxAge: TRAJANJE_MS });

const pobrisiSejo = (res) => res.clearCookie(IME_PISKOTKA, moznosti());

module.exports = { IME_PISKOTKA, nastaviSejo, pobrisiSejo };
