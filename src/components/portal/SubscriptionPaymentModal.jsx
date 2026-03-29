import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { X, CreditCard, Loader2, CheckCircle } from 'lucide-react';

// Se debe configurar la llave pública de Stripe. 
// Para producción usar import.meta.env.VITE_STRIPE_PUBLIC_KEY
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || 'pk_test_typo');

const CheckoutForm = ({ amount, onSuccess, onCancel }) => {
    const stripe = useStripe();
    const elements = useElements();
    const [error, setError] = useState(null);
    const [processing, setProcessing] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!stripe || !elements) return;

        setProcessing(true);
        setError(null);

        try {
            // 1. Obtenemos el clientSecret desde nuestro servidor seguro (Vercel Edge function o local)
            const response = await fetch('/api/create-payment-intent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount })
            });
            const data = await response.json();

            if (!response.ok || data.error) {
                throw new Error(data.error || 'Error al conectar con el servidor de pagos');
            }

            const clientSecret = data.clientSecret;

            // 2. Confirmamos el pago directamente con Stripe usando el clientSecret
            const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
                payment_method: {
                    card: elements.getElement(CardElement),
                    billing_details: {
                        name: 'Cliente Express CarWash',
                    },
                },
            });

            if (stripeError) {
                setError(stripeError.message);
                setProcessing(false);
            } else if (paymentIntent.status === 'succeeded') {
                setProcessing(false);
                onSuccess(paymentIntent);
            }
        } catch (err) {
            setError(err.message);
            setProcessing(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
            <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
                <CardElement 
                    options={{
                        style: {
                            base: {
                                fontSize: '16px',
                                color: '#ffffff',
                                '::placeholder': {
                                    color: '#94a3b8',
                                },
                                iconColor: '#60a5fa',
                            },
                            invalid: {
                                color: '#ef4444',
                                iconColor: '#ef4444',
                            },
                        },
                        hidePostalCode: true,
                    }}
                />
            </div>
            
            {error && <div className="text-red-400 text-sm font-medium">{error}</div>}
            
            <button 
                type="submit" 
                disabled={!stripe || processing}
                className="w-full py-3 rounded-lg flex items-center justify-center font-bold text-white transition-all shadow-lg mt-2"
                style={{
                    background: processing ? '#475569' : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'
                }}
            >
                {processing ? (
                    <><Loader2 className="animate-spin mr-2" size={20} /> Procesando...</>
                ) : (
                    <><CreditCard className="mr-2" size={20} /> Pagar ${amount.toFixed(2)}</>
                )}
            </button>
            <button 
                type="button" 
                onClick={onCancel}
                className="text-slate-400 text-sm mt-2 hover:text-white transition-colors"
            >
                Cancelar y regresar
            </button>
        </form>
    );
};

export const SubscriptionPaymentModal = ({ isOpen, onClose, amount, planName, onPaymentSuccess }) => {
    const [success, setSuccess] = useState(false);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div 
                className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl flex flex-col items-center animate-fade-in"
                onClick={e => e.stopPropagation()}
            >
                {success ? (
                    <div className="flex flex-col items-center justify-center p-6 text-center">
                        <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                            <CheckCircle size={32} className="text-green-500" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">¡Pago Exitoso!</h2>
                        <p className="text-slate-400 mb-6">Hemos procesado tu pago para el plan {planName} correctamente.</p>
                        <button 
                            className="bg-slate-800 text-white w-full py-3 rounded-lg font-bold hover:bg-slate-700 transition-colors"
                            onClick={() => {
                                setSuccess(false);
                                onClose();
                                if(onPaymentSuccess) onPaymentSuccess();
                            }}
                        >
                            Ver mis beneficios
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="w-full flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-white truncate pr-2">Activación de Membresía</h2>
                            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="w-full bg-slate-800/50 rounded-xl p-4 mb-6 text-center border border-slate-700/50">
                            <p className="text-slate-400 text-sm mb-1">{planName}</p>
                            <p className="text-3xl font-bold text-white">${amount.toFixed(2)}</p>
                        </div>

                        <Elements stripe={stripePromise}>
                            <CheckoutForm 
                                amount={amount} 
                                onSuccess={() => setSuccess(true)}
                                onCancel={onClose} 
                            />
                        </Elements>
                        
                        <p className="text-xs text-slate-500 mt-6 text-center">
                            Procesado de forma segura por Stripe. Express CarWash no almacena la información de su tarjeta.
                        </p>
                    </>
                )}
            </div>
        </div>
    );
};

export default SubscriptionPaymentModal;
