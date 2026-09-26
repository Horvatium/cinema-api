# KinoPlex — Zaledni sistem (API) 🎬

Zaledni sistem informacijskega sistema za upravljanje kinematografa. Zagotavlja REST vmesnik,
avtentikacijo, poslovno logiko in povezavo s podatkovno bazo. Projekt je bil izdelan v okviru
diplomske naloge.

🌐 Naslov API-ja: `https://cinema-api-production-a533.up.railway.app`

## O projektu

Zaledni sistem obravnava vse zahtevke spletne in mobilne aplikacije: registracijo in prijavo
uporabnikov, pregledovanje filmov in predvajanj, rezervacije in plačila vstopnic ter
skrbniške operacije. Podatki se shranjujejo v relacijski podatkovni bazi MySQL.

Uporablja ga spletna aplikacija [cinema-web](https://github.com/Horvatium/cinema-web) in mobilna
aplikacija [cinema-mobile](https://github.com/Horvatium/cinema-mobile).

## Tehnologije

- **Node.js** — izvajalno okolje
- **Express** — spletno ogrodje za REST vmesnik
- **MySQL** — relacijska podatkovna baza
- **JWT (JSON Web Token)** — avtentikacija uporabnikov
- **Stripe** — obdelava plačil
- **Resend** — pošiljanje e-poštnih obvestil

## Podatkovna baza

Baza vsebuje 8 tabel: `users, films, rooms, seats, screenings, reservations, reservation_seats, email_log`.

## Funkcionalnosti

- Registracija, prijava in avtentikacija uporabnikov (JWT)
- REST končne točke za filme, dvorane, sedeže in predvajanja
- Ustvarjanje in preklic rezervacij s preverjanjem razpoložljivosti sedežev
- Obdelava plačil prek sistema Stripe
- Pošiljanje potrditvenih e-poštnih sporočil
- Skrbniške končne točke za upravljanje filmov in predvajanj

## Zagon projekta

```
npm install
npm start
```

Pred zagonom nastavi spremenljivke okolja (`.env`) za povezavo s podatkovno bazo, skrivni
ključ za JWT, podatke za pošiljanje e-pošte in ključe sistema Stripe.

## Diagrami

Diagrami sistema (EER, primeri uporabe, razredni diagram, arhitektura namestitve) so na voljo
v mapi [`docs/diagrami`](./docs/diagrami).

## Avtor

Diplomska naloga — Vid Gudič, CPU, 2026.
