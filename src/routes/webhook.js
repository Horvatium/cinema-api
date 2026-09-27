// Stripov webhook. Stripe ob uspešnem plačilu sam pokliče to pot, zato se
// rezervacija potrdi tudi, če stranka po plačilu zapre brskalnik in klic
// /api/payments/confirm nikoli ne pride. Pot potrebuje surovo telo zahtevka
// (express.raw v app.js), ker se podpis preverja nad točno poslanimi bajti.
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { potrdiPlacilo } = require('../potrditev');

module.exports = async (req, res) => {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
        req.log.error('STRIPE_WEBHOOK_SECRET ni nastavljen — webhook ne more preveriti podpisa');
        return res.status(500).json({ message: 'Webhook ni nastavljen.' });
    }

    // Podpis dokazuje, da dogodek res pošilja Stripe in da ni bil spremenjen
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], secret);
    } catch (err) {
        req.log.warn({ err }, 'Webhook z neveljavnim podpisom');
        return res.status(400).json({ message: 'Neveljaven podpis.' });
    }

    if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object;

        // Plačila brez naše rezervacije (npr. ročno ustvarjena v Stripu) prezremo
        if (!paymentIntent.metadata?.reservation_id) {
            return res.json({ received: true });
        }

        try {
            const { izid, reservationId } = await potrdiPlacilo(paymentIntent, req.log);
            req.log.info({ eventId: event.id, reservationId, izid }, 'Webhook obdelan');
        } catch (err) {
            // Odgovor 500 pove Stripu, naj dogodek pošlje znova
            req.log.error({ err, eventId: event.id }, 'Napaka pri obdelavi webhooka');
            return res.status(500).json({ message: 'Napaka pri obdelavi.' });
        }
    }

    // Druge vrste dogodkov potrdimo, da jih Stripe ne pošilja znova
    res.json({ received: true });
};
