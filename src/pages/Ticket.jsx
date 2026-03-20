import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabase';
import { Car, Clock, CheckCircle, Sparkles } from 'lucide-react';

const Ticket = () => {
    const { id } = useParams();
    const [transaction, setTransaction] = useState(null);
    const [position, setPosition] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchTicketData = async () => {
        try {
            // 1. Fetch the transaction details
            const { data: tx, error: txError } = await supabase
                .from('transactions')
                .select(`
                    id, 
                    status, 
                    date,
                    created_at,
                    customers (name, vehicle_model, vehicle_brand, vehicle_plate),
                    vehicles (model, brand, plate)
                `)
                .eq('id', id)
                .single();

            if (txError) {
                console.error("Error fetching transaction:", txError);
                throw new Error("No pudimos encontrar este ticket.");
            }

            if (!tx) {
                throw new Error("Ticket no encontrado.");
            }

            setTransaction(tx);

            // 2. If status is waiting, calculate position
            if (tx.status === 'waiting') {
                const { count, error: countError } = await supabase
                    .from('transactions')
                    .select('id', { count: 'exact' })
                    .eq('status', 'waiting')
                    .lt('created_at', tx.created_at || tx.date); // Count waiting txs older than this one

                if (!countError) {
                    setPosition(count + 1); // If 0 older waiting, position is 1
                }
            } else {
                setPosition(null);
            }

            setLoading(false);
            setError(null);
        } catch (err) {
            console.error("Ticket Fetch Error:", err);
            setError(err.message || 'Error al cargar el ticket.');
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTicketData();
        
        // Auto-refresh every 10 seconds
        const interval = setInterval(() => {
            fetchTicketData();
        }, 10000);

        return () => clearInterval(interval);
    }, [id]);

    if (loading && !transaction) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#0f172a', color: 'white', fontFamily: 'system-ui, sans-serif' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                    <div className="spinner"></div>
                    <style>{`
                        .spinner {
                            width: 40px;
                            height: 40px;
                            border: 4px solid rgba(255,255,255,0.1);
                            border-radius: 50%;
                            border-top-color: #3b82f6;
                            animation: spin 1s ease-in-out infinite;
                        }
                        @keyframes spin { to { transform: rotate(360deg); } }
                    `}</style>
                    <p>Buscando Ticket...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#0f172a', color: 'white', padding: '2rem', textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
                <div style={{ backgroundColor: '#1e293b', padding: '2rem', borderRadius: '1rem', border: '1px solid #ef4444', maxWidth: '400px', width: '100%' }}>
                    <h2 style={{ color: '#ef4444', marginBottom: '1rem' }}>⚠️ Oops</h2>
                    <p style={{ color: '#94a3b8' }}>{error}</p>
                </div>
            </div>
        );
    }

    if (!transaction) return null;

    // Get Vehicle Name
    const v = transaction.vehicles || {};
    const c = transaction.customers || {};
    const vehicleName = `${(v.brand && v.brand !== 'Generico' && v.brand !== 'null') ? v.brand : (c.vehicle_brand || '')} ${v.model || c.vehicle_model || 'Vehículo'}`.trim();
    const plate = v.plate || c.vehicle_plate || '';

    // Status UI Configuration
    const statusConfig = {
        'waiting': { color: '#f59e0b', icon: <Clock size={48} />, title: "En Fila de Espera", pulse: true },
        'in_progress': { color: '#3b82f6', icon: <Sparkles size={48} />, title: "Lavándose Ahora", pulse: true },
        'ready': { color: '#10b981', icon: <CheckCircle size={48} />, title: "¡Listo para Recoger!", pulse: true },
        'completed': { color: '#64748b', icon: <CheckCircle size={48} />, title: "Completado", pulse: false },
        'paid': { color: '#64748b', icon: <CheckCircle size={48} />, title: "Completado", pulse: false },
        'cancelled': { color: '#ef4444', icon: <Clock size={48} />, title: "Cancelado", pulse: false },
    };

    const currentStatus = statusConfig[transaction.status] || statusConfig['waiting'];

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', color: 'white', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem 1rem' }}>
            <style>{`
                @keyframes pulse-glow {
                    0%, 100% { box-shadow: 0 0 20px rgba(0,0,0,0.2); }
                    50% { box-shadow: 0 0 35px var(--glow-color); }
                }
            `}</style>
            
            <div style={{ width: '100%', maxWidth: '450px', backgroundColor: '#1e293b', borderRadius: '1.5rem', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }}>
                {/* Header Image / Branding */}
                <div style={{ backgroundColor: '#0f172a', padding: '1.5rem', textAlign: 'center', borderBottom: '1px solid #334155' }}>
                    <img src="/logo.jpg" alt="Logo" style={{ width: '60px', height: '60px', borderRadius: '15px', objectFit: 'cover', border: '2px solid white', marginBottom: '0.5rem' }} />
                    <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 'bold' }}>Rastreador de Servicio</h1>
                </div>

                {/* Status Indicator */}
                <div style={{ 
                    padding: '3rem 2rem', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    gap: '1rem',
                    backgroundColor: 'rgba(255,255,255,0.02)',
                    '--glow-color': `${currentStatus.color}40`,
                    animation: currentStatus.pulse ? 'pulse-glow 3s infinite' : 'none'
                }}>
                    <div style={{ 
                        width: '100px', 
                        height: '100px', 
                        borderRadius: '50%', 
                        backgroundColor: `${currentStatus.color}20`, 
                        color: currentStatus.color,
                        display: 'flex', 
                        justifyContent: 'center', 
                        alignItems: 'center',
                        border: `2px solid ${currentStatus.color}`,
                    }}>
                        {currentStatus.icon}
                    </div>
                    
                    <h2 style={{ fontSize: '1.8rem', fontWeight: '800', margin: 0, color: currentStatus.color, textAlign: 'center' }}>
                        {currentStatus.title}
                    </h2>

                    {transaction.status === 'waiting' && position !== null && (
                        <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '0.75rem 1.5rem', borderRadius: '2rem', marginTop: '0.5rem', border: '1px solid #334155' }}>
                            <span style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                                {position === 1 ? '¡Eres el próximo! 🚗💨' : `Tienes ${position - 1} auto${position - 1 > 1 ? 's' : ''} frente a ti.`}
                            </span>
                        </div>
                    )}
                </div>

                {/* Vehicle Details */}
                <div style={{ padding: '1.5rem', borderTop: '1px solid #334155' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', backgroundColor: '#0f172a', padding: '1rem', borderRadius: '1rem' }}>
                        <div style={{ backgroundColor: '#1e293b', padding: '0.8rem', borderRadius: '0.8rem', color: '#94a3b8' }}>
                            <Car size={24} />
                        </div>
                        <div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'white' }}>{vehicleName}</div>
                            <div style={{ fontSize: '0.9rem', color: '#94a3b8' }}>{plate ? `Tablilla: ${plate}` : 'Auto Registrado'}</div>
                        </div>
                    </div>
                    <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.8rem', color: '#64748b' }}>
                        Esta página se actualiza automáticamente.
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Ticket;
