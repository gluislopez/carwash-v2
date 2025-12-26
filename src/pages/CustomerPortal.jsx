import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabase';
import { MapPin, Phone, Calendar, Clock, CheckCircle } from 'lucide-react';

const CustomerPortal = () => {
    const { customerId } = useParams();
    const [customer, setCustomer] = useState(null);
    const [history, setHistory] = useState([]);
    const [activeService, setActiveService] = useState(null);
    const [loading, setLoading] = useState(true);

    const [showPromo, setShowPromo] = useState(false);
    const [latestTx, setLatestTx] = useState(null);
    const [hasRated, setHasRated] = useState(false);
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');
    const [submittingFeedback, setSubmittingFeedback] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            if (!customerId) return;

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
                    customer_feedback (id, rating) 
                `)
                .eq('customer_id', customerId)
                .order('created_at', { ascending: false });

            if (!txError && txData) {
                setHistory(txData);

                // Active Service?
                const active = txData.find(t =>
                    t.status === 'waiting' || t.status === 'in_progress' || t.status === 'ready'
                );
                setActiveService(active);

                // Latest Completed Service for Feedback
                // Find first completed/paid that is NOT active
                if (!active) {
                    const lastCompleted = txData.find(t => t.status === 'completed' || t.status === 'paid');
                    if (lastCompleted) {
                        setLatestTx(lastCompleted);
                        if (lastCompleted.customer_feedback && lastCompleted.customer_feedback.length > 0) {
                            setHasRated(true);
                        }
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
            alert("Error al enviar (v4.63): " + JSON.stringify(error.message || error));
        } else {
            setShowPromo(true);
            setHasRated(true);
        }
    };

    const [queueCount, setQueueCount] = useState(0);

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
                        <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>En Cola</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#4ade80' }}>Abierto</div>
                        <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Estado</div>
                    </div>
                </div>
            </div>

            <div style={{ maxWidth: '600px', margin: '-1.5rem auto 0', padding: '0 1rem', position: 'relative', zIndex: 10 }}>

                {/* PROMO BADGE (If Saved) */}
                {customer.promo_available && (
                    <div style={{
                        backgroundColor: '#4f46e5', color: 'white', padding: '1rem',
                        borderRadius: '1rem', marginBottom: '1rem',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        boxShadow: '0 10px 15px -3px rgba(79, 70, 229, 0.4)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ fontSize: '1.5rem' }}>🎟️</div>
                            <div>
                                <div style={{ fontWeight: 'bold' }}>¡TIENES 10% OFF!</div>
                                <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>Disponible para hoy</div>
                            </div>
                        </div>
                        <div style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>USAR</div>
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
                    <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', color: '#64748b' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <CheckCircle size={18} />
                            <span>{history.length} Visitas</span>
                        </div>
                    </div>
                </div>

                {/* ACTIVE SERVICE */}
                {activeService && (
                    <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', marginBottom: '1.5rem', borderLeft: '5px solid #3b82f6' }}>
                        <h3 style={{ fontWeight: 'bold', color: '#3b82f6', marginBottom: '0.5rem' }}>SERVICIO EN CURSO</h3>
                        <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{activeService.services?.name || 'Lavado'}</div>
                        <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ padding: '0.25rem 0.75rem', borderRadius: '1rem', backgroundColor: '#eff6ff', color: '#3b82f6', fontSize: '0.9rem', fontWeight: 'bold' }}>
                                {activeService.status === 'waiting' && '⏳ En Espera'}
                                {activeService.status === 'in_progress' && '🚿 En Proceso'}
                                {activeService.status === 'ready' && '✅ Listo para Recoger'}
                            </span>
                        </div>
                    </div>
                )}

                {/* INFO CARD (ATH MOVIL) */}
                <div style={{ backgroundColor: '#10b981', color: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', marginBottom: '1.5rem' }}>
                    <h3 style={{ fontWeight: 'bold', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Phone size={20} /> ATH Móvil
                    </h3>
                    <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>787-857-8983</p>
                    <p style={{ opacity: 0.9, fontSize: '0.9rem' }}>Express CarWash</p>
                </div>

                {/* HISTORY LIST */}
                <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '1rem', paddingLeft: '0.5rem' }}>Historial Reciente</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {history.map(tx => (
                        <div key={tx.id} style={{ backgroundColor: 'white', borderRadius: '0.8rem', padding: '1rem', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                                <span style={{ fontWeight: 'bold', color: '#1e293b' }}>{tx.services?.name || 'Servicio'}</span>
                                <span style={{ color: '#64748b', fontSize: '0.9rem' }}>{new Date(tx.created_at).toLocaleDateString()}</span>
                            </div>
                            <div style={{ fontSize: '0.9rem', color: '#64748b' }}>
                                {tx.vehicles?.model ? `${tx.vehicles.brand} ${tx.vehicles.model}` : tx.extras?.vehicle_model || 'Vehículo'}
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
                {/* HISTORY LIST */}
                {/* ... (existing history code) ... */}

                <div style={{ textAlign: 'center', marginTop: '3rem', opacity: 0.8, fontSize: '0.8rem', paddingBottom: '2rem' }}>
                    <p>Express CarWash System v4.64</p>
                    <button
                        onClick={async () => {
                            if (!confirm("¿Resetear la aplicación? Esto borrará la memoria caché.")) return;

                            try {
                                // Unregister SW
                                if ('serviceWorker' in navigator) {
                                    const registrations = await navigator.serviceWorker.getRegistrations();
                                    for (const registration of registrations) {
                                        await registration.unregister();
                                    }
                                }
                                // Clear Caches
                                if ('caches' in window) {
                                    const keys = await caches.keys();
                                    await Promise.all(keys.map(key => caches.delete(key)));
                                }
                                // Reload
                                window.location.reload(true);
                            } catch (e) {
                                alert("Error reseteando: " + e.message);
                                window.location.reload();
                            }
                        }}
                        style={{
                            marginTop: '1rem',
                            backgroundColor: '#ef4444',
                            color: 'white',
                            border: 'none',
                            padding: '0.5rem 1rem',
                            borderRadius: '0.5rem',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                        }}
                    >
                        ⚠️ Forzar Actualización / Reset
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CustomerPortal;
