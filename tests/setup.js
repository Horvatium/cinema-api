require('./env');

// External services are replaced with stubs: no network calls in tests.
// Every require('stripe')(key) returns the same stub, so a test can set
// what Stripe answers with require('stripe')().paymentIntents.retrieve.
jest.mock('stripe', () => {
    const stripe = {
        paymentIntents: {
            create: jest.fn(async () => ({ id: 'pi_test', client_secret: 'pi_test_secret' })),
            retrieve: jest.fn(),
            search: jest.fn(async () => ({ data: [] })),
        },
        refunds: { create: jest.fn(async () => ({})) },
    };
    return () => stripe;
});
jest.mock('../src/email');
jest.mock('../src/push');
