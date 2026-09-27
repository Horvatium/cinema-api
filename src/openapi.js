// Specifikacija OpenAPI 3.1 za API KinoPlex. Prikazuje jo Swagger UI na
// /api/docs, surova je na /api/openapi.json.

const napaka = {
    description: 'Napaka',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/Napaka' } } },
};
const napakaValidacije = {
    description: 'Neveljavni podatki',
    content: {
        'application/json': { schema: { $ref: '#/components/schemas/NapakaValidacije' } },
    },
};
const sporocilo = {
    description: 'Uspeh',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/Sporocilo' } } },
};
const json = (ref) => ({ 'application/json': { schema: { $ref: `#/components/schemas/${ref}` } } });
const seznam = (ref) => ({
    'application/json': {
        schema: { type: 'array', items: { $ref: `#/components/schemas/${ref}` } },
    },
});
const telo = (ref) => ({ required: true, content: json(ref) });
const idParam = (opis) => ({
    name: 'id',
    in: 'path',
    required: true,
    description: opis,
    schema: { type: 'integer', minimum: 1 },
});
const prijavljen = [{ bearerAuth: [] }];
const brezPrijave = { 401: napaka, 403: napaka };
const skrbnik = { 401: napaka, 403: { description: 'Samo skrbniki' } };

