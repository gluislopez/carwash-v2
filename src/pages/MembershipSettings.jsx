import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Plus, Trash2, Edit2, Save, X, Award, CheckCircle, Info } from 'lucide-react';

const MembershipSettings = () => {
    const [memberships, setMemberships] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [currentPlan, setCurrentPlan] = useState({
        name: '',
        description: '',
        price: '',
        type: 'limit',
        limit_count: 0
    });

    useEffect(() => {
        fetchMemberships();
    }, []);

    const fetchMemberships = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('memberships')
            .select('*')
            .order('created_at', { ascending: true });

        if (data) setMemberships(data);
        setLoading(false);
    };

    const handleSavePlan = async () => {
        if (!currentPlan.name || !currentPlan.price) return alert("Nombre y precio requeridos.");

        const planToSave = {
            ...currentPlan,
            price: parseFloat(currentPlan.price)
        };

        if (currentPlan.id) {
            await supabase.from('memberships').update(planToSave).eq('id', currentPlan.id);
        } else {
            await supabase.from('memberships').insert([planToSave]);
        }

        setIsEditing(false);
        setCurrentPlan({ name: '', description: '', price: '', type: 'limit', limit_count: 0 });
        fetchMemberships();
    };

    const handleDeletePlan = async (id) => {
        if (confirm("¿Borrar este plan de membresía?")) {
            await supabase.from('memberships').delete().eq('id', id);
            fetchMemberships();
        }
    };

    return (
        <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', color: 'var(--text-primary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                <div style={{ padding: '0.75rem', backgroundColor: 'var(--primary)', borderRadius: '0.5rem', color: 'white' }}>
                    <Award size={24} />
                </div>
                <div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>Planes de Membresía</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Configura los niveles de suscripción para tus clientes.</p>
                </div>
            </div>

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
        </div>
    );
};

export default MembershipSettings;
