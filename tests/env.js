// Testno okolje. Vrednosti se nastavijo, preden se naloži katerikoli modul
// aplikacije, dotenv pa obstoječih spremenljivk ne prepiše. Razvijalčev pravi
// .env zato testov ne more usmeriti na produkcijsko bazo ali poslati prave pošte.
// Privzete vrednosti ustrezajo storitvi db v docker-compose.yml
// (`docker compose up -d db`); prepišeš jih s spremenljivkami TEST_DB_*, npr. v CI.
Object.assign(process.env, {
    DB_HOST: process.env.TEST_DB_HOST ?? '127.0.0.1',
    DB_PORT: process.env.TEST_DB_PORT ?? '3307',
    DB_USER: process.env.TEST_DB_USER ?? 'root',
    DB_PASSWORD: process.env.TEST_DB_PASSWORD ?? 'root',
    DB_NAME: process.env.TEST_DB_NAME ?? 'cinema_test',
    DB_SSL: 'false',
    JWT_SECRET: 'test-secret',
    STRIPE_SECRET_KEY: 'sk_test_dummy',
    STRIPE_PUBLISHABLE_KEY: 'pk_test_dummy',
    RESEND_API_KEY: '',
    EMAIL_FROM: '',
    DOTENV_CONFIG_QUIET: 'true',
    // Teci kot na razvijalčevem računalniku v Sloveniji, da testi ujamejo kodo,
    // ki tiho predpostavlja, da strežnik teče v UTC (kot Railway in CI)
    TZ: 'Europe/Ljubljana',
    // Testi se večkrat zapored prijavijo, zato so meje visoke; omejitev
    // sama se preverja v security.test.js
    LOGIN_RATE_LIMIT: '1000',
    REGISTER_RATE_LIMIT: '1000',
});

// Testna baza se izbriše in ustvari na novo, zato zavrni vse, kar ni videti
// kot namenska testna baza.
if (!process.env.DB_NAME.endsWith('_test')) {
    throw new Error(`Testi se ne zaženejo na bazi "${process.env.DB_NAME}"`);
}