module.exports = {
    openapi: '3.1.0',
    info: {
        title: 'KinoPlex API',
        version: '1.0.0',
        description: [
            'REST API za rezervacijo kinovstopnic: spored, izbira sedežev, plačila s Stripom in',
            'upravljanje kinematografa.',
            '',
            'Zaščitene poti zahtevajo JWT: pokliči **POST /api/auth/login**, kopiraj `token` in ga',
            'vpiši z gumbom **Authorize**. Lokalni demo računi (samo v bazi s seed podatki):',
            '`demo@kinoplex.test` / `Demo123!` in `admin@kinoplex.test` / `Admin123!`.',
            '',
            'Na produkciji je tu mogoče preizkusiti samo poti GET, ki ničesar ne spremenijo;',
            'lokalno in v Dockerju (DOCS_ALL_METHODS=true) tudi vse ostale.',
        ].join('\n'),
    },
    servers: [{ url: '/', description: 'Ta strežnik' }],
    tags: [
        { name: 'Avtentikacija' },
        { name: 'Filmi' },
        { name: 'Predstave' },
        { name: 'Dvorane' },
        { name: 'Rezervacije' },
        { name: 'Plačila' },
        { name: 'Uporabniki' },
        { name: 'Ostalo' },
    ],
    paths: {
        '/health': {
            get: {
                tags: ['Ostalo'],
                summary: 'Preverjanje delovanja (API in baza)',
                responses: {
                    200: {
                        description: 'API in baza delujeta',
                        content: {
                            'application/json': {
                                example: { status: 'ok', db: 'ok' },
                            },
                        },
                    },
                    503: { description: 'Baza ni dosegljiva' },
                },
            },
        },
        '/api/auth/register': {
            post: {
                tags: ['Avtentikacija'],
                summary: 'Registracija; pošlje e-sporočilo za potrditev naslova',
                requestBody: telo('Registracija'),
                responses: {
                    201: sporocilo,
                    400: napakaValidacije,
                    409: { description: 'Račun s tem naslovom že obstaja' },
                    429: { description: 'Preveč poskusov z istega naslova IP' },
                },
            },
        },
        '/api/auth/verify/{token}': {
            get: {
                tags: ['Avtentikacija'],
                summary: 'Potrditev e-poštnega naslova (povezava iz e-sporočila)',
                parameters: [
                    { name: 'token', in: 'path', required: true, schema: { type: 'string' } },
                ],
                responses: {
                    200: { description: 'Stran HTML: naslov je potrjen' },
                    400: { description: 'Stran HTML: povezava ni veljavna ali je potekla' },
                },
            },
        },
        '/api/auth/resend-verification': {
            post: {
                tags: ['Avtentikacija'],
                summary: 'Ponovno pošiljanje potrditvenega e-sporočila',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['email'],
                                properties: { email: { type: 'string', format: 'email' } },
                            },
                        },
                    },
                },
                responses: { 200: sporocilo, 400: napakaValidacije, 429: napaka },
            },
        },
        '/api/auth/login': {
            post: {
                tags: ['Avtentikacija'],
                summary: 'Prijava; nastavi piškotek seje in vrne JWT',
                requestBody: telo('Prijava'),
                responses: {
                    200: { description: 'Prijava uspela', content: json('OdgovorPrijave') },
                    400: napakaValidacije,
                    401: { description: 'Napačen e-poštni naslov ali geslo' },
                    403: { description: 'E-poštni naslov še ni potrjen' },
                    429: { description: 'Preveč neuspešnih poskusov z istega naslova IP' },
                },
            },
        },
        '/api/auth/me': {
            get: {
                tags: ['Avtentikacija'],
                summary: 'Trenutno prijavljeni uporabnik in rok seje',
                security: [{ bearerAuth: [] }, { cookieAuth: [] }],
                responses: {
                    200: {
                        description: 'Prijavljen uporabnik',
                        content: {
                            'application/json': {
                                example: {
                                    user: {
                                        id: 2,
                                        first_name: 'Demo',
                                        last_name: 'Uporabnik',
                                        email: 'demo@kinoplex.test',
                                        role: 'customer',
                                    },
                                    expiresAt: '2026-10-01T20:00:00.000Z',
                                },
                            },
                        },
                    },
                    401: napaka,
                },
            },
        },
        '/api/auth/logout': {
            post: {
                tags: ['Avtentikacija'],
                summary: 'Odjava: pobriše piškotek seje',
                responses: { 200: sporocilo },
            },
        },
        '/api/films': {
            get: {
                tags: ['Filmi'],
                summary: 'Seznam filmov',
                responses: { 200: { description: 'Filmi', content: seznam('Film') } },
            },
            post: {
                tags: ['Filmi'],
                summary: 'Dodajanje filma',
                security: prijavljen,
                requestBody: telo('VnosFilma'),
                responses: { 201: sporocilo, 400: napakaValidacije, ...skrbnik },
            },
        },
        '/api/films/{id}': {
            parameters: [idParam('ID filma')],
            get: {
                tags: ['Filmi'],
                summary: 'Podrobnosti filma',
                responses: { 200: { description: 'Film', content: json('Film') }, 404: napaka },
            },
            put: {
                tags: ['Filmi'],
                summary: 'Urejanje filma (poslana polja se posodobijo, ostala ostanejo)',
                security: prijavljen,
                requestBody: telo('VnosFilma'),
                responses: { 200: sporocilo, 400: napakaValidacije, 404: napaka, ...skrbnik },
            },
            delete: {
                tags: ['Filmi'],
                summary: 'Brisanje filma',
                security: prijavljen,
                responses: {
                    200: sporocilo,
                    404: napaka,
                    409: { description: 'Film ima aktivne predstave' },
                    ...skrbnik,
                },
            },
        },
        '/api/screenings': {
            get: {
                tags: ['Predstave'],
                summary: 'Prihodnje predstave s podatki o filmu in dvorani',
                responses: { 200: { description: 'Predstave', content: seznam('Predstava') } },
            },
            post: {
                tags: ['Predstave'],
                summary: 'Dodajanje predstave (preveri prekrivanje v dvorani)',
                security: prijavljen,
                requestBody: telo('VnosPredstave'),
                responses: {
                    201: sporocilo,
                    400: napakaValidacije,
                    409: { description: 'Dvorana je v tem času zasedena' },
                    ...skrbnik,
                },
            },
        },
        '/api/screenings/{id}': {
            parameters: [idParam('ID predstave')],
            put: {
                tags: ['Predstave'],
                summary: 'Urejanje predstave',
                security: prijavljen,
                requestBody: telo('VnosPredstave'),
                responses: {
                    200: sporocilo,
                    400: napakaValidacije,
                    404: napaka,
                    409: napaka,
                    ...skrbnik,
                },
            },
            delete: {
                tags: ['Predstave'],
                summary: 'Odpoved predstave; strankam vrne denar in jih obvesti',
                security: prijavljen,
                responses: { 200: sporocilo, 404: napaka, ...skrbnik },
            },
        },
        '/api/screenings/{id}/seats': {
            parameters: [idParam('ID predstave')],
            get: {
                tags: ['Predstave'],
                summary: 'Zemljevid sedežev z zasedenostjo',
                responses: {
                    200: { description: 'Sedeži', content: seznam('Sedez') },
                    404: napaka,
                },
            },
        },
        '/api/rooms': {
            get: {
                tags: ['Dvorane'],
                summary: 'Seznam dvoran',
                responses: { 200: { description: 'Dvorane', content: seznam('Dvorana') } },
            },
            post: {
                tags: ['Dvorane'],
                summary: 'Dodajanje dvorane; sedeži se ustvarijo samodejno',
                security: prijavljen,
                requestBody: telo('VnosDvorane'),
                responses: { 201: sporocilo, 400: napakaValidacije, ...skrbnik },
            },
        },
        '/api/rooms/{id}': {
            parameters: [idParam('ID dvorane')],
            put: {
                tags: ['Dvorane'],
                summary: 'Urejanje imena ali kapacitete dvorane',
                security: prijavljen,
                requestBody: telo('VnosDvorane'),
                responses: { 200: sporocilo, 400: napakaValidacije, ...skrbnik },
            },
            delete: {
                tags: ['Dvorane'],
                summary: 'Brisanje dvorane brez aktivnih predstav',
                security: prijavljen,
                responses: { 200: sporocilo, 409: napaka, ...skrbnik },
            },
        },
        '/api/reservations': {
            get: {
                tags: ['Rezervacije'],
                summary: 'Vse rezervacije',
                security: prijavljen,
                responses: { 200: { description: 'Rezervacije' }, ...skrbnik },
            },
            post: {
                tags: ['Rezervacije'],
                summary: 'Rezervacija brez plačila (mobilna aplikacija)',
                security: prijavljen,
                requestBody: telo('IzbiraSedezev'),
                responses: {
                    201: {
                        description: 'Rezervacija potrjena',
                        content: json('OdgovorRezervacije'),
                    },
                    400: napakaValidacije,
                    404: napaka,
                    409: { description: 'Sedež je že zaseden' },
                    ...brezPrijave,
                },
            },
        },
        '/api/reservations/my': {
            get: {
                tags: ['Rezervacije'],
                summary: 'Rezervacije prijavljenega uporabnika',
                security: prijavljen,
                responses: { 200: { description: 'Rezervacije' }, ...brezPrijave },
            },
        },
        '/api/reservations/{id}/cancel': {
            parameters: [idParam('ID rezervacije')],
            put: {
                tags: ['Rezervacije'],
                summary: 'Preklic lastne rezervacije',
                security: prijavljen,
                responses: { 200: sporocilo, 400: napaka, 404: napaka, ...brezPrijave },
            },
        },
        '/api/payments/create-intent': {
            post: {
                tags: ['Plačila'],
                summary: 'Zadrži sedeže za 10 minut in ustvari Stripe PaymentIntent',
                security: prijavljen,
                requestBody: telo('IzbiraSedezev'),
                responses: {
                    200: { description: 'Zadržanje ustvarjeno', content: json('OdgovorZadrzanja') },
                    400: napakaValidacije,
                    404: napaka,
                    409: { description: 'Sedež je že zaseden' },
                    ...brezPrijave,
                },
            },
        },
        '/api/payments/confirm': {
            post: {
                tags: ['Plačila'],
                summary: 'Preveri plačilo pri Stripu in potrdi rezervacijo (idempotentno)',
                security: prijavljen,
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['payment_intent_id', 'screening_id'],
                                properties: {
                                    payment_intent_id: { type: 'string', example: 'pi_3Q...' },
                                    screening_id: { type: 'integer' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'Rezervacija je bila že potrjena' },
                    201: { description: 'Rezervacija potrjena' },
                    400: napakaValidacije,
                    409: { description: 'Sedeži so bili medtem prodani; denar je vrnjen' },
                    ...brezPrijave,
                },
            },
        },
        '/api/payments/cancel-intent': {
            post: {
                tags: ['Plačila'],
                summary: 'Sprosti zadržane sedeže, če stranka plačilo opusti',
                security: prijavljen,
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['reservation_id'],
                                properties: { reservation_id: { type: 'integer' } },
                            },
                        },
                    },
                },
                responses: { 200: sporocilo, 400: napakaValidacije, ...brezPrijave },
            },
        },
        '/api/payments/webhook': {
            post: {
                tags: ['Plačila'],
                summary: 'Stripov webhook (payment_intent.succeeded); zahteva podpis Stripe',
                parameters: [
                    {
                        name: 'Stripe-Signature',
                        in: 'header',
                        required: true,
                        schema: { type: 'string' },
                    },
                ],
                responses: {
                    200: { description: 'Dogodek obdelan' },
                    400: { description: 'Neveljaven podpis' },
                    500: { description: 'Napaka; Stripe dogodek pošlje znova' },
                },
            },
        },
        '/api/upload/poster': {
            post: {
                tags: ['Filmi'],
                summary: 'Nalaganje plakata (JPG, PNG ali WebP, največ 5 MB)',
                security: prijavljen,
                requestBody: {
                    required: true,
                    content: {
                        'multipart/form-data': {
                            schema: {
                                type: 'object',
                                properties: { poster: { type: 'string', format: 'binary' } },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'Naslov naložene slike' },
                    400: napaka,
                    ...skrbnik,
                },
            },
        },
        '/api/users': {
            get: {
                tags: ['Uporabniki'],
                summary: 'Seznam uporabnikov',
                security: prijavljen,
                responses: { 200: { description: 'Uporabniki' }, ...skrbnik },
            },
        },
        '/api/users/{id}': {
            parameters: [idParam('ID uporabnika')],
            delete: {
                tags: ['Uporabniki'],
                summary: 'Brisanje uporabnika (ne lastnega računa in ne zadnjega skrbnika)',
                security: prijavljen,
                responses: { 200: sporocilo, 400: napaka, 404: napaka, ...skrbnik },
            },
        },
        '/api/notifications/token': {
            post: {
                tags: ['Ostalo'],
                summary: 'Shrani žeton Expo za potisna obvestila',
                security: prijavljen,
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['token'],
                                properties: {
                                    token: { type: 'string', example: 'ExponentPushToken[xxxx]' },
                                },
                            },
                        },
                    },
                },
                responses: { 200: sporocilo, 400: napakaValidacije, ...brezPrijave },
            },
        },
    },
    components: {
        securitySchemes: {
            bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
            // Spletna aplikacija: piškotek httpOnly, ki ga nastavi prijava
            cookieAuth: { type: 'apiKey', in: 'cookie', name: 'kinoplex_seja' },
        },
        schemas: {
            Sporocilo: {
                type: 'object',
                properties: { message: { type: 'string' } },
            },
            Napaka: {
                type: 'object',
                properties: { message: { type: 'string', example: 'Predstava ni najdena.' } },
            },
            NapakaValidacije: {
                type: 'object',
                properties: {
                    message: { type: 'string', example: 'Geslo mora imeti vsaj 6 znakov.' },
                    napake: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                polje: { type: 'string', example: 'password' },
                                sporocilo: {
                                    type: 'string',
                                    example: 'Geslo mora imeti vsaj 6 znakov.',
                                },
                            },
                        },
                    },
                },
            },
            Registracija: {
                type: 'object',
                required: ['first_name', 'last_name', 'email', 'password'],
                properties: {
                    first_name: { type: 'string', maxLength: 50, example: 'Ana' },
                    last_name: { type: 'string', maxLength: 50, example: 'Novak' },
                    email: { type: 'string', format: 'email', example: 'ana@primer.si' },
                    password: { type: 'string', minLength: 6, maxLength: 72 },
                    phone: { type: 'string', maxLength: 20 },
                },
            },
            Prijava: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                    email: { type: 'string', format: 'email', example: 'demo@kinoplex.test' },
                    password: { type: 'string', example: 'Demo123!' },
                },
            },
            OdgovorPrijave: {
                type: 'object',
                properties: {
                    message: { type: 'string' },
                    token: {
                        type: 'string',
                        description:
                            'JWT, velja 8 ur. Samo za odjemalce brez glave Origin (mobilna aplikacija); brskalnik dobi sejo samo v piškotku httpOnly.',
                    },
                    expiresAt: { type: 'string', description: 'Rok seje (ISO 8601)' },
                    user: {
                        type: 'object',
                        properties: {
                            id: { type: 'integer' },
                            first_name: { type: 'string' },
                            last_name: { type: 'string' },
                            email: { type: 'string' },
                            role: { type: 'string', enum: ['customer', 'admin'] },
                        },
                    },
                },
            },
            Film: {
                type: 'object',
                properties: {
                    id: { type: 'integer' },
                    title: { type: 'string', example: 'Interstellar' },
                    title_sl: { type: ['string', 'null'], example: 'Medzvezdje' },
                    genre: { type: 'string' },
                    duration_minutes: { type: 'integer' },
                    age_rating: { type: 'string', enum: ['0-12', '12+', '15+', '18+'] },
                    synopsis: { type: ['string', 'null'] },
                    director: { type: ['string', 'null'] },
                    release_year: { type: ['integer', 'null'] },
                    poster_url: { type: ['string', 'null'] },
                    backdrop_url: { type: ['string', 'null'] },
                    imdb_url: { type: ['string', 'null'] },
                    trailer_url: { type: ['string', 'null'] },
                    cast_members: { type: ['string', 'null'] },
                },
            },
            VnosFilma: {
                type: 'object',
                required: ['title', 'genre', 'duration_minutes', 'age_rating'],
                properties: {
                    title: { type: 'string', maxLength: 150 },
                    title_sl: { type: 'string', maxLength: 150 },
                    genre: { type: 'string', maxLength: 50 },
                    duration_minutes: { type: 'integer', minimum: 1, maximum: 600 },
                    age_rating: { type: 'string', enum: ['0-12', '12+', '15+', '18+'] },
                    synopsis: { type: 'string', maxLength: 5000 },
                    director: { type: 'string', maxLength: 100 },
                    release_year: { type: 'integer', minimum: 1901, maximum: 2155 },
                    poster_url: { type: 'string', maxLength: 500 },
                    backdrop_url: { type: 'string', maxLength: 500 },
                    imdb_url: { type: 'string', maxLength: 500 },
                    trailer_url: { type: 'string', maxLength: 500 },
                    cast_members: { type: 'string', maxLength: 500 },
                },
            },
            Predstava: {
                type: 'object',
                description: 'Časi so stenski čas kina, poslani kot niz ISO v UTC.',
                properties: {
                    id: { type: 'integer' },
                    film_id: { type: 'integer' },
                    room_id: { type: 'integer' },
                    start_time: { type: 'string', example: '2026-10-01T20:00:00.000Z' },
                    end_time: { type: 'string' },
                    price: { type: 'string', example: '8.50' },
                    film_title: { type: 'string' },
                    film_title_sl: { type: ['string', 'null'] },
                    room_name: { type: 'string' },
                    capacity: { type: 'integer' },
                },
            },
            VnosPredstave: {
                type: 'object',
                required: ['film_id', 'room_id', 'start_time', 'end_time', 'price'],
                properties: {
                    film_id: { type: 'integer' },
                    room_id: { type: 'integer' },
                    start_time: { type: 'string', example: '2026-10-01T20:00' },
                    end_time: { type: 'string', example: '2026-10-01T22:30' },
                    price: { type: 'number', example: 8.5 },
                },
            },
            Sedez: {
                type: 'object',
                properties: {
                    id: { type: 'integer' },
                    row_label: { type: 'string', example: 'D' },
                    seat_number: { type: 'integer', example: 5 },
                    status: { type: 'string', enum: ['available', 'taken'] },
                },
            },
            Dvorana: {
                type: 'object',
                properties: {
                    id: { type: 'integer' },
                    name: { type: 'string' },
                    capacity: { type: 'integer' },
                },
            },
            VnosDvorane: {
                type: 'object',
                required: ['name', 'capacity'],
                properties: {
                    name: { type: 'string', maxLength: 50 },
                    capacity: { type: 'integer', minimum: 1, maximum: 1000 },
                    rows: { type: 'integer', minimum: 1, maximum: 50 },
                    seats_per_row: { type: 'integer', minimum: 1, maximum: 100 },
                },
            },
            IzbiraSedezev: {
                type: 'object',
                required: ['screening_id', 'seat_ids'],
                properties: {
                    screening_id: { type: 'integer' },
                    seat_ids: {
                        type: 'array',
                        items: { type: 'integer' },
                        minItems: 1,
                        maxItems: 20,
                    },
                },
            },
            OdgovorRezervacije: {
                type: 'object',
                properties: {
                    message: { type: 'string' },
                    reservation_id: { type: 'integer' },
                    total_price: { type: 'number' },
                },
            },
            OdgovorZadrzanja: {
                type: 'object',
                properties: {
                    clientSecret: { type: 'string' },
                    total_price: { type: 'number' },
                    reservation_id: { type: 'integer' },
                    expires_at: { type: 'string' },
                    publishableKey: { type: 'string' },
                },
            },
        },
    },
};
