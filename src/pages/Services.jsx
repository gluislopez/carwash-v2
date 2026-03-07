import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit, Tag } from 'lucide-react';
import useSupabase from '../hooks/useSupabase';
import { supabase } from '../supabase';

const Services = () => {
    const { data: services, create, remove, update, error: dbError } = useSupabase('services');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [userRole, setUserRole] = useState(null);
    const [editingService, setEditingService] = useState(null);
    const [togglingId, setTogglingId] = useState(null);

    useEffect(() => {
        const getUserRole = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: employee } = await supabase.from('employees').select('role').eq('user_id', user.id).single();
                if (employee) setUserRole(employee.role);
            }
        };
        getUserRole();
    }, []);

    const [formData, setFormData] = useState({ name: '', price: '', commission: '', active: true });

    const openModal = (service = null) => {
        if (service) {
            setEditingService(service);
            setFormData({ name: service.name, price: service.price, commission: service.commission || '', active: service.active ?? true });
        } else {
            setEditingService(null);
            setFormData({ name: '', price: '', commission: '', active: true });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...formData, commission_rate: 0 }; // Dummy value for legacy column
            if (editingService) await update(editingService.id, payload);
            else await create(payload);
            setIsModalOpen(false);
        } catch (error) { alert('Error al guardar servicio: ' + error.message); }
    };

    const handleDelete = async (id) => {
        if (window.confirm('¿Estás seguro de eliminar este servicio?')) { await remove(id); }
    };

    const handleToggleActive = async (service) => {
        if (togglingId) return;

        // Verificación básica de permisos
        if (userRole !== 'admin' && userRole !== 'manager') {
            alert('No tienes permisos suficientes para realizar esta acción.');
            return;
        }

        setTogglingId(service.id);
        try {
            // Si es false -> true. Si es true o null -> false.
            const nextStatus = service.active === false;

            const result = await update(service.id, { active: nextStatus });

            if (!result || result.length === 0) {
                // Si la actualización no devuelve datos, probablemente sea por RLS o falta de la columna
                throw new Error("La base de datos no confirmó el cambio. Verifica que hayas ejecutado el script SQL en Supabase o que tengas permisos.");
            }
        } catch (error) {
            console.error("Toggle error:", error);
            alert('⚠️ Error: ' + error.message);
        } finally {
            setTogglingId(null);
        }
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div><h1 style={{ fontSize: '1.875rem', marginBottom: '0.5rem' }}>Servicios</h1><p style={{ color: 'var(--text-muted)' }}>Catálogo de precios y comisiones</p></div>
                {userRole === 'admin' && (<button className="btn btn-primary" onClick={() => openModal()}><Plus size={20} /> Nuevo Servicio</button>)}
            </div>

            {dbError && (
                <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '1rem', borderRadius: '0.75rem', marginBottom: '1.5rem', border: '1px solid #ef4444', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '1.5rem' }}>⚠️</span>
                    <div>
                        <strong style={{ display: 'block' }}>No se pudo realizar la acción:</strong>
                        <span style={{ fontSize: '0.9rem' }}>
                            {dbError.includes('violates foreign key constraint')
                                ? 'Este servicio no se puede borrar porque ya ha sido utilizado en ventas. Para que no estorbe, simplemente márcalo como "Oculto" y ya no aparecerá para los clientes.'
                                : dbError}
                        </span>
                    </div>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                {services.map((service) => (
                    <div key={service.id} className="card" style={{ position: 'relative' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                            <div style={{
                                width: '50px', height: '50px', borderRadius: '50%',
                                backgroundColor: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <Tag size={24} />
                            </div>
                            <div>
                                <h3 style={{ fontWeight: 'bold' }}>{service.name}</h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--success)' }}>
                                        ${service.price}
                                    </span>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleToggleActive(service);
                                        }}
                                        disabled={togglingId === service.id}
                                        style={{
                                            fontSize: '0.7rem',
                                            padding: '4px 10px',
                                            borderRadius: '6px',
                                            backgroundColor: service.active !== false ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                            color: service.active !== false ? '#059669' : '#DC2626',
                                            border: `1px solid ${service.active !== false ? '#059669' : '#DC2626'}`,
                                            cursor: togglingId === service.id ? 'wait' : 'pointer',
                                            fontWeight: '800',
                                            transition: 'all 0.2s',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            userSelect: 'none',
                                            opacity: togglingId === service.id ? 0.6 : 1,
                                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.5px'
                                        }}
                                        onMouseEnter={(e) => !togglingId && (e.currentTarget.style.transform = 'translateY(-1px)')}
                                        onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                                        title={service.active !== false ? "Click para ocultar" : "Click para mostrar"}
                                    >
                                        {togglingId === service.id ? '⌛ ...' : (service.active !== false ? '● Visible' : '○ Oculto')}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span>Comisión:</span>
                                <span style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>${service.commission}</span>
                            </div>
                        </div>

                        {userRole === 'admin' && (
                            <div style={{ position: 'absolute', top: '1rem', right: '1rem', display: 'flex', gap: '0.5rem' }}>
                                <button onClick={() => openModal(service)} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer' }}>
                                    <Edit size={18} />
                                </button>
                                <button onClick={() => handleDelete(service.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}>
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        )}
                    </div>
                ))}
                {services.length === 0 && (
                    <div style={{ gridColumn: '1 / -1', padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No hay servicios registrados.
                    </div>
                )}
            </div>

            {isModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                    <div className="card modal-card" style={{ width: '100%', maxWidth: '400px' }}>
                        <h3 style={{ marginBottom: '1.5rem' }}>{editingService ? 'Editar Servicio' : 'Nuevo Servicio'}</h3>
                        <form onSubmit={handleSubmit}>
                            <div style={{ marginBottom: '1rem' }}><label className="label">Nombre del Servicio</label><input type="text" className="input" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                <div><label className="label">Precio ($)</label><input type="number" className="input" required value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} /></div>
                                <div><label className="label">Comisión Fija ($)</label><input type="number" step="0.01" className="input" required value={formData.commission} onChange={(e) => setFormData({ ...formData, commission: e.target.value })} /></div>
                            </div>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={formData.active}
                                        onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                                        style={{ width: '18px', height: '18px' }}
                                    />
                                    <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Servicio Activo (Visible en el Portal)</span>
                                </label>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}><button type="button" className="btn" onClick={() => setIsModalOpen(false)} style={{ backgroundColor: 'var(--bg-secondary)', color: 'white' }}>Cancelar</button><button type="submit" className="btn btn-primary">{editingService ? 'Actualizar' : 'Guardar'}</button></div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Services;
