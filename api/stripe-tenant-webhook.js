const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY  // Service role needed for server-side writes
);

const PLAN_MAP = {
    // Map Stripe Price IDs → plan names
    [process.env.STRIPE_PRICE_STARTER]: 'starter',
    [process.env.STRIPE_PRICE_PRO]: 'pro',
    [process.env.STRIPE_PRICE_ENTERPRISE]: 'enterprise',
};

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).end();

    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_TENANT_WEBHOOK_SECRET;

    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    const data = event.data.object;

    try {
        switch (event.type) {

            // ── New subscription activated ──
            case 'checkout.session.completed': {
                const orgId = data.subscription_data?.metadata?.organization_id
                    || data.metadata?.organization_id;
                const plan = data.subscription_data?.metadata?.plan || 'starter';
                const stripeCustomerId = data.customer;
                const stripeSubId = data.subscription;

                if (orgId) {
                    await supabase.from('organizations').update({
                        plan,
                        status: 'active',
                        stripe_customer_id: stripeCustomerId,
                        stripe_subscription_id: stripeSubId,
                    }).eq('id', orgId);
                    console.log(`✅ Org ${orgId} activated on plan: ${plan}`);
                }
                break;
            }

            // ── Subscription renewed / updated ──
            case 'customer.subscription.updated': {
                const stripeSubId = data.id;
                const priceId = data.items?.data?.[0]?.price?.id;
                const plan = PLAN_MAP[priceId] || 'starter';
                const status = data.status === 'active' ? 'active' : 'suspended';

                await supabase.from('organizations')
                    .update({ plan, status })
                    .eq('stripe_subscription_id', stripeSubId);

                console.log(`♻️ Subscription updated: ${stripeSubId} → ${plan} / ${status}`);
                break;
            }

            // ── Subscription cancelled or payment failed ──
            case 'customer.subscription.deleted':
            case 'invoice.payment_failed': {
                const subId = data.subscription || data.id;

                await supabase.from('organizations')
                    .update({ status: 'suspended', plan: 'trial' })
                    .eq('stripe_subscription_id', subId);

                console.log(`🚫 Subscription ${subId} cancelled/failed → suspended`);
                break;
            }

            default:
                console.log(`Unhandled event: ${event.type}`);
        }

        res.status(200).json({ received: true });
    } catch (err) {
        console.error('Webhook handler error:', err.message);
        res.status(500).json({ error: err.message });
    }
};
