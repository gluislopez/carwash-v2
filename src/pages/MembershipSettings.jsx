import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Plus, Trash2, Edit2, Save, X, Award, CheckCircle, Info, Users, DollarSign, Calendar, Pencil, History } from 'lucide-react';

const MembershipSettings = () => {
    const [activeTab, setActiveTab] = useState('plans'); // 'plans', 'subs', or 'pending'
    const [memberships, setMemberships] = useState([]);
    const [subscriptions, setSubscriptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [currentPlan, setCurrentPlan] = useState({
        name: '',
        description: '',
        price: '',
        type: 'limit',
        limit_count: 0
    });

    // INLINE PRICE EDITING STATE
    const [editingPriceId, setEditingPriceId] = useState(null);
    const [editingPriceValue, setEditingPriceValue] = useState('');

    const [error, setError] = useState(null);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [selectedHistorySub, setSelectedHistorySub] = useState(null);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [paymentHistory, setPaymentHistory] = useState([]);
    const [isAddingPayment, setIsAddingPayment] = useState(false);
    const [manualPaymentData, setManualPaymentData] = useState({
        amount: '',
        date: new Date().toISOString().split('T')[0],
        concept: ''
    });

    useEffect(() => {
        fetchMemberships();
        fetchSubscriptions();
    }, []);

    const fetchMemberships = async () => {
        setLoading(true);
        setError(null);
        const { data, error } = await supabase
            .from('memberships')
            .select('*')
            .order('created_at', { ascending: true });

        if (error) {
            console.error("Error fetching plans:", error);
            if (error.code === 'PGRST116' || error.message.includes('relation "memberships" does not exist')) {
                setError("Las tablas de membresía no existen en Supabase. Por favor ejecuta el archivo SQL.");
            } else {
                setError(error.message);
            }
        }
        if (data) setMemberships(data);
        setLoading(false);
    };

    const fetchSubscriptions = async () => {
        const { data, error } = await supabase
            .from('customer_memberships')
            .select('*, customers(name, phone), memberships(name, price), vehicles(brand, model, plate)')
            // If sub or pending tab, we might want different filters, but for now let's just fetch all non-expired/active ones
            .in('status', ['active', 'pending_payment']);

        if (error) console.error("Error fetching subscriptions:", error);
        if (data) setSubscriptions(data);
    };

    const handleUpdateUsage = async (id, newUsage) => {
        const { error } = await supabase
            .from('customer_memberships')
            .update({ usage_count: parseInt(newUsage) || 0 })
            .eq('id', id);

        if (error) {
            alert("Error al actualizar usos: " + error.message);
        } else {
            fetchSubscriptions();
        }
    };

    const handleSavePlan = async () => {
        if (!currentPlan.name || !currentPlan.price) return alert("Nombre y precio requeridos.");

        const planToSave = {
            ...currentPlan,
            price: parseFloat(currentPlan.price)
        };

        let error;
        if (currentPlan.id) {
            const result = await supabase.from('memberships').update(planToSave).eq('id', currentPlan.id);
            error = result.error;
        } else {
            const result = await supabase.from('memberships').insert([planToSave]);
            error = result.error;
        }

        if (error) {
            console.error("Error saving plan:", error);
            alert("Error al guardar el plan: " + error.message);
        } else {
            setIsEditing(false);
            setCurrentPlan({ name: '', description: '', price: '', type: 'limit', limit_count: 0 });
            fetchMemberships();
        }
    };

    const handleDeletePlan = async (id) => {
        if (confirm("¿Borrar este plan de membresía?")) {
            await supabase.from('memberships').delete().eq('id', id);
            fetchMemberships();
        }
    };

    const handleCollectPayment = async (sub) => {
        const amount = sub.manual_price != null ? sub.manual_price : sub.memberships.price;
        const todayStr = new Date().toISOString().split('T')[0];
        
        let nextDate;
        let remainingWashes = 0;

        // Check if early payment (not overdue yet)
        if (sub.status === 'active' && sub.next_billing_date && sub.next_billing_date >= todayStr) {
            // Extend from the current next_billing_date
            nextDate = new Date(sub.next_billing_date + 'T12:00:00Z'); // use midday to avoid timezone shift
            nextDate.setMonth(nextDate.getMonth() + 1);

            // Calculate remaining washes to rollover
            if (sub.memberships && sub.memberships.type === 'limit') {
                remainingWashes = Math.max(0, sub.memberships.limit_count - (sub.usage_count || 0));
            }
        } else {
            // If overdue or new, start from today
            nextDate = new Date();
            nextDate.setMonth(nextDate.getMonth() + 1);
        }

        const newUsageCount = -remainingWashes;

        // 1. Record in subscription_payments
        const { error: payErr } = await supabase.from('subscription_payments').insert([{
            customer_id: sub.customer_id,
            membership_id: sub.membership_id,
            amount: amount,
            status: 'success'
        }]);

        if (payErr) {
            alert("Error al registrar pago: " + payErr.message);
            return;
        }

        // 2. Record in transactions (for reports)
        const { error: txErr } = await supabase.from('transactions').insert([{
            customer_id: sub.customer_id,
            vehicle_id: sub.vehicle_id,
            price: amount,
            total_price: amount,
            payment_method: 'membership_sale',
            status: 'paid',
            date: new Date().toISOString(),
            extras: [{ description: `RENOVACIÓN MEMBRESÍA: ${sub.memberships.name}`, price: amount }]
        }]);

        if (txErr) console.error("Error creating transaction record:", txErr);

        // 3. Update active subscription
        await supabase.from('customer_memberships').update({
            status: 'active',
            last_payment_date: new Date().toISOString().split('T')[0],
            next_billing_date: nextDate.toISOString().split('T')[0],
            usage_count: newUsageCount // Rollover remaining washes
        }).eq('id', sub.id);

        alert(`Pago de $${amount} registrado para ${sub.customers.name}. Suscripción ACTIVADA.`);
        fetchSubscriptions();
    };

    const handleDeleteMembership = async (id) => {
        if (!confirm("¿Seguro que deseas ELIMINAR esta membresía? El cliente dejará de ser socio.")) return;
        const { error } = await supabase.from('customer_memberships').delete().eq('id', id);
        if (error) {
            alert("Error al eliminar membresía: " + error.message);
        } else {
            fetchSubscriptions();
        }
    };

    const openHistory = async (sub) => {
        setSelectedHistorySub(sub);
        setIsHistoryModalOpen(true);
        setHistoryLoading(true);
        try {
            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('customer_id', sub.customer_id)
                .is('service_id', null)
                .order('date', { ascending: false });

            if (error) throw error;
            // Filter only membership related transactions
            const filtered = (data || []).filter(tx => 
                (tx.payment_method === 'membership_sale') || 
                (tx.extras && JSON.stringify(tx.extras).toUpperCase().includes('MEMBRES'))
            );
            setPaymentHistory(filtered);
        } catch (error) {
            console.error("Error fetching payment history:", error);
        } finally {
            setHistoryLoading(false);
        }
    };

    const handleDeletePayment = async (txId) => {
        if (!confirm("¿Borrar este registro de pago de los reportes?")) return;
        const { error } = await supabase.from('transactions').delete().eq('id', txId);
        if (error) {
            alert("Error al borrar pago: " + error.message);
        } else {
            setPaymentHistory(prev => prev.filter(tx => tx.id !== txId));
        }
    };

    const handleAddManualPayment = async () => {
        if (!manualPaymentData.amount || !manualPaymentData.concept) return alert("Monto y concepto requeridos.");

        try {
            const { error } = await supabase.from('transactions').insert([{
                customer_id: selectedHistorySub.customer_id,
                vehicle_id: selectedHistorySub.vehicle_id,
                price: parseFloat(manualPaymentData.amount),
                total_price: parseFloat(manualPaymentData.amount),
                payment_method: 'membership_sale',
                status: 'paid',
                date: new Date(manualPaymentData.date).toISOString(),
                extras: [{ description: manualPaymentData.concept, price: parseFloat(manualPaymentData.amount) }]
            }]);

            if (error) throw error;

            alert("Pago manual añadido correctamente.");
            setIsAddingPayment(false);
            setManualPaymentData({ amount: '', date: new Date().toISOString().split('T')[0], concept: '' });
            openHistory(selectedHistorySub); // Refresh history
        } catch (error) {
            alert("Error: " + error.message);
        }
    };

    const handleSavePrice = async (subId) => {
        const newPrice = editingPriceValue.trim() === '' ? null : parseFloat(editingPriceValue);
        const { error } = await supabase
            .from('customer_memberships')
            .update({ manual_price: newPrice })
            .eq('id', subId);

        if (error) {
            alert('Error al actualizar precio: ' + error.message);
        } else {
            setEditingPriceId(null);
            setEditingPriceValue('');
            fetchSubscriptions();
        }
    };

    const mrr = subscriptions.filter(s => s.status === 'active').reduce((sum, sub) => {
        const effectivePrice = sub.manual_price != null ? sub.manual_price : (sub.memberships?.price || 0);
        return sum + effectivePrice;
    }, 0);

    return (
        <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', color: 'var(--text-primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ padding: '0.75rem', backgroundColor: 'var(--primary)', borderRadius: '0.5rem', color: 'white' }}>
                        <Award size={24} />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>Gestión de Membresías</h1>
                        <p style={{ color: 'var(--text-muted)' }}>Configura planes y gestiona ingresos recurrentes.</p>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: 'var(--bg-secondary)', padding: '0.25rem', borderRadius: '0.5rem' }}>
                    <button
                        onClick={() => setActiveTab('plans')}
                        style={{
                            padding: '0.5rem 1rem', borderRadius: '0.4rem', border: 'none', cursor: 'pointer',
                            backgroundColor: activeTab === 'plans' ? 'var(--primary)' : 'transparent',
                            color: activeTab === 'plans' ? 'white' : 'var(--text-muted)',
                            fontWeight: 'bold', transition: 'all 0.2s'
                        }}
                    >
                        Planes
                    </button>
                    <button
                        onClick={() => setActiveTab('subs')}
                        style={{
                            padding: '0.5rem 1rem', borderRadius: '0.4rem', border: 'none', cursor: 'pointer',
                            backgroundColor: activeTab === 'subs' ? 'var(--primary)' : 'transparent',
                            color: activeTab === 'subs' ? 'white' : 'var(--text-muted)',
                            fontWeight: 'bold', transition: 'all 0.2s'
                        }}
                    >
                        Activas
                    </button>
                    <button
                        onClick={() => setActiveTab('pending')}
                        style={{
                            padding: '0.5rem 1rem', borderRadius: '0.4rem', border: 'none', cursor: 'pointer',
                            backgroundColor: activeTab === 'pending' ? 'var(--primary)' : 'transparent',
                            color: activeTab === 'pending' ? 'white' : 'var(--text-muted)',
                            fontWeight: 'bold', transition: 'all 0.2s'
                        }}
                    >
                        Pendientes {subscriptions.filter(s => s.status === 'pending_payment').length > 0 && `(${subscriptions.filter(s => s.status === 'pending_payment').length})`}
                    </button>
                </div>
            </div>

            {error && (
                <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)', color: 'var(--danger)', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Info size={18} />
                    <span>{error}</span>
                </div>
            )}

            {activeTab === 'plans' ? (
                <>
                    {!isEditing ? (
                        <div>
                            <button
                                onClick={() => { setCurrentPlan({ name: '', description: '', price: '', type: 'limit', limit_count: 0 }); setIsEditing(true); }}
                                className="btn-primary"
                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2rem', padding: '0.75rem 1.5rem', borderRadius: '0.5rem', backgroundColor: 'var(--primary)', color: 'white', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
                            >
                                <Plus size={20} /> Nuevo Plan
                            </button>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
                                {memberships.map(plan => (
                                    <div key={plan.id} style={{
                                        backgroundColor: 'var(--bg-card)',
                                        padding: '1.5rem',
                                        borderRadius: '1rem',
                                        border: '1px solid var(--border-color)',
                                        position: 'relative',
                                        display: 'flex',
                                        flexDirection: 'column'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                            <div>
                                                <h3 style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>{plan.name}</h3>
                                                <span style={{
                                                    fontSize: '0.75rem',
                                                    padding: '0.2rem 0.5rem',
                                                    borderRadius: '1rem',
                                                    backgroundColor: plan.type === 'unlimited' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                                                    color: plan.type === 'unlimited' ? '#22c55e' : '#3b82f6',
                                                    fontWeight: 'bold',
                                                    textTransform: 'uppercase'
                                                }}>
                                                    {plan.type === 'unlimited' ? 'Ilimitado' : `${plan.limit_count} Lavados`}
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <button onClick={() => { setCurrentPlan(plan); setIsEditing(true); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><Edit2 size={18} /></button>
                                                <button onClick={() => handleDeletePlan(plan.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)' }}><Trash2 size={18} /></button>
                                            </div>
                                        </div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: 'var(--primary)' }}>
                                            ${plan.price} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>/ mes</span>
                                        </div>
                                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', flexGrow: 1, marginBottom: '1.5rem' }}>
                                            {plan.description || 'Sin descripción.'}
                                        </p>
                                        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--success)', fontSize: '0.85rem' }}>
                                            <CheckCircle size={14} />
                                            Activo en el sistema
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {memberships.length === 0 && !loading && (
                                <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)', backgroundColor: 'var(--bg-card)', borderRadius: '1rem', border: '1px dashed var(--border-color)' }}>
                                    <Info size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                                    <p>No has configurado planes aún.</p>
                                    <p>Usa el botón superior para crear tu primer plan estratégico.</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div style={{ maxWidth: '600px', backgroundColor: 'var(--bg-card)', padding: '2rem', borderRadius: '1rem', border: '1px solid var(--border-color)' }}>
                            <h3 style={{ marginBottom: '1.5rem', fontSize: '1.2rem', fontWeight: 'bold' }}>{currentPlan.id ? 'Editar' : 'Nuevo'} Plan</h3>

                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Nombre del Plan</label>
                                <input
                                    type="text"
                                    value={currentPlan.name}
                                    onChange={e => setCurrentPlan({ ...currentPlan, name: e.target.value })}
                                    placeholder="Ej. Plan Smart"
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Precio Mensual ($)</label>
                                    <input
                                        type="number"
                                        value={currentPlan.price}
                                        onChange={e => setCurrentPlan({ ...currentPlan, price: e.target.value })}
                                        placeholder="0.00"
                                        style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Tipo de Plan</label>
                                    <select
                                        value={currentPlan.type}
                                        onChange={e => setCurrentPlan({ ...currentPlan, type: e.target.value })}
                                        style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                                    >
                                        <option value="limit">Límite de Lavados</option>
                                        <option value="unlimited">Ilimitado</option>
                                    </select>
                                </div>
                            </div>

                            {currentPlan.type === 'limit' && (
                                <div style={{ marginBottom: '1rem' }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Cantidad de Lavados al Mes</label>
                                    <input
                                        type="number"
                                        value={currentPlan.limit_count}
                                        onChange={e => setCurrentPlan({ ...currentPlan, limit_count: parseInt(e.target.value) || 0 })}
                                        style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                                    />
                                </div>
                            )}

                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Descripción y Beneficios</label>
                                <textarea
                                    value={currentPlan.description}
                                    onChange={e => setCurrentPlan({ ...currentPlan, description: e.target.value })}
                                    placeholder="Ej. 2 lavados completos, encerado incluido..."
                                    rows={4}
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontFamily: 'inherit' }}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                <button onClick={() => setIsEditing(false)} style={{ padding: '0.75rem 1.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}>Cancelar</button>
                                <button onClick={handleSavePlan} style={{ padding: '0.75rem 1.5rem', borderRadius: '0.5rem', border: 'none', backgroundColor: 'var(--success)', color: 'white', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Save size={18} /> Guardar Plan
                                </button>
                            </div>
                        </div>
                    )}
                </>
            ) : (
                <div>
                    {/* MRR STATS & ACTIONS */}
                    <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: '250px', backgroundColor: 'var(--bg-card)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid var(--border-color)' }}>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Ingreso Mensual Estimado (MRR)</div>
                            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#10b981' }}>${mrr.toFixed(2)}</div>
                        </div>
                        <div style={{ flex: 1, minWidth: '250px', backgroundColor: 'var(--bg-card)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid var(--border-color)' }}>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Suscripciones Activas</div>
                            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary)' }}>{subscriptions.length}</div>
                        </div>

                        {/* AUTO CHECK BUTTON */}
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            <button
                                onClick={() => {
                                    const today = new Date().toISOString().split('T')[0];
                                    const overdue = subscriptions.filter(s => s.next_billing_date && s.next_billing_date <= today);

                                    if (overdue.length > 0) {
                                        alert(`⚠️ HAY ${overdue.length} PAGO(S) VENCIDO(S):\n\n` + overdue.map(s => `- ${s.customers?.name} ($${s.memberships?.price})`).join('\n'));
                                    } else {
                                        alert("✅ Todo al día. Ningún pago vencido.");
                                    }
                                }}
                                className="btn"
                                style={{
                                    backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)',
                                    padding: '1rem 2rem', borderRadius: '0.8rem', border: '2px solid var(--primary)',
                                    fontWeight: 'bold', cursor: 'pointer', display: 'flex', gap: '0.5rem', alignItems: 'center'
                                }}
                            >
                                <CheckCircle size={20} color="var(--primary)" />
                                Verificar Vencidos
                            </button>
                        </div>
                    </div>

                    <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '1rem', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ backgroundColor: 'var(--bg-secondary)', textAlign: 'left' }}>
                                    <th style={{ padding: '1rem' }}>Cliente</th>
                                    <th style={{ padding: '1rem' }}>Plan</th>
                                    <th style={{ padding: '1rem' }}>Próximo Cobro</th>
                                    <th style={{ padding: '1rem' }}>Uso</th>
                                    <th style={{ padding: '1rem', textAlign: 'right' }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {subscriptions
                                    .filter(s => activeTab === 'pending' ? s.status === 'pending_payment' : s.status === 'active')
                                    .map(sub => {
                                    const today = new Date().toISOString().split('T')[0];
                                    const isOverdue = sub.next_billing_date && sub.next_billing_date <= today && sub.status === 'active';

                                    return (
                                        <tr key={sub.id} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: isOverdue ? 'rgba(239, 68, 68, 0.1)' : 'transparent' }}>
                                            <td style={{ padding: '1rem' }}>
                                                <div style={{ fontWeight: 'bold' }}>{sub.customers?.name}</div>
                                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{sub.customers?.phone}</div>
                                                {sub.vehicles && (
                                                    <div style={{
                                                        marginTop: '0.25rem',
                                                        fontSize: '0.8rem',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '0.25rem',
                                                        padding: '0.1rem 0.4rem',
                                                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                                                        color: 'var(--primary)',
                                                        borderRadius: '4px',
                                                        border: '1px solid rgba(99, 102, 241, 0.2)'
                                                    }}>
                                                        🚗 {sub.vehicles.brand} {sub.vehicles.model} ({sub.vehicles.plate})
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{ padding: '1rem' }}>
                                                <div>{sub.memberships?.name}</div>
                                                {editingPriceId === sub.id ? (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.25rem' }}>
                                                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>$</span>
                                                        <input
                                                            type="number"
                                                            value={editingPriceValue}
                                                            onChange={e => setEditingPriceValue(e.target.value)}
                                                            placeholder={sub.memberships?.price?.toString()}
                                                            autoFocus
                                                            onKeyDown={e => { if (e.key === 'Enter') handleSavePrice(sub.id); if (e.key === 'Escape') setEditingPriceId(null); }}
                                                            style={{
                                                                width: '80px', padding: '0.25rem 0.4rem', borderRadius: '0.25rem',
                                                                border: '2px solid gold', backgroundColor: 'rgba(255, 215, 0, 0.1)',
                                                                color: 'white', textAlign: 'center', fontSize: '0.85rem'
                                                            }}
                                                        />
                                                        <button onClick={() => handleSavePrice(sub.id)} title="Guardar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--success)', padding: '0.15rem' }}>
                                                            <Save size={14} />
                                                        </button>
                                                        <button onClick={() => setEditingPriceId(null)} title="Cancelar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '0.15rem' }}>
                                                            <X size={14} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.15rem' }}>
                                                        {sub.manual_price != null ? (
                                                            <>
                                                                <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'gold' }}>${sub.manual_price}/mes</span>
                                                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>${sub.memberships?.price}</span>
                                                            </>
                                                        ) : (
                                                            <span style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 'bold' }}>${sub.memberships?.price}/mes</span>
                                                        )}
                                                        <button
                                                            onClick={() => { setEditingPriceId(sub.id); setEditingPriceValue(sub.manual_price != null ? sub.manual_price.toString() : ''); }}
                                                            title="Editar precio"
                                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.15rem', opacity: 0.6, transition: 'opacity 0.2s' }}
                                                            onMouseEnter={e => e.currentTarget.style.opacity = 1}
                                                            onMouseLeave={e => e.currentTarget.style.opacity = 0.6}
                                                        >
                                                            <Pencil size={13} />
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{ padding: '1rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: isOverdue ? 'var(--danger)' : 'inherit', fontWeight: isOverdue ? 'bold' : 'normal' }}>
                                                    <Calendar size={14} className={!isOverdue && "text-muted"} />
                                                    {sub.next_billing_date || 'Pendiente'}
                                                    {isOverdue && <span style={{ fontSize: '0.7rem', backgroundColor: 'var(--danger)', color: 'white', padding: '0.1rem 0.3rem', borderRadius: '4px' }}>VENCIDO</span>}
                                                </div>
                                            </td>
                                            <td style={{ padding: '1rem' }}>
                                                {sub.memberships?.type === 'unlimited' ? (
                                                    <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>Ilimitado</span>
                                                ) : (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Usados:</span>
                                                            <input
                                                                type="number"
                                                                value={sub.usage_count}
                                                                onChange={(e) => handleUpdateUsage(sub.id, e.target.value)}
                                                                style={{
                                                                    width: '50px',
                                                                    padding: '0.25rem',
                                                                    borderRadius: '0.25rem',
                                                                    border: '1px solid var(--border-color)',
                                                                    backgroundColor: 'var(--bg-secondary)',
                                                                    color: 'var(--text-primary)',
                                                                    textAlign: 'center'
                                                                }}
                                                            />
                                                        </div>
                                                        <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--primary)', backgroundColor: 'rgba(59, 130, 246, 0.1)', padding: '0.2rem 0.5rem', borderRadius: '0.25rem' }}>
                                                            {Math.max(0, (sub.memberships?.limit_count || 0) - (sub.usage_count || 0))} Libres
                                                        </div>
                                                    </div>
                                                )}
                                             </td>
                                             <td style={{ padding: '1rem', textAlign: 'right' }}>
                                                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.75rem' }}>
                                                    <button
                                                        onClick={() => openHistory(sub)}
                                                        title="Historial de Pagos y Añadir Pagos"
                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8b5cf6', padding: '0.25rem' }}
                                                    >
                                                        <History size={18} />
                                                    </button>
                                                    
                                                    <button
                                                        onClick={() => handleCollectPayment(sub)}
                                                        className="btn"
                                                        style={{
                                                            backgroundColor: sub.status === 'pending_payment' ? 'var(--primary)' : 'var(--success)', 
                                                            color: 'white', padding: '0.4rem 0.8rem',
                                                            borderRadius: '0.5rem', border: 'none', fontWeight: 'bold', cursor: 'pointer',
                                                            display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem'
                                                        }}
                                                    >
                                                        <DollarSign size={14} /> {sub.status === 'pending_payment' ? 'Activar' : 'Cobrar'}
                                                    </button>

                                                    <button
                                                        onClick={() => handleDeleteMembership(sub.id)}
                                                        title="Eliminar Membresía"
                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '0.25rem' }}
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {subscriptions.length === 0 && (
                                    <tr>
                                        <td colSpan="5" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                            No hay suscripciones activas vinculadas.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* PAYMENT HISTORY MODAL */}
            {isHistoryModalOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
                }}>
                    <div className="card" style={{ width: '100%', maxWidth: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                            <h3 style={{ margin: 0 }}>Historial: {selectedHistorySub?.customers?.name}</h3>
                            <button 
                                onClick={() => { setIsAddingPayment(!isAddingPayment); if (!isAddingPayment) setManualPaymentData({ ...manualPaymentData, concept: `PAGO MEMBRESÍA: ${selectedHistorySub?.memberships?.name}`, amount: selectedHistorySub?.manual_price || selectedHistorySub?.memberships?.price || '' }); }} 
                                className="btn" 
                                style={{ backgroundColor: isAddingPayment ? 'var(--danger)' : 'var(--primary)', color: 'white', fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                            >
                                {isAddingPayment ? 'Cancelar' : '+ Añadir Pago'}
                            </button>
                        </div>

                        {isAddingPayment && (
                            <div style={{ padding: '1rem', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid var(--primary)' }}>
                                <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem' }}>Añadir Pago Manual</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Monto ($)</label>
                                        <input type="number" className="input" value={manualPaymentData.amount} onChange={e => setManualPaymentData({ ...manualPaymentData, amount: e.target.value })} style={{ padding: '0.4rem' }} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Fecha</label>
                                        <input type="date" className="input" value={manualPaymentData.date} onChange={e => setManualPaymentData({ ...manualPaymentData, date: e.target.value })} style={{ padding: '0.4rem' }} />
                                    </div>
                                </div>
                                <div style={{ marginBottom: '0.75rem' }}>
                                    <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Concepto</label>
                                    <input type="text" className="input" value={manualPaymentData.concept} onChange={e => setManualPaymentData({ ...manualPaymentData, concept: e.target.value })} placeholder="Ej. Pago Mes Agosto" style={{ padding: '0.4rem' }} />
                                </div>
                                <button onClick={handleAddManualPayment} className="btn btn-primary" style={{ width: '100%', padding: '0.5rem' }}>Guardar Pago</button>
                            </div>
                        )}

                        <div style={{ overflowY: 'auto', flex: 1 }}>
                            {historyLoading ? (
                                <div style={{ textAlign: 'center', padding: '2rem' }}>Cargando historial...</div>
                            ) : paymentHistory.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>No hay pagos registrados para esta membresía.</div>
                            ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                            <th style={{ padding: '0.75rem' }}>Fecha</th>
                                            <th style={{ padding: '0.75rem' }}>Concepto</th>
                                            <th style={{ padding: '0.75rem' }}>Monto</th>
                                            <th style={{ padding: '0.75rem', textAlign: 'right' }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paymentHistory.map(tx => (
                                            <tr key={tx.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                <td style={{ padding: '0.75rem' }}>{new Date(tx.date).toLocaleDateString()}</td>
                                                <td style={{ padding: '0.75rem', fontSize: '0.9rem' }}>
                                                    {tx.extras && tx.extras[0]?.description}
                                                </td>
                                                <td style={{ padding: '0.75rem', fontWeight: 'bold', color: 'var(--success)' }}>
                                                    ${tx.total_price || tx.price}
                                                </td>
                                                <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                                                    <button
                                                        onClick={() => handleDeletePayment(tx.id)}
                                                        style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', opacity: 0.7 }}
                                                        title="Borrar Pago"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end' }}>
                            <button 
                                onClick={() => setIsHistoryModalOpen(false)}
                                className="btn"
                                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MembershipSettings;
