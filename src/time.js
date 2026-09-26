// Časi predstav so v bazi zapisani kot stenski čas kinematografa (predstava
// ob 20:00 je zapisana kot 20:00), odjemalci pa jih izpisujejo kot UTC.
// Primerjati jih moramo zato s trenutnim stenskim časom v kraju kina, ne s
// trenutnim časom strežnika, ki na Railwayu teče v UTC — sicer bi bila
// predstava v sporedu in na voljo za nakup še eno do dve uri po začetku.
const CINEMA_TIMEZONE = process.env.CINEMA_TIMEZONE || 'Europe/Ljubljana';

// Trenutni stenski čas kina kot Date, katerega vrednost UTC je enaka
// stenskemu času — enako, kot mysql2 (timezone: 'Z') prebere čase predstav.
// Upošteva poletni in zimski čas.
const stenskiCasZdaj = (now = new Date()) => {
    // Oblika 'sv-SE' je "YYYY-MM-DD HH:mm:ss"
    const wall = now.toLocaleString('sv-SE', { timeZone: CINEMA_TIMEZONE, hour12: false });
    return new Date(wall.replace(' ', 'T') + 'Z');
};

module.exports = { stenskiCasZdaj, CINEMA_TIMEZONE };
