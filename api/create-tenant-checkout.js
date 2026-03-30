const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Plan price IDs — these must match your Stripe Dashboard Price IDs
// Go to Stripe Dashboard → Products → Create Products for each plan
// then copy the Price ID (starts with price_) here
const PLAN_PRICE_IDS = {
    starter: process.env.STRIPE_PRICE_STARTER,   // $29/mo
    pro: process.env.STRIPE_PRICE_PRO,            // $59/mo
    enterprise: process.env.STRIPE_PRICE_ENTERPRISE, // $99/mo
};

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { plan, organizationId, ownerEmail, businessName } = req.body;

        if (!plan || !PLAN_PRICE_IDS[plan]) {
            return res.status(400).json({ error: `Plan inválido: ${plan}. Planes válidos: starter, pro, enterprise` });
        }

        const priceId = PLAN_PRICE_IDS[plan];
        if (!priceId) {
            return res.status(500).json({ error: `Price ID para el plan "${plan}" no configurado en variables de entorno de Vercel.` });
        }

        // Create or retrieve Stripe Customer
        let customerId;
        const existing = await stripe.customers.list({ email: ownerEmail, limit: 1 });
        if (existing.data.length > 0) {
            customerId = existing.data[0].id;
        } else {
            const customer = await stripe.customers.create({
                email: ownerEmail,
                name: businessName,
                metadata: { organization_id: organizationId }
            });
            customerId = customer.id;
        }

        // Create Stripe Checkout Session
        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            customer: customerId,
            line_items: [{ price: priceId, quantity: 1 }],
            success_url: `${process.env.APP_URL || 'https://carwash-v2.vercel.app'}/billing?success=true&plan=${plan}`,
            cancel_url: `${process.env.APP_URL || 'https://carwash-v2.vercel.app'}/billing?cancelled=true`,
            subscription_data: {
                metadata: {
                    organization_id: organizationId,
                    plan,
                }
            },
            customer_update: { address: 'auto' },
            billing_address_collection: 'auto',
            locale: 'es',
        });

        res.status(200).json({ url: session.url });
    } catch (err) {
        console.error('Checkout session error:', err.message);
        res.status(500).json({ error: err.message });
    }
};
