import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabase';
import { MapPin, Phone, Calendar, Clock, CheckCircle, Gift, X, DollarSign, Share, CreditCard } from 'lucide-react';
import QRCode from 'react-qr-code';

const CustomerPortal = () => {
    const { customerId } = useParams();
    const [customer, setCustomer] = useState(null);
    const [history, setHistory] = useState([]);
    const [activeService, setActiveService] = useState(null);
    const [membership, setMembership] = useState(null);
    const [subPayments, setSubPayments] = useState([]);
    const [loading, setLoading] = useState(true);

    const [showPromo, setShowPromo] = useState(false);
    const [latestTx, setLatestTx] = useState(null);
    const [hasRated, setHasRated] = useState(false);
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');
    const [submittingFeedback, setSubmittingFeedback] = useState(false);
    const [stripeLink, setStripeLink] = useState('');

    const [availableCoupons, setAvailableCoupons] = useState(0);
    const [nextCouponIndex, setNextCouponIndex] = useState(0);
    const [showCouponModal, setShowCouponModal] = useState(false);

    // PWA State
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [isIOS, setIsIOS] = useState(false);
    const [showIOSInstructions, setShowIOSInstructions] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());

    // Progress Calculation Logic
    const calculateProgress = (service) => {
        if (!service) return 0;
        if (service.status === 'ready') return 100;
        if (service.status === 'waiting') return 10;

        if (service.status === 'in_progress') {
            if (!service.started_at) return 20; // At least started

            const startTime = new Date(service.started_at).getTime();
            const now = currentTime.getTime();
            const elapsedMinutes = (now - startTime) / (1000 * 60);

            // Linear progress from 10% to 75% over 30 minutes
            // Formula: Start + (Elapsed / Target) * (End - Start)
            const progress = 10 + Math.min(65, (elapsedMinutes / 30) * 65);
            return Math.floor(progress);
        }
        return 0;
    };

    const progress = calculateProgress(activeService);

    // Timer to update progress bar every minute
    useEffect(() => {
        if (activeService && activeService.status === 'in_progress') {
            const timer = setInterval(() => {
                setCurrentTime(new Date());
            }, 60000); // Update every minute
            return () => clearInterval(timer);
        }
    }, [activeService]);

    // Business Status
    const [isBusinessOpen, setIsBusinessOpen] = useState(true);

    useEffect(() => {
        // Fetch Business Status
        const fetchStatus = async () => {
            const { data } = await supabase
                .from('business_settings')
                .select('setting_value')
                .eq('setting_key', 'is_open')
                .single();

            if (data) {
                setIsBusinessOpen(data.setting_value === 'true');
            }
        };
        fetchStatus();

        // Realtime
        const channel = supabase
            .channel('public:portal_settings')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'business_settings' }, payload => {
                if (payload.new && payload.new.setting_key === 'is_open') {
                    setIsBusinessOpen(payload.new.setting_value === 'true');
                }
            })
            .subscribe();

        return () => supabase.removeChannel(channel);
    }, []);

    useEffect(() => {
        // Check if iOS
        const isIosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        setIsIOS(isIosDevice);

        // Capture install prompt
        const handleBeforeInstallPrompt = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const handleInstallClick = async () => {
        if (isIOS) {
            setShowIOSInstructions(true);
        } else if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                setDeferredPrompt(null);
            }
        } else {
            // Already installed or not supported, maybe show a hint or do nothing
            // For now, if no prompt and not iOS, we can assume it's installed or not capable
            // But let's show an alert for clarity during this phase if clicked
            // alert("Para instalar, busca la opción 'Instalar aplicación' en el menú de tu navegador.");
        }
    };

    useEffect(() => {
        const fetchData = async () => {
            if (!customerId) return;

            // SAVE ID FOR PWA "SMART LAUNCH"
            localStorage.setItem('my_carwash_id', customerId);
            // Backup cookie (more reliable for some iOS PWA scenarios)
            document.cookie = `my_carwash_id=${customerId}; path=/; max-age=31536000; SameSite=Lax`;

            // 1. Fetch Customer Info
            const { data: custData, error: custError } = await supabase
                .from('customers')
                .select('*')
                .eq('id', customerId)
                .single();

            if (custError) {
                console.error("Error fetching customer:", custError);
                setLoading(false);
                return;
            }
            setCustomer(custData);

            // 2. Fetch History & Check Feedback
            const { data: txData, error: txError } = await supabase
                .from('transactions')
                .select(`
                    *,
                    services (name),
                    vehicles (model, brand, plate),
                    customer_feedback (id, rating),
                    transaction_assignments (
                        employees (name)
                    )
                `)
                .eq('customer_id', customerId)
                .order('created_at', { ascending: false });

            if (!txError && txData) {
                setHistory(txData);

                // Loyalty Logic
                const totalVisits = txData.length;
                const earned = Math.floor(totalVisits / 5);
                const redeemed = custData.redeemed_coupons || 0;
                const available = Math.max(0, earned - redeemed);

                setAvailableCoupons(available);
                setNextCouponIndex(redeemed + 1);

                // Active Service?
                const active = txData.find(t =>
                    t.status === 'waiting' || t.status === 'in_progress' || t.status === 'ready'
                );
                setActiveService(active);

                // Latest Completed Service for Feedback
                // ALWAY check for latest completed, even if there is another active service
                const lastCompleted = txData.find(t => t.status === 'completed' || t.status === 'paid');
                if (lastCompleted) {
                    setLatestTx(lastCompleted);
                    if (lastCompleted.customer_feedback && lastCompleted.customer_feedback.length > 0) {
                        setHasRated(true);
                    }
                }
            }

            // 3. Fetch Queue Count (GLOBAL)
            const { count, error: queueError } = await supabase
                .from('transactions')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'waiting');

            if (!queueError) {
                setQueueCount(count);
            }

            // 4. Fetch Membership Details
            const { data: memberSub } = await supabase
                .from('customer_memberships')
                .select('*, memberships(name, type, wash_limit, price)')
                .eq('customer_id', customerId)
                .is('cancelled_at', null)
                .single();

            if (memberSub) {
                setMembership(memberSub);

                // 5. Fetch Subscription Payments
                const { data: payments } = await supabase
                    .from('subscription_payments')
                    .select('*')
                    .eq('customer_id', customerId)
                    .order('payment_date', { ascending: false });
                if (payments) setSubPayments(payments);
            }

            // 6. Fetch Global Settings (Stripe Link)
            const { data: settings } = await supabase
                .from('settings')
                .select('key, value');

            if (settings) {
                const sLink = settings.find(s => s.key === 'stripe_link');
                if (sLink) setStripeLink(sLink.value);
            }

            setLoading(false);
        };

        fetchData();

        const channel = supabase
            .channel(`public:transactions:customer:${customerId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `customer_id=eq.${customerId}` },
                () => fetchData()
            )
            .subscribe();

        return () => supabase.removeChannel(channel);

    }, [customerId]);

    const submitFeedback = async () => {
        if (rating === 0) return alert("Por favor selecciona las estrellas.");
        setSubmittingFeedback(true);

        const { error } = await supabase.from('customer_feedback').insert([
            {
                transaction_id: latestTx.id,
                rating: rating,
                comment: comment
            }
        ]);

        setSubmittingFeedback(false);

        if (error) {
            console.error("Feedback error:", error);
            alert("Error al enviar: " + (error.message || "Intente nuevamente."));
        } else {
            setShowPromo(true);
            setHasRated(true);
        }
    };

    const [queueCount, setQueueCount] = useState(0);
    const [selectedTransaction, setSelectedTransaction] = useState(null); // Modal State

    // ... useEffect ...

    if (loading) return <div className="p-8 text-center text-white bg-slate-900 min-h-screen">Cargando perfil...</div>;
    if (!customer) return <div className="p-8 text-center text-white bg-slate-900 min-h-screen">Cliente no encontrado.</div>;

    return (
        <div style={{ fontFamily: "'Outfit', sans-serif", backgroundColor: '#f3f4f6', minHeight: '100vh', paddingBottom: '2rem' }}>
            {/* HERDER */}
            <div style={{ backgroundColor: '#1e293b', color: 'white', padding: '2rem 1rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <img src="/logo.jpg" alt="Express CarWash" style={{ width: '80px', height: '80px', borderRadius: '1rem', marginBottom: '1rem', border: '3px solid rgba(255,255,255,0.2)' }} />
                <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Express CarWash</h1>

                {/* QUEUE COUNTER */}
                <div style={{ display: 'flex', gap: '2rem', marginTop: '1rem' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#60a5fa' }}>{queueCount}</div>
                        <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>Fila de Espera</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: isBusinessOpen ? '#4ade80' : '#ef4444' }}>
                            {isBusinessOpen ? 'Abierto' : 'Cerrado'}
                        </div>
                        <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Estado</div>
                    </div>
                </div>

                <div
                    onClick={handleInstallClick}
                    style={{
                        fontSize: '0.9rem', marginTop: '1.5rem',
                        opacity: (deferredPrompt || isIOS) ? 1 : 0.5,
                        backgroundColor: (deferredPrompt || isIOS) ? '#4f46e5' : 'rgba(255,255,255,0.1)',
                        color: 'white',
                        padding: '0.7rem 1.2rem',
                        borderRadius: '0.5rem',
                        cursor: (deferredPrompt || isIOS) ? 'pointer' : 'default',
                        fontWeight: (deferredPrompt || isIOS) ? 'bold' : 'normal',
                        transition: 'all 0.2s'
                    }}>
                    📲 {isIOS ? 'Instalar en iPhone (iOS)' : 'Instalar App'}
                </div>
            </div>

            {/* IOS INSTRUCTIONS MODAL */}
            {showIOSInstructions && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 9999,
                    display: 'flex', flexDirection: 'column', justifyContent: 'end', alignItems: 'center',
                    paddingBottom: '2rem'
                }} onClick={() => setShowIOSInstructions(false)}>

                    <div style={{ color: 'white', textAlign: 'center', marginBottom: '2rem', animation: 'bounce 2s infinite' }}>
                        <div style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Para instalar la App:</div>
                        <div style={{ fontSize: '1rem', opacity: 0.8 }}>Debes usar Safari</div>
                    </div>

                    <div style={{
                        backgroundColor: '#1e1e1e', color: 'white', padding: '1.5rem',
                        borderRadius: '1rem', width: '90%', maxWidth: '400px',
                        textAlign: 'center', position: 'relative'
                    }} onClick={e => e.stopPropagation()}>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', textAlign: 'left' }}>
                            <div style={{ fontSize: '1.5rem', color: '#3b82f6' }}><Share size={32} /></div>
                            <div>
                                <div style={{ fontSize: '0.9rem', color: '#9ca3af' }}>Paso 1</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>Toca el botón 'Compartir'</div>
                                <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Suele estar abajo en el centro</div>
                            </div>
                        </div>

                        <div style={{ width: '100%', height: '1px', backgroundColor: '#374151', marginBottom: '1.5rem' }}></div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', textAlign: 'left' }}>
                            <div style={{ fontSize: '1.5rem' }}>📱</div>
                            <div>
                                <div style={{ fontSize: '0.9rem', color: '#9ca3af' }}>Paso 2</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>Selecciona 'Agregar a Inicio'</div>
                                <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>(Add to Home Screen)</div>
                            </div>
                        </div>

                        <button
                            onClick={() => setShowIOSInstructions(false)}
                            style={{
                                width: '100%', padding: '1rem',
                                backgroundColor: '#3b82f6', color: 'white',
                                borderRadius: '0.8rem', border: 'none',
                                fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer'
                            }}
                        >
                            Entendido
                        </button>
                    </div>

                    {/* Arrow pointing down for emphasis */}
                    <div style={{
                        marginTop: '1rem', fontSize: '2rem', color: 'white',
                        transform: 'translateY(10px)', opacity: 0.5
                    }}>
                        ⬇️
                    </div>
                </div>
            )}

            <div style={{ maxWidth: '600px', margin: '-1.5rem auto 0', padding: '0 1rem', position: 'relative', zIndex: 10 }}>

                {/* LOYALTY COUPON BADGE */}
                {availableCoupons > 0 ? (
                    <div
                        onClick={() => setShowCouponModal(true)}
                        style={{
                            backgroundColor: '#4f46e5', color: 'white', padding: '1rem',
                            borderRadius: '1rem', marginBottom: '1rem',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            boxShadow: '0 10px 15px -3px rgba(79, 70, 229, 0.4)',
                            cursor: 'pointer'
                        }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ fontSize: '1.5rem' }}>🎟️</div>
                            <div>
                                <div style={{ fontWeight: 'bold' }}>¡TIENES 10% OFF!</div>
                                <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>Visita #{nextCouponIndex * 5} alcanzada</div>
                            </div>
                        </div>
                        <div style={{ fontWeight: 'bold', fontSize: '1.2rem', backgroundColor: 'white', color: '#4f46e5', padding: '0.2rem 0.8rem', borderRadius: '0.5rem' }}>
                            USAR
                        </div>
                    </div>
                ) : (
                    <div style={{
                        backgroundColor: 'white', color: '#64748b', padding: '1rem',
                        borderRadius: '1rem', marginBottom: '1rem',
                        display: 'flex', alignItems: 'center', gap: '1rem',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
                    }}>
                        <Gift size={24} className="text-purple-500" />
                        <div>
                            <div style={{ fontWeight: 'bold', color: '#333' }}>Programa de Lealtad</div>
                            <div style={{ fontSize: '0.85rem' }}>
                                {5 - (history.length % 5)} visitas más para tu próximo 10% OFF
                            </div>
                            {/* Simple Progress Bar */}
                            <div style={{ width: '100%', height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', marginTop: '0.5rem' }}>
                                <div style={{ width: `${(history.length % 5) * 20}%`, height: '100%', backgroundColor: '#a855f7', borderRadius: '3px' }}></div>
                            </div>
                        </div>
                    </div>
                )}

                {/* MEMBERSHIP CARD */}
                {membership && (
                    <div style={{
                        background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
                        color: 'white',
                        padding: '1.5rem',
                        borderRadius: '1rem',
                        marginBottom: '1rem',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        position: 'relative',
                        overflow: 'hidden'
                    }}>
                        <div style={{ position: 'absolute', top: '-10px', right: '-10px', opacity: 0.1 }}>
                            <Gift size={100} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                            <div>
                                <div style={{ fontSize: '0.8rem', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Membresía Activa</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{membership.memberships.name}</div>
                            </div>
                            <div style={{ backgroundColor: 'rgba(34, 197, 94, 0.2)', color: '#4ade80', padding: '0.2rem 0.6rem', borderRadius: '1rem', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                ACTIVO
                            </div>
                        </div>

                        <div style={{ marginBottom: '1rem' }}>
                            <div style={{ fontSize: '0.9rem', marginBottom: '0.25rem' }}>Beneficios:</div>
                            <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>
                                {membership.memberships.type === 'unlimited'
                                    ? '✨ Lavados Ilimitados'
                                    : `📦 ${membership.memberships.wash_limit} Lavados Premium`}
                            </div>
                        </div>

                        {membership.memberships.type === 'limited' && (
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.4rem' }}>
                                    <span>Uso del Plan</span>
                                    <span>{membership.usage_count} / {membership.memberships.wash_limit}</span>
                                </div>
                                <div style={{ width: '100%', height: '8px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '4px' }}>
                                    <div style={{
                                        width: `${(membership.usage_count / membership.memberships.wash_limit) * 100}%`,
                                        height: '100%',
                                        backgroundColor: '#4ade80',
                                        borderRadius: '4px',
                                        transition: 'width 0.5s ease-out'
                                    }}></div>
                                </div>
                            </div>
                        )}
                        {membership.memberships.type === 'unlimited' && (
                            <div style={{ fontSize: '0.8rem', opacity: 0.7, fontStyle: 'italic' }}>
                                Disfruta de lavados sin límites mientras tu plan esté activo.
                            </div>
                        )}

                        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between' }}>
                            <div>
                                <div style={{ opacity: 0.7 }}>Próximo Pago</div>
                                <div style={{ fontWeight: 'bold' }}>
                                    {membership.next_billing_date ? new Date(membership.next_billing_date).toLocaleDateString() : 'N/A'}
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ opacity: 0.7 }}>Costo Mensual</div>
                                <div style={{ fontWeight: 'bold' }}>${membership.memberships.price}</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* SUBSCRIPTION PAYMENT HISTORY */}
                {membership && subPayments.length > 0 && (
                    <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', marginBottom: '1.5rem' }}>
                        <h3 style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#1e293b', marginBottom: '1rem' }}>Historial de Pagos (Suscripción)</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {subPayments.map(p => (
                                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }}></div>
                                        <span style={{ color: '#4b5563' }}>{new Date(p.payment_date).toLocaleDateString()}</span>
                                    </div>
                                    <span style={{ fontWeight: 'bold', color: '#1e293b' }}>${p.amount}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* COUPON MODAL */}
                {showCouponModal && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 5000
                    }} onClick={() => setShowCouponModal(false)}>
                        <div style={{
                            backgroundColor: 'white', padding: '2rem', borderRadius: '1rem',
                            width: '90%', maxWidth: '350px', textAlign: 'center', position: 'relative'
                        }} onClick={e => e.stopPropagation()}>
                            <button onClick={() => setShowCouponModal(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer' }}>
                                <X size={24} color="#64748b" />
                            </button>

                            <h2 style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#4f46e5', marginBottom: '0.5rem' }}>¡Felicidades!</h2>
                            <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>Muestra este código al cajero para reclamar tu 10% de descuento.</p>

                            <div style={{ background: 'white', padding: '1rem', borderRadius: '0.5rem', border: '2px dashed #4f46e5', display: 'inline-block', marginBottom: '1.5rem' }}>
                                <QRCode
                                    value={`${window.location.origin}/verify-coupon?customerId=${customer.id}&couponIndex=${nextCouponIndex}`}
                                    size={200}
                                />
                            </div>

                            <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Cupón #{nextCouponIndex} • Válido por un solo uso</p>

                            <button
                                onClick={() => setShowCouponModal(false)}
                                style={{
                                    marginTop: '1.5rem',
                                    width: '100%',
                                    padding: '0.75rem',
                                    backgroundColor: '#4f46e5',
                                    color: 'white',
                                    fontWeight: 'bold',
                                    borderRadius: '0.5rem',
                                    border: 'none',
                                    fontSize: '1rem'
                                }}
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                )}

                {/* PROMO WINNER CARD */}
                {showPromo && (
                    <div style={{ backgroundColor: '#4f46e5', color: 'white', borderRadius: '1rem', padding: '1.5rem', marginBottom: '1.5rem', textAlign: 'center', boxShadow: '0 10px 15px -3px rgba(79, 70, 229, 0.4)' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🎉</div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>¡Gracias x tu Feedback!</h2>
                        <p style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Tienes un</p>
                        <div style={{ fontSize: '2.5rem', fontWeight: '900', backgroundColor: 'white', color: '#4f46e5', display: 'inline-block', padding: '0.5rem 1.5rem', borderRadius: '0.5rem', transform: 'rotate(-2deg)' }}>
                            10% OFF
                        </div>
                        <p style={{ marginTop: '1rem', opacity: 0.9 }}>Muestra esta pantalla en tu próxima visita.</p>
                    </div>
                )}

                {/* FEEDBACK CARD (If available and not rated yet) */}
                {!showPromo && !hasRated && latestTx && (
                    <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', marginBottom: '1.5rem', borderTop: '5px solid #EAB308' }}>
                        <h3 style={{ fontWeight: 'bold', color: '#CA8A04', marginBottom: '0.5rem' }}>¡Tu Opinión Cuenta!</h3>
                        <p style={{ color: '#4B5563', marginBottom: '1rem', fontSize: '0.9rem' }}>
                            Califica tu servicio de hoy ({latestTx.services?.name}) y <strong>gana un descuento</strong>.
                        </p>

                        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                            {[1, 2, 3, 4, 5].map(star => (
                                <button key={star} onClick={() => setRating(star)} style={{ background: 'none', border: 'none', fontSize: '2rem', cursor: 'pointer', transition: 'transform 0.2s' }} onMouseEnter={e => e.target.style.transform = 'scale(1.2)'} onMouseLeave={e => e.target.style.transform = 'scale(1)'}>
                                    {star <= rating ? '⭐' : '☆'}
                                </button>
                            ))}
                        </div>

                        {rating > 0 && (
                            <div style={{ animation: 'fadeIn 0.5s' }}>
                                <textarea
                                    placeholder="¿Algún comentario extra?"
                                    value={comment}
                                    onChange={e => setComment(e.target.value)}
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb', marginBottom: '1rem', fontFamily: 'inherit' }}
                                    rows="3"
                                />
                                <button
                                    onClick={submitFeedback}
                                    disabled={submittingFeedback}
                                    style={{ width: '100%', padding: '0.75rem', backgroundColor: '#EAB308', color: 'white', fontWeight: 'bold', borderRadius: '0.5rem', border: 'none', cursor: 'pointer', fontSize: '1rem' }}
                                >
                                    {submittingFeedback ? 'Enviando...' : 'Enviar y Ganar 🎁'}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* CUSTOMER CARD */}
                <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', marginBottom: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#1e293b' }}>Hola, {customer.name}</h2>
                    <div style={{ marginTop: '1.2rem', display: 'flex', gap: '1.5rem' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1e293b' }}>{history.length}</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Visitas</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#10b981' }}>{customer.points || 0}</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Puntos</div>
                        </div>
                    </div>
                </div>

                {/* REFERRAL SYSTEM SECTION */}
                <div style={{
                    backgroundColor: '#10b981', color: 'white', borderRadius: '1rem',
                    padding: '1.5rem', marginBottom: '1.5rem', boxShadow: '0 10px 15px -3px rgba(16, 185, 129, 0.4)',
                    position: 'relative', overflow: 'hidden'
                }}>
                    <div style={{ position: 'absolute', top: '-10px', right: '-10px', opacity: 0.15 }}>
                        <Share size={80} />
                    </div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        🎁 Trae un Amigo
                    </h3>
                    <p style={{ fontSize: '0.85rem', marginBottom: '1.2rem', opacity: 0.9, lineHeight: '1.4' }}>
                        ¡Gana <strong>2 puntos extra</strong> por cada referido! Comparte tu link y cuando ellos laven su auto, sumas puntos para tu próximo lavado gratis.
                    </p>
                    <button
                        onClick={() => {
                            const message = `¡Hola! Te recomiendo Express CarWash. Es el mejor lugar para cuidar tu auto. Si vas, diles que te refirió *${customer.name}* para que me ayudes a ganar puntos. ¡Gracias! 🚗✨`;
                            const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
                            window.open(whatsappUrl, '_blank');
                        }}
                        style={{
                            width: '100%', padding: '0.8rem', backgroundColor: 'white', color: '#10b981',
                            fontWeight: 'bold', borderRadius: '0.5rem', border: 'none', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                            fontSize: '0.95rem'
                        }}
                    >
                        <Share size={18} /> Compartir por WhatsApp
                    </button>
                </div>

                {/* ACTIVE SERVICE */}
                {activeService && (
                    <div
                        onClick={() => setSelectedTransaction(activeService)}
                        style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', marginBottom: '1.5rem', borderLeft: '5px solid #3b82f6', cursor: 'pointer' }}
                    >
                        <h3 style={{ fontWeight: 'bold', color: '#3b82f6', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                            SERVICIO EN CURSO
                            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Ver detalles &rarr;</span>
                        </h3>

                        {/* Service Name with High Contrast */}
                        <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '0.2rem' }}>
                            {activeService.services?.name || 'Lavado'}
                        </div>

                        {/* Vehicle Info */}
                        <div style={{ fontSize: '0.95rem', color: '#475569', marginBottom: '0.5rem', fontWeight: '600' }}>
                            🚗 {(activeService.vehicles?.brand && activeService.vehicles.brand !== 'null' ? activeService.vehicles.brand + ' ' : '') + (activeService.vehicles?.model || activeService.customers?.vehicle_model || activeService.extras?.vehicle_model || 'Vehículo')}
                            <span style={{ marginLeft: '0.5rem', backgroundColor: '#f1f5f9', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.8rem' }}>
                                {activeService.vehicles?.plate || activeService.customers?.vehicle_plate || activeService.extras?.vehicle_plate}
                            </span>
                        </div>

                        {/* Extras Count & Text */}
                        {activeService.extras && activeService.extras.length > 0 && (
                            <div style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '0.5rem' }}>
                                + {activeService.extras.length} servicios extra <span style={{ fontSize: '0.8rem' }}>({activeService.extras.map(e => e.description).join(', ')})</span>
                            </div>
                        )}

                        {/* TOTAL COST DISPLAY */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', marginBottom: '0.8rem' }}>
                            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#10b981' }}>
                                Total: ${parseFloat(activeService.price || 0).toFixed(2)}
                            </div>
                            {stripeLink && (
                                <div style={{ fontSize: '0.9rem', color: '#6366f1', fontWeight: '600' }}>
                                    Con Tarjeta (3% incl.): ${(parseFloat(activeService.price || 0) * 1.03).toFixed(2)}
                                </div>
                            )}
                        </div>

                        <div style={{ marginTop: '0.5rem' }}>
                            {/* EMPLOYEES LIST */}
                            {activeService.transaction_assignments && activeService.transaction_assignments.length > 0 && (
                                <div style={{ marginBottom: '0.8rem' }}>
                                    <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.3rem' }}>Atendido por:</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                        {activeService.transaction_assignments.map((assign, idx) => (
                                            <span key={idx} style={{
                                                backgroundColor: '#eff6ff', color: '#1e40af',
                                                padding: '0.25rem 0.6rem', borderRadius: '0.5rem',
                                                fontSize: '0.8rem', fontWeight: '600',
                                                display: 'flex', alignItems: 'center', gap: '0.3rem'
                                            }}>
                                                👤 {assign.employees?.name || 'Empleado'}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ padding: '0.25rem 0.75rem', borderRadius: '1rem', backgroundColor: '#eff6ff', color: '#3b82f6', fontSize: '0.9rem', fontWeight: 'bold' }}>
                                    {activeService.status === 'waiting' && '⏳ En Espera'}
                                    {activeService.status === 'in_progress' && '🚿 En Proceso'}
                                    {activeService.status === 'ready' && '✅ Listo para Recoger'}
                                </span>
                                <span style={{ fontWeight: 'bold', color: '#3b82f6', fontSize: '1.1rem' }}>
                                    {progress}%
                                </span>
                            </div>

                            {/* PROGRESS BAR */}
                            <div style={{
                                width: '100%',
                                height: '10px',
                                backgroundColor: '#e2e8f0',
                                borderRadius: '5px',
                                marginTop: '1rem',
                                overflow: 'hidden',
                                border: '1px solid #cbd5e1'
                            }}>
                                <div style={{
                                    width: `${progress}%`,
                                    height: '100%',
                                    backgroundColor: progress === 100 ? '#10b981' : '#3b82f6',
                                    borderRadius: '5px',
                                    transition: 'width 1s ease-in-out',
                                    backgroundImage: progress < 100 ? 'linear-gradient(45deg, rgba(255,255,255,0.15) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.15) 75%, transparent 75%, transparent)' : 'none',
                                    backgroundSize: '1rem 1rem',
                                    animation: progress < 100 ? 'progress-shimmer 2s linear infinite' : 'none'
                                }}></div>
                            </div>
                            <style>
                                {`
                                    @keyframes progress-shimmer {
                                        0% { background-position: 1rem 0; }
                                        100% { background-position: 0 0; }
                                    }
                                `}
                            </style>
                        </div>
                    </div>
                )}

                {/* PAYMENT METHODS CARD */}
                <div style={{ backgroundColor: '#10b981', color: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', marginBottom: '1.5rem' }}>
                    <h3 style={{ fontWeight: 'bold', marginBottom: '1rem', fontSize: '1.2rem' }}>
                        💳 Métodos de Pago
                    </h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {/* CASH OPTION */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: '0.5rem', borderRadius: '0.5rem' }}>
                                <DollarSign size={24} color="white" />
                            </div>
                            <div style={{ fontSize: '1.1rem', fontWeight: '600' }}>Efectivo</div>
                        </div>

                        {/* Stripe OPTION */}
                        {stripeLink && (
                            <>
                                <hr style={{ borderColor: 'rgba(255,255,255,0.3)', margin: '0' }} />
                                <a
                                    href={`${stripeLink}${stripeLink.includes('?') ? '&' : '?'}__prefilled_amount=${Math.round((parseFloat(activeService?.price || 0) * 1.03) * 100)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.75rem',
                                        textDecoration: 'none',
                                        color: 'white',
                                        backgroundColor: 'rgba(255,255,255,0.1)',
                                        padding: '0.75rem',
                                        borderRadius: '0.75rem'
                                    }}
                                >
                                    <div style={{ backgroundColor: '#6366f1', padding: '0.5rem', borderRadius: '0.5rem' }}>
                                        <CreditCard size={24} color="white" />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '1.1rem', fontWeight: '600' }}>Pagar con Tarjeta</div>
                                        <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                                            Total: ${(parseFloat(activeService?.price || 0) * 1.03).toFixed(2)} (incl. 3%)
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '1.2rem', opacity: 0.7 }}>&rarr;</div>
                                </a>
                                <p style={{ fontSize: '0.7rem', opacity: 0.8, marginTop: '0.5rem', fontStyle: 'italic' }}>
                                    * Los pagos con tarjeta incluyen un cargo por procesamiento del 3%.
                                </p>
                            </>
                        )}

                        {/* LINE SEPARATOR */}
                        <hr style={{ borderColor: 'rgba(255,255,255,0.3)', margin: '0' }} />

                        {/* ATH MOVIL OPTION */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: '0.5rem', borderRadius: '0.5rem' }}>
                                <Phone size={24} color="white" />
                            </div>
                            <div>
                                <div style={{ fontSize: '1.1rem', fontWeight: '600' }}>ATH Móvil</div>
                                <div style={{ fontSize: '1.3rem', fontWeight: '800', marginTop: '0.1rem' }}>787-857-8983</div>
                                <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>Express CarWash</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* HISTORY LIST */}
                <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '1rem', paddingLeft: '0.5rem' }}>Historial Reciente</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {history.map(tx => (
                        <div
                            key={tx.id}
                            onClick={() => setSelectedTransaction(tx)}
                            style={{ backgroundColor: 'white', borderRadius: '0.8rem', padding: '1rem', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', cursor: 'pointer' }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                                <span style={{ fontWeight: 'bold', color: '#1e293b' }}>{tx.services?.name || 'Servicio'}</span>
                                <span style={{ color: '#64748b', fontSize: '0.9rem' }}>{new Date(tx.created_at).toLocaleDateString()}</span>
                            </div>
                            <div style={{ fontSize: '0.9rem', color: '#64748b' }}>
                                {(tx.vehicles?.brand && tx.vehicles.brand !== 'null' ? tx.vehicles.brand + ' ' : '') + (tx.vehicles?.model || tx.customers?.vehicle_model || tx.extras?.vehicle_model || 'Vehículo')}
                                {(tx.vehicles?.plate || tx.customers?.vehicle_plate || tx.extras?.vehicle_plate) && ` (${tx.vehicles?.plate || tx.customers?.vehicle_plate || tx.extras?.vehicle_plate})`}
                            </div>
                            <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', fontWeight: 'bold', color: tx.status === 'completed' || tx.status === 'paid' ? '#10b981' : '#f59e0b' }}>
                                {tx.status === 'completed' || tx.status === 'paid' ? 'Completado' : 'En Proceso'}
                            </div>
                        </div>
                    ))}
                    {history.length === 0 && (
                        <p style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>No hay historial disponible.</p>
                    )}
                </div>

                {/* DETAIL MODAL */}
                {selectedTransaction && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000,
                        padding: '1rem'
                    }} onClick={() => setSelectedTransaction(null)}>
                        <div style={{ backgroundColor: 'white', width: '100%', maxWidth: '400px', borderRadius: '1rem', padding: '1.5rem', position: 'relative' }} onClick={e => e.stopPropagation()}>
                            <button onClick={() => setSelectedTransaction(null)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}>
                                &times;
                            </button>

                            <h2 style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '0.5rem' }}>Detalle del Servicio</h2>
                            <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>{new Date(selectedTransaction.created_at).toLocaleString()}</p>

                            <div style={{ marginBottom: '1.5rem' }}>
                                <div style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '0.25rem' }}>Vehículo</div>
                                <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                                    {(selectedTransaction.vehicles?.brand && selectedTransaction.vehicles.brand !== 'null' ? selectedTransaction.vehicles.brand + ' ' : '') + (selectedTransaction.vehicles?.model || selectedTransaction.customers?.vehicle_model || selectedTransaction.extras?.vehicle_model || 'Vehículo')}
                                </div>
                                <div style={{ fontSize: '0.9rem', opacity: 0.7 }}>{selectedTransaction.vehicles?.plate || selectedTransaction.customers?.vehicle_plate || selectedTransaction.extras?.vehicle_plate || ''}</div>
                            </div>

                            <div style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid #e5e7eb' }}>
                                <div style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '0.25rem' }}>Servicio</div>
                                <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#3b82f6' }}>
                                    {selectedTransaction.services?.name || 'Lavado'}
                                </div>
                            </div>

                            <div style={{ marginBottom: '1.5rem' }}>
                                <div style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '0.5rem' }}>Atendido por:</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    {selectedTransaction.transaction_assignments && selectedTransaction.transaction_assignments.length > 0 ? (
                                        selectedTransaction.transaction_assignments.map((assign, idx) => (
                                            <span key={idx} style={{
                                                backgroundColor: '#eff6ff', color: '#1e40af',
                                                padding: '0.25rem 0.75rem', borderRadius: '0.5rem',
                                                fontSize: '0.95rem', fontWeight: '500',
                                                display: 'flex', alignItems: 'center', gap: '0.4rem'
                                            }}>
                                                👤 {assign.employees?.name || 'Empleado'}
                                            </span>
                                        ))
                                    ) : (
                                        <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>Sin asignar aún</span>
                                    )}
                                </div>
                            </div>

                            <button
                                onClick={() => setSelectedTransaction(null)}
                                style={{ width: '100%', padding: '0.75rem', backgroundColor: '#f1f5f9', color: '#334155', fontWeight: 'bold', borderRadius: '0.5rem', border: 'none', cursor: 'pointer' }}
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                )}

                <div style={{ textAlign: 'center', marginTop: '3rem', opacity: 0.5, fontSize: '0.8rem', paddingBottom: '2rem' }}>
                    <p>Express CarWash System v4.70</p>
                </div>
            </div>
        </div >
    );
};

export default CustomerPortal;
