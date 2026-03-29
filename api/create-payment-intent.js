const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
    // Enable CORS for Vercel
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );
    
    // Handle preflight response
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const { amount, metadata, customerEmail, description } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ error: "Monto inválido" });
        }

        // Create a PaymentIntent with the order amount and currency
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100), // Convert to cents (e.g. 45.00 -> 4500)
            currency: 'usd',
            description: description || 'Membresía Express CarWash',
            receipt_email: customerEmail,
            metadata: metadata || {},
            // Use automatic payment methods (Cards, Apple Pay, Google Pay implicitly)
            automatic_payment_methods: {
                enabled: true,
            },
        });

        // Send back the client secret to the React App
        res.status(200).json({
            clientSecret: paymentIntent.client_secret,
        });
    } catch (error) {
        console.error("Error creating PaymentIntent:", error.message);
        res.status(500).json({ error: error.message });
    }
};
