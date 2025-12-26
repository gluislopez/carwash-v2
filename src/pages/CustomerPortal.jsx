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

            // 2. Fetch Transaction History
            const { data: txData, error: txError } = await supabase
                .from('transactions')
                .select(`
                    *,
                    services (name),
                    vehicles (model, brand, plate)
                `)
                .eq('customer_id', customerId)
                .order('created_at', { ascending: false });

            if (!txError && txData) {
                setHistory(txData);
                // Check for active service (today or not completed)
                const active = txData.find(t =>
                    t.status === 'waiting' ||
                    t.status === 'in_progress' ||
                    t.status === 'ready'
                );
                setActiveService(active);
            }
            setLoading(false);
        };

        fetchData();

        // Realtime subscription for updates
        const channel = supabase
            .channel(`public:transactions:customer:${customerId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `customer_id=eq.${customerId}` },
                () => fetchData()
            )
            .subscribe();

        return () => supabase.removeChannel(channel);

    }, [customerId]);

    if (loading) return <div className="p-8 text-center">Cargando perfil...</div>;
    if (!customer) return <div className="p-8 text-center">Cliente no encontrado.</div>;

    return (
        <div style={{ fontFamily: "'Outfit', sans-serif", backgroundColor: '#f3f4f6', minHeight: '100vh', paddingBottom: '2rem' }}>
            {/* HERDER */}
            <div style={{ backgroundColor: '#1e293b', color: 'white', padding: '2rem 1rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <img src="/logo.jpg" alt="Express CarWash" style={{ width: '80px', height: '80px', borderRadius: '1rem', marginBottom: '1rem', border: '3px solid rgba(255,255,255,0.2)' }} />
                <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Express CarWash</h1>
                <p style={{ opacity: 0.8 }}>Tu historial de servicios</p>
            </div>

            <div style={{ maxWidth: '600px', margin: '-2rem auto 0', padding: '0 1rem' }}>

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
            </div>
        </div>
    );
};

export default CustomerPortal;
