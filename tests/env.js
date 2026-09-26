// Test environment. Values are set before any app module loads, and dotenv
// never overrides existing variables, so a developer's real .env cannot point
// the tests at a production database or send real emails.
// Defaults match the db service in docker-compose.yml (`docker compose up -d db`).
// Override them with TEST_DB_* variables, e.g. in CI.
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
});

// The test database is dropped and recreated, so refuse anything that does
// not look like a dedicated test database.
if (!process.env.DB_NAME.endsWith('_test')) {
    throw new Error(`Refusing to run tests against database "${process.env.DB_NAME}"`);
}
