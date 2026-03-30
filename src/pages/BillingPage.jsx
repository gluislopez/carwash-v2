import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Crown, Zap, Building2, AlertTriangle, Loader2, ArrowLeft, ExternalLink } from 'lucide-react';

const PLANS = [
    {
        id: 'starter',
        name: 'Starter',
        price: 29,
        color: '#3b82f6',
        icon: <Zap size={28} />,
        features: [
            '✅ Dashboard operacional completo',
            '✅ Hasta 2 empleados',
            '✅ Hasta 200 clientes',
            '✅ Portal del cliente',
            '✅ Reportes básicos',
            '❌ Membresías / Suscripciones',
        ]
    },
    {
        id: 'pro',
        name: 'Pro',
        price: 59,
        color: '#8b5cf6',
        icon: <Crown size={28} />,
        popular: true,
        features: [
            '✅ Todo lo de Starter',
            '✅ Empleados ilimitados',
            '✅ Clientes ilimitados',
            '✅ Membresías / Suscripciones',
            '✅ Reportes avanzados + PDF',
            '✅ Comisiones automáticas',
        ]
    },
    {
        id: 'enterprise',
        name: 'Enterprise',
        price: 99,
        color: '#22c55e',
        icon: <Building2 size={28} />,
        features: [
            '✅ Todo lo de Pro',
            '✅ Múltiples sucursales',
            '✅ Soporte prioritario',
            '✅ Onboarding personalizado',
            '✅ Acceso anticipado a nuevas funciones',
            '✅ SLA garantizado',
        ]
    }
];

