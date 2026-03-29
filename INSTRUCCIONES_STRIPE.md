# Guía de Instalación: Automatización de Pagos Stripe (Versión Vercel)

He cambiado el método a **Vercel API** para que no tengas que instalar nada en tu computadora ni usar la terminal de Supabase.

### 1. Ejecutar el SQL (Igual que antes)
Copia y pega el contenido de `stripe_webhook_logic.sql` en el **SQL Editor** de tu proyecto de Supabase y ejecútalo. Esto crea la lógica en la base de datos.

### 2. Configurar Variables en Vercel
Entra a tu panel de **Vercel** -> **Settings** -> **Environment Variables** y añade estas tres:

- `STRIPE_SECRET_KEY`: Tu clave secreta de Stripe (empieza por `sk_`).
- `STRIPE_WEBHOOK_SECRET`: El secreto del webhook (te lo da Stripe en el paso 3).
- `SUPABASE_SERVICE_ROLE_KEY`: Tu clave **Service Role** de Supabase (la encuentras en Supabase -> Project Settings -> API). **OJO: Es la secreta, no la anon.**

### 3. Configurar el Webhook en Stripe
1. Entra a tu Dashboard de Stripe -> Developers -> Webhooks.
2. Añade un "Endpoint".
3. La URL debe ser: `https://carwash-v2.vercel.app/api/stripe-webhook`
4. Selecciona el evento: `checkout.session.completed`.
5. Copia el "Signing Secret" que te den y pégalo en Vercel como `STRIPE_WEBHOOK_SECRET`.

---
**¿Qué hemos logrado?**
Ahora, cada vez que un cliente pague por el link de Stripe del portal:
1. Stripe enviará un aviso a Vercel.
2. Vercel le dirá a Supabase: "El cliente X ya pagó".
3. Supabase renovará los lavados y extenderá la fecha de membresía automáticamente.

¿Necesitas que te explique cómo encontrar alguna de estas llaves?
