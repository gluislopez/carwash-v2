import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit, Tag } from 'lucide-react';
import useSupabase from '../hooks/useSupabase';
import { supabase } from '../supabase';

const Services = () => {
    const { data: services, create, remove, update } = useSupabase('services');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [userRole, setUserRole] = useState(null);
    const [editingService, setEditingService] = useState(null);

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

    const [formData, setFormData] = useState({ name: '', price: '', commission: '' });

    const openModal = (service = null) => {
        if (service) {
            setEditingService(service);
            setFormData({ name: service.name, price: service.price, commission: service.commission || '' });
        } else {
            setEditingService(null);
            setFormData({ name: '', price: '', commission: '' });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingService) await update(editingService.id, formData);
            else await create(formData);
            setIsModalOpen(false);
        } catch (error) { alert('Error al guardar servicio: ' + error.message); }
    };

    const handleDelete = async (id) => {
        if (window.confirm('¿Estás seguro de eliminar este servicio?')) { await remove(id); }
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div><h1 style={{ fontSize: '1.875rem', marginBottom: '0.5rem' }}>Servicios</h1><p style={{ color: 'var(--text-muted)' }}>Catálogo de precios y comisiones</p></div>
                {userRole === 'admin' && (<button className="btn btn-primary" onClick={() => openModal()}><Plus size={20} /> Nuevo Servicio</button>)}
            </div>

            <div className="card">
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead><tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}><th style={{ padding: '1rem' }}>Nombre</th><th style={{ padding: '1rem' }}>Precio</th><th style={{ padding: '1rem' }}>Comisión</th>{userRole === 'admin' && <th style={{ padding: '1rem', textAlign: 'right' }}>Acciones</th>}</tr></thead>
                        <tbody>
                            {services.map((service) => (
                                <tr key={service.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <td style={{ padding: '1rem', fontWeight: 'bold' }}>{service.name}</td>
                                    <td style={{ padding: '1rem' }}>${service.price}</td>
                                    <td style={{ padding: '1rem' }}>${service.commission}</td>
                                    {userRole === 'admin' && (<td style={{ padding: '1rem', textAlign: 'right' }}><button onClick={() => openModal(service)} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', marginRight: '1rem' }}><Edit size={18} /></button><button onClick={() => handleDelete(service.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}><Trash2 size={18} /></button></td>)}
                                </tr>
                            ))}
                            {services.length === 0 && (<tr><td colSpan="4" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No hay servicios registrados.</td></tr>)}
                        </tbody>
                    </table>
                </div>
            </div>

            {isModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                    <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
                        <h3 style={{ marginBottom: '1.5rem' }}>{editingService ? 'Editar Servicio' : 'Nuevo Servicio'}</h3>
                        <form onSubmit={handleSubmit}>
                            <div style={{ marginBottom: '1rem' }}><label className="label">Nombre del Servicio</label><input type="text" className="input" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                <div><label className="label">Precio ($)</label><input type="number" className="input" required value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} /></div>
                                <div><label className="label">Comisión Fija ($)</label><input type="number" step="0.01" className="input" required value={formData.commission} onChange={(e) => setFormData({ ...formData, commission: e.target.value })} /></div>
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