const BillingPage = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [org, setOrg] = useState(null);
    const [loading, setLoading] = useState(true);
    const [checkoutLoading, setCheckoutLoading] = useState(null);
    const [toast, setToast] = useState(null);

    const success = searchParams.get('success');
    const cancelled = searchParams.get('cancelled');
    const newPlan = searchParams.get('plan');

    useEffect(() => {
        const load = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) { navigate('/login'); return; }

            const { data: profile } = await supabase
                .from('user_profiles')
                .select('organization_id, organizations(*)')
                .eq('id', session.user.id)
                .single();

            if (profile?.organizations) {
                setOrg(profile.organizations);
            }
            setLoading(false);
        };
        load();
    }, [navigate]);

    useEffect(() => {
        if (success && newPlan) {
            setToast({ type: 'success', msg: `¡Plan ${newPlan.toUpperCase()} activado con éxito! 🎉` });
            setTimeout(() => setToast(null), 5000);
        }
        if (cancelled) {
            setToast({ type: 'warning', msg: 'Pago cancelado. Puedes intentarlo de nuevo cuando quieras.' });
            setTimeout(() => setToast(null), 4000);
        }
    }, [success, cancelled, newPlan]);

    const handleSubscribe = async (plan) => {
        if (!org) return;
        setCheckoutLoading(plan.id);
        try {
            const res = await fetch('/api/create-tenant-checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    plan: plan.id,
                    organizationId: org.id,
                    ownerEmail: org.owner_email,
                    businessName: org.name
                })
            });
            const data = await res.json();
            if (data.url) {
                window.location.href = data.url;
            } else {
                throw new Error(data.error || 'No se recibió URL de pago');
            }
        } catch (err) {
            setToast({ type: 'error', msg: `Error: ${err.message}` });
        } finally {
            setCheckoutLoading(null);
        }
    };

    const PLAN_COLORS = { trial: '#f59e0b', starter: '#3b82f6', pro: '#8b5cf6', enterprise: '#22c55e' };
    const currentColor = PLAN_COLORS[org?.plan] || '#f59e0b';

    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#080d1a' }}>
            <Loader2 size={40} style={{ animation: 'spin 1s linear infinite', color: '#6366f1' }} />
            <style>{`@keyframes spin{100%{transform:rotate(360deg)}}`}</style>
        </div>
    );

    return (
        <div style={{ minHeight: '100vh', background: '#080d1a', fontFamily: "'Outfit', sans-serif", color: 'white', padding: '2rem 1.5rem' }}>
            {/* Toast */}
            {toast && (
                <div style={{
                    position: 'fixed', top: '1.5rem', right: '1.5rem', zIndex: 9999,
                    padding: '1rem 1.5rem', borderRadius: '14px', fontWeight: '700', maxWidth: '360px',
                    background: toast.type === 'success' ? 'rgba(34,197,94,0.15)' : toast.type === 'error' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                    border: `1px solid ${toast.type === 'success' ? 'rgba(34,197,94,0.4)' : toast.type === 'error' ? 'rgba(239,68,68,0.4)' : 'rgba(245,158,11,0.4)'}`,
                    color: toast.type === 'success' ? '#22c55e' : toast.type === 'error' ? '#ef4444' : '#f59e0b',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
                }}>
                    {toast.msg}
                </div>
            )}

            {/* Header */}
            <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
                <button onClick={() => navigate('/dashboard')} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', marginBottom: '2rem', fontSize: '0.9rem' }}>
                    <ArrowLeft size={16} /> Volver al Dashboard
                </button>

                <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                    <h1 style={{ fontSize: '2.25rem', fontWeight: '900', marginBottom: '0.75rem', background: 'linear-gradient(135deg, #6366f1, #8b5cf6, #22c55e)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        Planes y Precios
                    </h1>
                    <p style={{ color: '#64748b', fontSize: '1rem' }}>
                        Elige el plan ideal para tu CarWash. Cancela cuando quieras.
                    </p>

                    {/* Current plan badge */}
                    {org && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginTop: '1rem', padding: '0.5rem 1rem', borderRadius: '20px', background: `${currentColor}18`, border: `1px solid ${currentColor}44`, color: currentColor }}>
                            {org.plan === 'trial' && <AlertTriangle size={16} />}
                            {org.plan !== 'trial' && <CheckCircle2 size={16} />}
                            <span style={{ fontWeight: '700', fontSize: '0.875rem' }}>
                                {org.plan === 'trial'
                                    ? `Plan actual: TRIAL — Quedan días de prueba`
                                    : `Plan actual: ${org.plan.toUpperCase()} • Activo`}
                            </span>
                        </div>
                    )}
                </div>

                {/* Plans Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
                    {PLANS.map(plan => {
                        const isCurrentPlan = org?.plan === plan.id;
                        return (
                            <div key={plan.id} style={{
                                background: 'rgba(15,23,42,0.7)',
                                border: `1px solid ${plan.popular ? plan.color : 'rgba(255,255,255,0.06)'}`,
                                borderRadius: '20px', padding: '1.75rem',
                                position: 'relative',
                                boxShadow: plan.popular ? `0 0 40px ${plan.color}22` : 'none',
                                transition: 'transform 0.2s',
                            }}
                                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
                                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                            >
                                {plan.popular && (
                                    <div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', background: plan.color, color: 'white', padding: '0.25rem 1rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '800', whiteSpace: 'nowrap' }}>
                                        ⭐ Más Popular
                                    </div>
                                )}

                                <div style={{ color: plan.color, marginBottom: '1rem' }}>{plan.icon}</div>
                                <h3 style={{ fontSize: '1.4rem', fontWeight: '800', color: 'white', marginBottom: '0.25rem' }}>{plan.name}</h3>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem', marginBottom: '1.5rem' }}>
                                    <span style={{ fontSize: '2.5rem', fontWeight: '900', color: plan.color }}>${plan.price}</span>
                                    <span style={{ color: '#475569', fontSize: '0.9rem' }}>/mes</span>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.75rem' }}>
                                    {plan.features.map((f, i) => (
                                        <p key={i} style={{ color: f.startsWith('❌') ? '#334155' : '#94a3b8', fontSize: '0.875rem', margin: 0 }}>{f}</p>
                                    ))}
                                </div>

                                {isCurrentPlan ? (
                                    <div style={{ width: '100%', padding: '0.875rem', background: `${plan.color}18`, border: `1px solid ${plan.color}44`, color: plan.color, borderRadius: '12px', fontWeight: '700', textAlign: 'center', fontSize: '0.95rem' }}>
                                        ✅ Plan Actual
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => handleSubscribe(plan)}
                                        disabled={checkoutLoading === plan.id}
                                        style={{
                                            width: '100%', padding: '0.875rem',
                                            background: `linear-gradient(135deg, ${plan.color}, ${plan.color}cc)`,
                                            color: 'white', border: 'none', borderRadius: '12px',
                                            fontWeight: '700', fontSize: '0.95rem', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                                            boxShadow: `0 4px 20px ${plan.color}44`,
                                            opacity: checkoutLoading && checkoutLoading !== plan.id ? 0.5 : 1,
                                        }}
                                    >
                                        {checkoutLoading === plan.id
                                            ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Redirigiendo...</>
                                            : <><ExternalLink size={16} /> Suscribirme</>}
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* FAQ */}
                <div style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '2rem' }}>
                    <h3 style={{ color: 'white', fontWeight: '800', marginBottom: '1.25rem' }}>Preguntas frecuentes</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
                        {[
                            { q: '¿Puedo cancelar en cualquier momento?', a: 'Sí. Sin penalidades ni contratos. Tu acceso continúa hasta el fin del período pagado.' },
                            { q: '¿Mis datos se borran si cancelo?', a: 'No. Guardamos tus datos por 30 días después de cancelar por si cambias de idea.' },
                            { q: '¿Puedo cambiar de plan?', a: 'Sí. Puedes subir o bajar de plan en cualquier momento desde esta página. El cobro se ajusta al instante.' },
                            { q: '¿Qué métodos de pago aceptan?', a: 'Tarjetas de crédito/débito (Visa, MC, Amex), Apple Pay, Google Pay vía Stripe.' },
                        ].map((item, i) => (
                            <div key={i}>
                                <p style={{ color: 'white', fontWeight: '600', marginBottom: '0.4rem', fontSize: '0.9rem' }}>{item.q}</p>
                                <p style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: '1.6' }}>{item.a}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            <style>{`@keyframes spin{100%{transform:rotate(360deg)}}`}</style>
        </div>
    );
};

export default BillingPage;
