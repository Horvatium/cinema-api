// Validacija vhodnih podatkov z zod. Vsaka pot, ki sprejme telo zahtevka,
// ima svojo shemo; vmesna oprema validiraj() telo preveri, ga nadomesti z
// očiščeno različico (odvečna polja odstrani, nize števil pretvori v števila)
// ali pa vrne 400 s sporočilom, katero polje ni v redu.
const { z } = require('zod');

// Skrbniška plošča pošilja vrednosti iz vnosnih polj kot nize ('' za prazno
// polje), zato prazne vrednosti obravnavamo kot manjkajoče, nize števil pa
// pretvorimo v števila
const prazno = (v) => (v === '' || v === null ? undefined : v);
const vStevilo = (v) => {
    const p = prazno(v);
    return typeof p === 'string' && p.trim() !== '' && !Number.isNaN(Number(p)) ? Number(p) : p;
};

const besedilo = (ime, max) =>
    z
        .string({
            error: (i) =>
                i.input === undefined ? `${ime} je obvezen podatek.` : `${ime} mora biti besedilo.`,
        })
        .trim()
        .min(1, `${ime} je obvezen podatek.`)
        .max(max, `${ime} je predolg (največ ${max} znakov).`);

// Neobvezno besedilo: '' je dovoljen (npr. brisanje opisa pri urejanju)
const neobveznoBesedilo = (ime, max) =>
    z
        .string(`${ime} mora biti besedilo.`)
        .trim()
        .max(max, `${ime} je predolg (največ ${max} znakov).`)
        .nullish();

const stevilo = (ime) =>
    z.number({
        error: (i) =>
            i.input === undefined ? `${ime} je obvezen podatek.` : `${ime} mora biti število.`,
    });

const celoStevilo = (ime, min, max) =>
    z.preprocess(
        vStevilo,
        stevilo(ime)
            .int(`${ime} mora biti celo število.`)
            .min(min, `${ime} mora biti vsaj ${min}.`)
            .max(max, `${ime} je lahko največ ${max}.`)
    );

const neobveznoCeloStevilo = (ime, min, max) =>
    z.preprocess(
        vStevilo,
        stevilo(ime)
            .int(`${ime} mora biti celo število.`)
            .min(min, `${ime} mora biti vsaj ${min}.`)
            .max(max, `${ime} je lahko največ ${max}.`)
            .optional()
    );

const id = (ime) => celoStevilo(ime, 1, 2147483647);

// Cena v evrih; stolpec decimal(6,2) sprejme največ 9999,99
const cena = (ime) =>
    z.preprocess(
        vStevilo,
        stevilo(ime)
            .positive(`${ime} mora biti večja od 0.`)
            .max(9999.99, `${ime} je prevelika.`)
            .multipleOf(0.01, `${ime} ima lahko največ dve decimalki.`)
    );

// Datum in ura, kot ju pošlje <input type="datetime-local">, npr. 2026-10-01T18:00
const DATUM_URA = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?$/;
const datumUra = (ime) =>
    z
        .string({
            error: (i) => (i.input === undefined ? `${ime} je obvezen podatek.` : undefined),
        })
        .regex(DATUM_URA, `${ime} mora biti v obliki LLLL-MM-DDTUU:MM.`)
        .refine((v) => !Number.isNaN(Date.parse(v.replace(' ', 'T'))), `${ime} ni veljaven datum.`);

const email = z
    .string({ error: 'E-poštni naslov je obvezen podatek.' })
    .trim()
    .toLowerCase()
    .pipe(z.email('E-poštni naslov ni veljaven.').max(100, 'E-poštni naslov je predolg.'));

// Seznam sedežev: vsaj eden in največ 20 na enkrat
const sedezi = z
    .array(id('Sedež'), 'Izberite vsaj en sedež.')
    .min(1, 'Izberite vsaj en sedež.')
    .max(20, 'Naenkrat lahko rezervirate največ 20 sedežev.');

