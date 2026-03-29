import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Vercel config to handle raw body for Stripe signature
export const config = {
  api: {
    bodyParser: false,
  },
};

const getRawBody = async (readable) => {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const sig = req.headers['stripe-signature'];
  const rawBody = await getRawBody(req);

  let event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error(`Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // LOGIC: When a payment is completed
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const customerId = session.client_reference_id;
    const amount = session.amount_total / 100;

    console.log(`Processing payment for customer: ${customerId}, amount: ${amount}`);

    if (customerId) {
        // We use SUPABASE_SERVICE_ROLE_KEY to have administrative access
        const supabase = createClient(
          process.env.VITE_SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        // Call the RPC function we created in SQL
        const { error } = await supabase.rpc('process_stripe_subscription_payment', {
          p_customer_id: customerId,
          p_amount: amount,
          p_stripe_id: session.id
        });

        if (error) {
            console.error("RPC Error updating customer:", error);
            return res.status(500).json({ error: error.message });
        }
        
        console.log("Membership updated successfully via Webhook");
    }
  }

  res.status(200).json({ received: true });
}
