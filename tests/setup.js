require('./env');

// External services are replaced with stubs: no network calls in tests
jest.mock('stripe', () => () => ({
    paymentIntents: {
        create: jest.fn(async () => ({ id: 'pi_test', client_secret: 'pi_test_secret' })),
        retrieve: jest.fn(),
        search: jest.fn(async () => ({ data: [] })),
    },
    refunds: { create: jest.fn(async () => ({})) },
}));
jest.mock('../src/email');
jest.mock('../src/push');
