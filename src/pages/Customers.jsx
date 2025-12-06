import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit, Phone, Mail, Car, Search } from 'lucide-react';
import useSupabase from '../hooks/useSupabase';
import { supabase } from '../supabase';

const Customers = () => {
    const { data: customers, create, remove, update } = useSupabase('customers', '*', { orderBy: { column: 'name', ascending: true } });
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [userRole, setUserRole] = useState(null);
    const [editingCustomer, setEditingCustomer] = useState(null);

    // Search and Stats State
    const [searchTerm, setSearchTerm] = useState('');
    const [visitCounts, setVisitCounts] = useState({});

    // Obtener el rol del usuario actual y conteo de visitas
    useEffect(() => {
        const getUserRole = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: employee } = await supabase.from('employees').select('role').eq('user_id', user.id).single();
                if (employee) setUserRole(employee.role);
            }
        };

        const getVisitCounts = async () => {
            const { data: transactions } = await supabase
                .from('transactions')
                .select('customer_id');

            if (transactions) {
                const counts = {};
                transactions.forEach(t => {
                    if (t.customer_id) {
                        counts[t.customer_id] = (counts[t.customer_id] || 0) + 1;
                    }
                });
                setVisitCounts(counts);
            }
        };

        getUserRole();
        getVisitCounts();
    }, []);

    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        email: '',
        vehicle_plate: '',
        vehicle_model: '',
        points: 0
    });

    const openModal = (customer) => {
        if (customer) {
            setEditingCustomer(customer);
            setFormData({
                name: customer.name,
                phone: customer.phone || '',
                email: customer.email || '',
                vehicle_plate: customer.vehicle_plate || '',
                vehicle_model: customer.vehicle_model || '',
                points: customer.points || 0
            });
        } else {
            setEditingCustomer(null);
            setFormData({ name: '', phone: '', email: '', vehicle_plate: '', vehicle_model: '', points: 0 });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const customerData = {
                ...formData,
                email: formData.email.trim() === '' ? null : formData.email.trim()
            };

            if (editingCustomer) {
                await update(editingCustomer.id, customerData);
            } else {
                await create(customerData);
            }
            setIsModalOpen(false);
        } catch (error) {
            alert('Error al guardar cliente: ' + error.message);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('¿Estás seguro de eliminar este cliente?')) {
            await remove(id);
        }
    };

    // Filter customers
    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.vehicle_plate && c.vehicle_plate.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (c.phone && c.phone.includes(searchTerm))
    );

    return (
        <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1 style={{ fontSize: '1.875rem', marginBottom: '0.5rem' }}>Clientes</h1>
                        <p style={{ color: 'var(--text-muted)' }}>Directorio de clientes y vehículos</p>
                    </div>

                    {/* SOLO ADMIN PUEDE CREAR */}
                    {userRole === 'admin' && (
                        <button className="btn btn-primary" onClick={() => openModal()}>
                            <Plus size={20} />
                            Nuevo Cliente
                        </button>
                    )}
                </div>

                {/* SEARCH BAR */}
                <div style={{ position: 'relative', maxWidth: '400px' }}>
                    <Search size={20} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, tablilla o teléfono..."
                        className="input"
                        style={{
                            paddingLeft: '3rem',
                            width: '100%',
                            backgroundColor: 'var(--bg-card)',
                            color: 'white',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-md)',
                            paddingTop: '0.75rem',
                            paddingBottom: '0.75rem'
                        }}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                {filteredCustomers.map((customer) => (
                    <div key={customer.id} className="card" style={{ position: 'relative' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                            <div style={{
                                width: '50px', height: '50px', borderRadius: '50%',
                                backgroundColor: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <span style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>
                                    {customer.name.charAt(0).toUpperCase()}
                                </span>
                            </div>
                            <div>
                                <h3 style={{ fontWeight: 'bold' }}>{customer.name}</h3>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <span style={{
                                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                                        color: 'var(--primary)',
                                        padding: '0.1rem 0.5rem',
                                        borderRadius: '1rem',
                                        fontWeight: 'bold',
                                        fontSize: '0.8rem'
                                    }}>
                                        {visitCounts[customer.id] || 0} Visitas
                                    </span>
                                    <span style={{
                                        backgroundColor: 'rgba(255, 215, 0, 0.1)',
                                        color: '#D97706',
                                        padding: '0.1rem 0.5rem',
                                        borderRadius: '1rem',
                                        fontWeight: 'bold',
                                        fontSize: '0.8rem',
                                        border: '1px solid rgba(255, 215, 0, 0.3)'
                                    }}>
                                        🌟 {customer.points || 0} Pts
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Car size={16} className="text-primary" />
                                <span style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>{customer.vehicle_model}</span>
                                <span style={{ backgroundColor: 'var(--bg-secondary)', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.8rem' }}>
                                    {customer.vehicle_plate}
                                </span>
                            </div>
                            {customer.phone && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Phone size={16} /> {customer.phone}
                                </div>
                            )}
                            {customer.email && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Mail size={16} /> {customer.email}
                                </div>
                            )}
                        </div>

                        {userRole === 'admin' && (
                            <div style={{ position: 'absolute', top: '1rem', right: '1rem', display: 'flex', gap: '0.5rem' }}>
                                <button onClick={() => openModal(customer)} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer' }}>
                                    <Edit size={18} />
                                </button>
                                <button onClick={() => handleDelete(customer.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}>
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        )}
                    </div>
                ))}
                {
                    filteredCustomers.length === 0 && (
                        <div style={{ gridColumn: '1 / -1', padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                            {searchTerm ? 'No se encontraron clientes.' : 'No hay clientes registrados.'}
                        </div>
                    )
                }
            </div>

            {isModalOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
                }}>
                    <div className="card" style={{ width: '100%', maxWidth: '500px' }}>
                        <h3 style={{ marginBottom: '1.5rem' }}>{editingCustomer ? 'Editar Cliente' : 'Nuevo Cliente'}</h3>
                        <form onSubmit={handleSubmit}>
                            <div style={{ marginBottom: '1rem' }}>
                                <label className="label">Nombre Completo</label>
                                <input
                                    type="text"
                                    className="input"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                <div>
                                    <label className="label">Teléfono</label>
                                    <input
                                        type="tel"
                                        className="input"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="label">Email <span style={{ fontWeight: 'normal', color: 'var(--text-muted)', fontSize: '0.8rem' }}>(Opcional)</span></label>
                                    <input
                                        type="email"
                                        className="input"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                <div>
                                    <label className="label">Modelo Vehículo</label>
                                    <input
                                        type="text"
                                        className="input"
                                        placeholder="Ej. Toyota Corolla"
                                        value={formData.vehicle_model}
                                        onChange={(e) => setFormData({ ...formData, vehicle_model: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="label">Tablilla (Placa)</label>
                                    <input
                                        type="text"
                                        className="input"
                                        placeholder="ABC-123"
                                        value={formData.vehicle_plate}
                                        onChange={(e) => setFormData({ ...formData, vehicle_plate: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* Puntos (Solo Admin/Manager) */}
                            {(userRole === 'admin' || userRole === 'manager') && (
                                <div style={{ marginBottom: '1rem' }}>
                                    <label className="label">Puntos de Lealtad</label>
                                    <input
                                        type="number"
                                        className="input"
                                        value={formData.points}
                                        onChange={(e) => setFormData({ ...formData, points: parseInt(e.target.value) || 0 })}
                                    />
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                                <button type="button" className="btn" onClick={() => setIsModalOpen(false)} style={{ backgroundColor: 'var(--bg-secondary)', color: 'white' }}>
                                    Cancelar
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    {editingCustomer ? 'Actualizar' : 'Guardar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Customers;
