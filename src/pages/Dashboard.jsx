import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Plus, Car, Trash2 } from 'lucide-react';
import useSupabase from '../hooks/useSupabase';

const Dashboard = () => {
    const [myUserId, setMyUserId] = useState(null);
    const [userRole, setUserRole] = useState(null); // Estado para el rol

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setMyUserId(user.id);

                // Consultar el rol del empleado
                const { data: employee } = await supabase
                    .from('employees')
                    .select('role')
                    .eq('user_id', user.id)
                    .single();

                if (employee) {
                    setUserRole(employee.role);
                    console.log("Rol detectado:", employee.role);
                }
            }
        };
        getUser();
    }, []);

    const { data: services } = useSupabase('services');
    const { data: employees } = useSupabase('employees');
    const { data: customers } = useSupabase('customers');
    const { data: transactions, create: createTransaction } = useSupabase('transactions');

    const [isModalOpen, setIsModalOpen] = useState(false);

    // Transaction Form State
    const [formData, setFormData] = useState({
        customerId: '',
        serviceId: '',
        employeeId: '',
        price: '',
        commissionAmount: '',
        tipAmount: '',
        paymentMethod: 'cash',
        serviceTime: new Date().toTimeString().slice(0, 5),
        extras: []
    });

    const [newExtra, setNewExtra] = useState({ description: '', price: '' });

    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Puerto_Rico' });
    const todaysTransactions = transactions.filter(t => t.date && t.date.startsWith(today));

    const totalIncome = todaysTransactions.reduce((sum, t) => sum + (parseFloat(t.total_price) || 0), 0);
    const totalCommissions = todaysTransactions.reduce((sum, t) => sum + (parseFloat(t.commission_amount) || 0) + (parseFloat(t.tip_amount) || 0), 0);

    const handleServiceChange = (e) => {
        const serviceId = e.target.value;
        const service = services.find(s => s.id === serviceId);
        if (service) {
            setFormData({
                ...formData,
                serviceId,
                price: service.price,
                commissionAmount: service.price * service.commission_rate
            });
        } else {
            setFormData({ ...formData, serviceId: '', price: '', commissionAmount: '' });
        }
    };

    const handleAddExtra = () => {
        if (newExtra.description && newExtra.price) {
            setFormData({
                ...formData,
                extras: [...formData.extras, { ...newExtra, price: parseFloat(newExtra.price) }]
            });
            setNewExtra({ description: '', price: '' });
        }
    };

    const handleRemoveExtra = (index) => {
        const newExtras = [...formData.extras];
        newExtras.splice(index, 1);
        setFormData({ ...formData, extras: newExtras });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const basePrice = parseFloat(formData.price) || 0;
        const extrasTotal = formData.extras.reduce((sum, extra) => sum + extra.price, 0);
        const tip = parseFloat(formData.tipAmount) || 0;
        const totalPrice = basePrice + extrasTotal + tip;

        const transactionDate = new Date();
        const [hours, minutes] = formData.serviceTime.split(':');
        transactionDate.setHours(hours, minutes, 0, 0);

        const newTransaction = {
            date: transactionDate.toISOString(),
            customer_id: formData.customerId,
            service_id: formData.serviceId,
            employee_id: myUserId,
            price: basePrice,
            commission_amount: parseFloat(formData.commissionAmount),
            tip_amount: tip,
            payment_method: formData.paymentMethod,
            extras: formData.extras,
            total_price: totalPrice
        };

        try {
            await createTransaction(newTransaction);
            setIsModalOpen(false);
            setFormData({
                customerId: '',
                serviceId: '',
                employeeId: '',
                price: '',
                commissionAmount: '',
                tipAmount: '',
                paymentMethod: 'cash',
                serviceTime: new Date().toTimeString().slice(0, 5),
                extras: []
            });
        } catch (error) {
            alert('Error al registrar venta: ' + error.message);
        }
    };

    const getCustomerName = (id) => customers.find(c => c.id === id)?.name || 'Cliente Casual';
    const getServiceName = (id) => services.find(s => s.id === id)?.name || 'Servicio Desconocido';

    const getPaymentMethodLabel = (method) => {
        switch (method) {
            case 'cash': return 'Efectivo';
            case 'card': return 'Tarjeta';
            case 'transfer': return 'AthMóvil';
            default: return method;
        }
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', marginBottom: '0.5rem' }}>Dashboard</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Resumen de operaciones del día: {today}</p>
                </div>

                {/* SOLO MOSTRAR SI ES ADMIN */}
                {userRole === 'admin' && (
                    <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
                        <Plus size={20} />
                        Registrar Servicio
                    </button>
                )}

                {/* DEBUG: Botón de Rescate para Admin */}
                {!userRole && (
                    <button
                        onClick={async () => {
                            const { data: { user } } = await supabase.auth.getUser();
                            if (!user) return;

                            // Intentar vincular al primer empleado admin que no tenga user_id
                            // O forzar la vinculación al empleado 'Gerardo' si existe
                            const { error } = await supabase
                                .from('employees')
                                .update({ user_id: user.id })
                                .eq('role', 'admin')
                                .is('user_id', null); // Solo si está libre

                            if (error) {
                                alert("Error: " + error.message);
                            } else {
                                alert("¡Cuenta vinculada como Admin! Recargando...");
                                window.location.reload();
                            }
                        }}
                        style={{
                            marginLeft: '1rem',
                            padding: '0.5rem 1rem',
                            backgroundColor: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '0.5rem',
                            cursor: 'pointer',
                            fontSize: '0.8rem'
                        }}
                    >
                        ⚠️ Soy el Dueño (Activar Admin)
                    </button>
                )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                <div className="card">
                    <h3 className="label">Autos Lavados Hoy</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <Car size={32} className="text-primary" />
                        <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary)' }}>{todaysTransactions.length}</p>
                    </div>
                </div>
                <div className="card">
                    <h3 className="label">Ingresos Totales Hoy</h3>
                    <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--success)' }}>${totalIncome.toFixed(2)}</p>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>(Incluye extras y propinas)</p>
                </div>
                <div className="card">
                    <h3 className="label">Comisiones + Propinas</h3>
                    <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--warning)' }}>${totalCommissions.toFixed(2)}</p>
                </div>
            </div>

            {isModalOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000,
                    overflowY: 'auto'
                }}>
                    <div className="card" style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
                        <h3 style={{ marginBottom: '1.5rem' }}>Registrar Nuevo Servicio</h3>
                        <form onSubmit={handleSubmit}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div style={{ marginBottom: '1rem' }}>
                                    <label className="label">Cliente</label>
                                    <select
                                        className="input"
                                        required
                                        value={formData.customerId}
                                        onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                                    >
                                        <option value="">Seleccionar Cliente...</option>
                                        {customers.map(c => (
                                            <option key={c.id} value={c.id}>{c.name} - {c.vehicle_plate}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div style={{ marginBottom: '1rem' }}>
                                <label className="label">Servicio Principal</label>
                                <select
                                    className="input"
                                    required
                                    value={formData.serviceId}
                                    onChange={handleServiceChange}
                                >
                                    <option value="">Seleccionar Servicio...</option>
                                    {services.map(s => (
                                        <option key={s.id} value={s.id}>{s.name} - ${s.price}</option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ marginBottom: '1rem' }}>
                                <label className="label">Hora del Servicio</label>
                                <input
                                    type="time"
                                    className="input"
                                    required
                                    value={formData.serviceTime}
                                    onChange={(e) => setFormData({ ...formData, serviceTime: e.target.value })}
                                />
                            </div>

                            <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '0.5rem' }}>
                                <label className="label" style={{ marginBottom: '0.5rem', display: 'block' }}>Servicios Adicionales (Extras)</label>

                                {formData.extras.map((extra, index) => (
                                    <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                                        <span>{extra.description}</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <span>${extra.price.toFixed(2)}</span>
                                            <button type="button" onClick={() => handleRemoveExtra(index)} style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer' }}>
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                    <input
                                        type="text"
                                        className="input"
                                        placeholder="Descripción (ej. Aspirado)"
                                        value={newExtra.description}
                                        onChange={(e) => setNewExtra({ ...newExtra, description: e.target.value })}
                                        style={{ flex: 2 }}
                                    />
                                    <input
                                        type="number"
                                        className="input"
                                        placeholder="Precio"
                                        value={newExtra.price}
                                        onChange={(e) => setNewExtra({ ...newExtra, price: e.target.value })}
                                        style={{ flex: 1 }}
                                    />
                                    <button type="button" className="btn btn-primary" onClick={handleAddExtra}>
                                        <Plus size={16} />
                                    </button>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div style={{ marginBottom: '1rem' }}>
                                    <label className="label">Propina</label>
                                    <input
                                        type="number"
                                        className="input"
                                        value={formData.tipAmount}
                                        onChange={(e) => setFormData({ ...formData, tipAmount: e.target.value })}
                                    />
                                </div>
                                <div style={{ marginBottom: '1rem' }}>
                                    <label className="label">Método de Pago</label>
                                    <select
                                        className="input"
                                        value={formData.paymentMethod}
                                        onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                                    >
                                        <option value="cash">Efectivo</option>
                                        <option value="card">Tarjeta</option>
                                        <option value="transfer">AthMóvil</option>
                                    </select>
                                </div>
                            </div>

                            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                                <button type="button" className="btn" onClick={() => setIsModalOpen(false)} style={{ backgroundColor: 'var(--bg-secondary)', color: 'white' }}>
                                    Cancelar
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    Registrar Venta
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="card">
                <h3 className="label" style={{ marginBottom: '1rem' }}>Historial de Hoy</h3>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                                <th style={{ padding: '1rem' }}>Hora</th>
                                <th style={{ padding: '1rem' }}>Cliente</th>
                                <th style={{ padding: '1rem' }}>Servicio</th>
                                <th style={{ padding: '1rem' }}>Total</th>
                                <th style={{ padding: '1rem' }}>Pago</th>
                            </tr>
                        </thead>
                        <tbody>
                            {todaysTransactions.map(t => (
                                <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <td style={{ padding: '1rem' }}>{new Date(t.date).toLocaleTimeString('es-PR', { timeZone: 'America/Puerto_Rico', hour: '2-digit', minute: '2-digit' })}</td>
                                    <td style={{ padding: '1rem' }}>{getCustomerName(t.customer_id)}</td>
                                    <td style={{ padding: '1rem' }}>
                                        {getServiceName(t.service_id)}
                                        {t.extras && t.extras.length > 0 && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>+ {t.extras.length} extras</span>}
                                    </td>
                                    <td style={{ padding: '1rem', fontWeight: 'bold' }}>${t.total_price}</td>
                                    <td style={{ padding: '1rem' }}>
                                        <span style={{
                                            padding: '0.25rem 0.75rem',
                                            borderRadius: '1rem',
                                            fontSize: '0.875rem',
                                            backgroundColor: 'rgba(99, 102, 241, 0.1)',
                                            color: 'var(--primary)'
                                        }}>
                                            {getPaymentMethodLabel(t.payment_method)}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {todaysTransactions.length === 0 && (
                                <tr>
                                    <td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        No hay ventas registradas hoy
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
