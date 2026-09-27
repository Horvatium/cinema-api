require('./env');

// Zunanje storitve so nadomeščene, testi ne kličejo omrežja. Vsak
// require('stripe')(ključ) vrne isti nadomestek, zato lahko test z
// require('stripe')().paymentIntents.retrieve določi, kaj odgovori Stripe.
jest.mock('stripe', () => {
    // Preverjanje podpisa webhooka je pravo (iz knjižnice Stripe), klici API-ja
    // pa so nadomeščeni
    const pravi = jest.requireActual('stripe')('sk_test_dummy');
    const stripe = {
        webhooks: pravi.webhooks,
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
