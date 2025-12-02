import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Plus, Car, DollarSign, Users, Trash2 } from 'lucide-react';
import useSupabase from '../hooks/useSupabase';

const Dashboard = () => {
    const [myUserId, setMyUserId] = useState(null);
    const [myEmployeeId, setMyEmployeeId] = useState(null); // Nuevo: ID del perfil de empleado
    const [userRole, setUserRole] = useState(null); // Estado para el rol

    const [debugInfo, setDebugInfo] = useState(""); // DEBUG STATE

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setMyUserId(user.id);

                // DEBUG: Mostrar ID del usuario
                let log = `User ID: ${user.id} \nEmail: ${user.email} \n`;

                // Consultar el rol del empleado
                let { data: employee, error } = await supabase
                    .from('employees')
                    .select('*')
                    .eq('user_id', user.id)
                    .single();

                // AUTO-LINKING: Si no tiene usuario asignado, buscar por email
                // Fetch transactions with assignments
                // NOTE: This block seems to be intended for debugging purposes,
                // but the main transaction data is already fetched via useSupabase.
                // If you intend to manage transactions state here, you'll need a `useState` for it.
                // For now, it's inserted as requested, assuming `setTransactions` would be defined elsewhere
                // or this is a temporary debug block.
                const { data: transactionsData, error: transactionsError } = await supabase
                    .from('transactions')
                    .select(`
    *,
    transaction_assignments(
        employee_id
    )
        `)
                    .order('date', { ascending: false });

                if (transactionsError) throw transactionsError;
                // setTransactions(transactionsData || []); // This line would require a useState for transactions in this scope.

                if (!employee && user.email) {
                    const { data: unlinkedEmployee } = await supabase
                        .from('employees')
                        .select('*')
                        .eq('email', user.email)
                        .is('user_id', null)
                        .single();

                    if (unlinkedEmployee) {
                        // Vincular automáticamente
                        const { error: linkError } = await supabase
                            .from('employees')
                            .update({ user_id: user.id })
                            .eq('id', unlinkedEmployee.id);

                        if (!linkError) {
                            employee = { ...unlinkedEmployee, user_id: user.id };
                            console.log("Cuenta vinculada automáticamente por email:", user.email);
                        }
                    }
                }

                if (employee) {
                    setUserRole(employee.role);
                    setMyEmployeeId(employee.id); // Guardar el ID del perfil
                }
            }
        };
        getUser();
    }, []);

    const { data: services } = useSupabase('services');
    const { data: employees } = useSupabase('employees');
    const { data: customers } = useSupabase('customers');
    const { data: transactions, create: createTransaction, remove: removeTransaction } = useSupabase('transactions', `
        *,
        transaction_assignments (
            employee_id
        )
    `);

    const [isModalOpen, setIsModalOpen] = useState(false);

    // Transaction Form State
    const [formData, setFormData] = useState({
        customerId: '',
        serviceId: '',
        employeeId: '',
        selectedEmployees: [], // Inicializar array vacío
        price: '',
        commissionAmount: '',
        tipAmount: '',
        paymentMethod: 'cash',
        serviceTime: new Date().toTimeString().slice(0, 5),
        extras: []
    });

    const [newExtra, setNewExtra] = useState({ description: '', price: '' });

    // Helper para manejar fechas en zona horaria de Puerto Rico
    const getPRDateString = (dateInput) => {
        if (!dateInput) return '';
        const date = new Date(dateInput);
        return date.toLocaleDateString('en-CA', { timeZone: 'America/Puerto_Rico' });
    };

    const today = getPRDateString(new Date());

    // Filtro corregido: Compara fechas convertidas a PR, no strings crudos
    const todaysTransactions = transactions.filter(t => getPRDateString(t.date) === today);

    // Para empleados: Filtrar SOLO sus transacciones para los contadores
    const myTransactions = todaysTransactions.filter(t => {
        // 1. Verificar si está en la lista de asignaciones (Multi-empleado)
        const isAssigned = t.transaction_assignments?.some(a => a.employee_id === myEmployeeId);
        // 2. Verificar si es el empleado principal (Legacy/Fallback)
        const isPrimary = t.employee_id === myEmployeeId;

        return isAssigned || isPrimary;
    });

    // Si es Admin, usa TODO. Si es Empleado, usa SOLO LO SUYO.
    const statsTransactions = userRole === 'admin' ? todaysTransactions : myTransactions;

    const totalIncome = todaysTransactions.reduce((sum, t) => sum + (parseFloat(t.total_price) || 0), 0);

    // Calcular comisiones basado en el rol (Admin ve total, Empleado ve suyo)
    const totalCommissions = statsTransactions.reduce((sum, t) => {
        // Calcular el monto total de comisión + propina de la transacción
        const txTotalCommission = (parseFloat(t.commission_amount) || 0) + (parseFloat(t.tip_amount) || 0);

        // Determinar cuántos empleados participaron
        // Si hay assignments, usar su longitud. Si no, asumir 1 (el employee_id principal).
        const employeeCount = (t.transaction_assignments && t.transaction_assignments.length > 0)
            ? t.transaction_assignments.length
            : 1;

        // Dividir equitativamente
        const splitCommission = txTotalCommission / employeeCount;

        return sum + splitCommission;
    }, 0);

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

        // Lógica Multi-Empleado
        // Si es Admin, usa los seleccionados. Si es Empleado, se asigna a sí mismo.
        let assignedEmployees = [];
        if (userRole === 'admin') {
            assignedEmployees = formData.selectedEmployees;
            // Si no seleccionó a nadie, forzar al admin actual (fallback)
            if (assignedEmployees.length === 0) assignedEmployees = [myEmployeeId];
        } else {
            assignedEmployees = [myEmployeeId];
        }

        const primaryEmployeeId = assignedEmployees[0]; // Para compatibilidad con columna vieja

        if (!primaryEmployeeId) {
            alert("Error: No se ha podido identificar al empleado. Por favor recarga la página.");
            return;
        }

        const newTransaction = {
            date: transactionDate.toISOString(),
            customer_id: formData.customerId,
            service_id: formData.serviceId,
            employee_id: primaryEmployeeId, // ID principal (legacy)
            price: basePrice,
            commission_amount: parseFloat(formData.commissionAmount),
            tip_amount: tip,
            payment_method: formData.paymentMethod,
            extras: formData.extras,
            total_price: totalPrice
        };

        try {
            // 1. Crear la transacción base
            const [createdTx] = await createTransaction(newTransaction);

            if (createdTx) {
                // 2. Crear las asignaciones en la tabla intermedia
                const assignments = assignedEmployees.map(empId => ({
                    transaction_id: createdTx.id,
                    employee_id: empId
                }));

                const { error: assignError } = await supabase
                    .from('transaction_assignments')
                    .insert(assignments);

                if (assignError) console.error("Error asignando empleados:", assignError);
            }

            setIsModalOpen(false);
            setFormData({
                customerId: '',
                serviceId: '',
                employeeId: '',
                selectedEmployees: [], // Reset selección múltiple
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
    const getEmployeeName = (id) => employees.find(e => e.id === id)?.name || 'Desconocido';

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
                    <h1 style={{ fontSize: '1.875rem', marginBottom: '0.5rem' }}>Dashboard <span style={{ fontSize: '1rem', color: 'var(--text-muted)', opacity: 0.7 }}>v2.2</span></h1>
                    <p style={{ color: 'var(--text-muted)' }}>Resumen de operaciones del día: {today}</p>
                </div>

                {/* SOLO MOSTRAR SI ES ADMIN */}
                {userRole === 'admin' && (
                    <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
                        <Plus size={20} />
                        Registrar Servicio
                    </button>
                )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                <div className="card">
                    <h3 className="label">{userRole === 'admin' ? 'Autos Lavados Hoy' : 'Mis Autos Lavados'}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <Car size={32} className="text-primary" />
                        <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary)' }}>{statsTransactions.length}</p>
                    </div>
                </div>

                {/* SOLO ADMIN VE INGRESOS TOTALES */}
                {userRole === 'admin' && (
                    <div className="card">
                        <h3 className="label">Ingresos Totales Hoy</h3>
                        <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--success)' }}>${totalIncome.toFixed(2)}</p>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>(Incluye extras y propinas)</p>
                    </div>
                )}

                <div className="card">
                    <h3 className="label">{userRole === 'admin' ? 'Comisiones + Propinas' : 'Mis Comisiones'}</h3>
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

                            {/* SELECTOR DE EMPLEADO (SOLO ADMIN) - AHORA MULTIPLE */}
                            {userRole === 'admin' && (
                                <div style={{ marginBottom: '1rem' }}>
                                    <label className="label">Realizado por (Selección Múltiple)</label>
                                    <div style={{
                                        maxHeight: '150px',
                                        overflowY: 'auto',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: 'var(--radius-md)',
                                        padding: '0.5rem',
                                        backgroundColor: 'var(--bg-card)'
                                    }}>
                                        <div style={{ marginBottom: '0.5rem' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={formData.selectedEmployees.includes(myEmployeeId)}
                                                    onChange={(e) => {
                                                        const newSelection = e.target.checked
                                                            ? [...formData.selectedEmployees, myEmployeeId]
                                                            : formData.selectedEmployees.filter(id => id !== myEmployeeId);
                                                        setFormData({ ...formData, selectedEmployees: newSelection });
                                                    }}
                                                />
                                                <span>Yo (Admin)</span>
                                            </label>
                                        </div>
                                        {employees.filter(e => e.role !== 'admin').map(emp => (
                                            <div key={emp.id} style={{ marginBottom: '0.5rem' }}>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.selectedEmployees.includes(emp.id)}
                                                        onChange={(e) => {
                                                            const newSelection = e.target.checked
                                                                ? [...formData.selectedEmployees, emp.id]
                                                                : formData.selectedEmployees.filter(id => id !== emp.id);
                                                            setFormData({ ...formData, selectedEmployees: newSelection });
                                                        }}
                                                    />
                                                    <span>{emp.name}</span>
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                    <small style={{ color: 'var(--text-muted)' }}>Selecciona todos los que participaron.</small>
                                </div>
                            )}

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
                                <th style={{ padding: '1rem' }}>Empleado</th>
                                <th style={{ padding: '1rem' }}>Total</th>
                                <th style={{ padding: '1rem' }}>Pago</th>
                            </tr>
                        </thead>
                        <tbody>
                            {statsTransactions.map(t => (
                                <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <td style={{ padding: '1rem' }}>{new Date(t.date).toLocaleTimeString('es-PR', { timeZone: 'America/Puerto_Rico', hour: '2-digit', minute: '2-digit' })}</td>
                                    <td style={{ padding: '1rem' }}>{getCustomerName(t.customer_id)}</td>
                                    <td style={{ padding: '1rem' }}>
                                        {getServiceName(t.service_id)}
                                        {t.extras && t.extras.length > 0 && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>+ {t.extras.length} extras</span>}
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        {t.transaction_assignments && t.transaction_assignments.length > 0
                                            ? t.transaction_assignments.map(a => getEmployeeName(a.employee_id)).join(', ')
                                            : getEmployeeName(t.employee_id) // Fallback
                                        }
                                    </td>
                                    <td style={{ padding: '1rem', fontWeight: 'bold' }}>${t.total_price.toFixed(2)}</td>
                                    <td style={{ padding: '1rem' }}>
                                        <span style={{
                                            padding: '0.25rem 0.75rem',
                                            borderRadius: '9999px',
                                            fontSize: '0.875rem',
                                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                            color: '#10B981'
                                        }}>
                                            {getPaymentMethodLabel(t.payment_method)}
                                        </span>
                                    </td>
                                    {/* BOTÓN DE BORRAR (SOLO ADMIN) */}
                                    {userRole === 'admin' && (
                                        <td style={{ padding: '1rem', textAlign: 'right' }}>
                                            <button
                                                className="btn"
                                                style={{ padding: '0.5rem', color: 'var(--danger)', backgroundColor: 'transparent' }}
                                                onClick={async () => {
                                                    if (window.confirm('¿Estás seguro de que quieres eliminar esta venta? Esta acción no se puede deshacer.')) {
                                                        try {
                                                            await removeTransaction(t.id);
                                                        } catch (err) {
                                                            alert('Error al eliminar: ' + err.message);
                                                        }
                                                    }
                                                }}
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                            {statsTransactions.length === 0 && (
                                <tr>
                                    <td colSpan={userRole === 'admin' ? "7" : "6"} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
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