// Konec predstave mora biti za začetkom (preverimo, če sta podana oba)
const konecPoZacetku = (d) => !d.start_time || !d.end_time || d.end_time > d.start_time;
const konecNapaka = { error: 'Konec mora biti za začetkom.', path: ['end_time'] };

const predstava = z.object({
    film_id: id('Film'),
    room_id: id('Dvorana'),
    start_time: datumUra('Začetek'),
    end_time: datumUra('Konec'),
    price: cena('Cena'),
});

const sheme = {
    registracija: z.object({
        first_name: besedilo('Ime', 50),
        last_name: besedilo('Priimek', 50),
        email,
        password: z
            .string({ error: 'Geslo je obvezen podatek.' })
            .min(6, 'Geslo mora imeti vsaj 6 znakov.')
            // bcrypt upošteva le prvih 72 bajtov
            .max(72, 'Geslo je predolgo (največ 72 znakov).'),
        phone: neobveznoBesedilo('Telefonska številka', 20),
    }),

    prijava: z.object({
        email,
        password: z
            .string({ error: 'Geslo je obvezen podatek.' })
            .min(1, 'Geslo je obvezen podatek.'),
    }),

    ponovnoPosiljanje: z.object({ email }),

    film: z.object({
        title: besedilo('Naslov', 150),
        title_sl: neobveznoBesedilo('Slovenski naslov', 150),
        genre: besedilo('Žanr', 50),
        duration_minutes: celoStevilo('Dolžina filma', 1, 600),
        age_rating: z.enum(['0-12', '12+', '15+', '18+'], 'Starostna ocena ni veljavna.'),
        synopsis: neobveznoBesedilo('Opis', 5000),
        director: neobveznoBesedilo('Režiser', 100),
        release_year: neobveznoCeloStevilo('Leto izida', 1901, 2155),
        poster_url: neobveznoBesedilo('Naslov plakata', 500),
        backdrop_url: neobveznoBesedilo('Naslov ozadja', 500),
        imdb_url: neobveznoBesedilo('Povezava IMDb', 500),
        trailer_url: neobveznoBesedilo('Povezava do napovednika', 500),
        cast_members: neobveznoBesedilo('Zasedba', 500),
    }),

    predstava: predstava.refine(konecPoZacetku, konecNapaka),

    dvorana: z.object({
        name: besedilo('Ime dvorane', 50),
        capacity: celoStevilo('Kapaciteta', 1, 1000),
        rows: neobveznoCeloStevilo('Število vrst', 1, 50),
        seats_per_row: neobveznoCeloStevilo('Število sedežev v vrsti', 1, 100),
    }),

    rezervacija: z.object({
        screening_id: id('Predstava'),
        seat_ids: sedezi,
    }),

    potrditevPlacila: z.object({
        payment_intent_id: z
            .string({ error: 'Manjka številka plačila.' })
            .regex(/^pi_[A-Za-z0-9_]+$/, 'Številka plačila ni veljavna.'),
        screening_id: id('Predstava'),
    }),

    preklicZadrzanja: z.object({ reservation_id: id('Rezervacija') }),

    zetonObvestil: z.object({
        token: besedilo('Žeton', 255).regex(
            /^Expo(nent)?PushToken\[.+\]$/,
            'Žeton za obvestila ni veljaven.'
        ),
    }),
};

// Pri urejanju so vsa polja neobvezna (pot ohrani stare vrednosti)
sheme.filmPopravek = sheme.film.partial();
sheme.predstavaPopravek = predstava.partial().refine(konecPoZacetku, konecNapaka);
sheme.dvoranaPopravek = sheme.dvorana.pick({ name: true, capacity: true }).partial();

const validiraj = (shema) => (req, res, next) => {
    const rezultat = shema.safeParse(req.body ?? {});
    if (!rezultat.success) {
        const napake = rezultat.error.issues.map((i) => ({
            polje: i.path.join('.'),
            sporocilo: i.message,
        }));
        // message ostane za obstoječe odjemalce, napake pa naštejejo vsa polja
        return res.status(400).json({ message: napake[0].sporocilo, napake });
    }
    req.body = rezultat.data;
    next();
};

module.exports = { validiraj, sheme };
