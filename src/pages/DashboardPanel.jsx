import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Plus, Car, DollarSign, Users, Trash2, Edit2, ShoppingBag, User } from 'lucide-react';
import useSupabase from '../hooks/useSupabase';
import ProductivityBar from '../components/ProductivityBar';
import ServiceAnalyticsChart from '../components/ServiceAnalyticsChart';
import EditTransactionModal from '../components/EditTransactionModal';

// INLINE MODAL FOR DEBUGGING
// EditTransactionModal removed to prevent unused variable build error

const Dashboard = () => {
    const [myUserId, setMyUserId] = useState(null);
    const [userEmail, setUserEmail] = useState(''); // Nuevo: Email para debug
    const [myEmployeeId, setMyEmployeeId] = useState(null); // Nuevo: ID del perfil de empleado

    const [dateFilter, setDateFilter] = useState('today');
    const [customDate, setCustomDate] = useState(new Date().toISOString().split('T')[0]);

    // REFACTOR: Store ID only, not the whole object
    const [editingTransactionId, setEditingTransactionId] = useState(null); // Nuevo: ID del perfil de empleado
    const [userRole, setUserRole] = useState(null); // Estado para el rol

    const [debugInfo, setDebugInfo] = useState(""); // DEBUG STATE

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setMyUserId(user.id);
                setUserEmail(user.email);

                // DEBUG: Mostrar ID del usuario
                let log = `User ID: ${user.id} \nEmail: ${user.email} \n`;

                // Consultar el rol del empleado
                let { data: employee, error } = await supabase
                    .from('employees')
                    .select('*')
                    .eq('user_id', user.id)
                    .single();

                if (error) {
                    console.error("Error fetching employee:", error);
                    setDebugInfo(error.message + " (Code: " + error.code + ")");
                }

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

    const { data: servicesData } = useSupabase('services');
    const services = servicesData || [];

    const { data: employeesData } = useSupabase('employees');
    const employees = employeesData || [];

    const { data: customersData, refresh: refreshCustomers } = useSupabase('customers');
    const customers = customersData || [];

    const { data: transactionsData, create: createTransaction, update: updateTransaction, remove: removeTransaction, refresh: refreshTransactions } = useSupabase('transactions', `*, customers(name, vehicle_plate), transaction_assignments(employee_id)`, { orderBy: { column: 'created_at', ascending: false } });
    const transactions = transactionsData || [];

    const { data: expensesData } = useSupabase('expenses');
    const expenses = expensesData || [];

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeDetailModal, setActiveDetailModal] = useState(null); // 'cars', 'income', 'commissions'
    const [selectedTransaction, setSelectedTransaction] = useState(null); // For detailed view of a specific transaction
    const [error, setError] = useState(null); // FIX: Define error state

    // Transaction Form State
    const [formData, setFormData] = useState({
        customerId: '',
        serviceId: '',
        employeeId: '',
        selectedEmployees: [], // Inicializar array vacío
        price: '',
        commissionAmount: '',
        serviceTime: new Date().toTimeString().slice(0, 5)
    });

    const [newExtra, setNewExtra] = useState({ description: '', price: '' });

    // Quick Add Customer State
    const [isAddingCustomer, setIsAddingCustomer] = useState(false);
    const [newCustomer, setNewCustomer] = useState({
        name: '',
        phone: '',
        vehicle_plate: '',
        vehicle_model: '',
        email: '' // Optional
    });

    const { create: createCustomer } = useSupabase('customers');

    const handleCreateCustomer = async () => {
        if (!newCustomer.name || !newCustomer.vehicle_plate) {
            alert('Nombre y Placa son obligatorios');
            return;
        }

        try {
            const [created] = await createCustomer(newCustomer);
            if (created) {
                await refreshCustomers(); // Recargar lista
                setFormData({ ...formData, customerId: created.id }); // Seleccionar el nuevo
                setIsAddingCustomer(false); // Cerrar mini-form
                setNewCustomer({ name: '', phone: '', vehicle_plate: '', vehicle_model: '', email: '' }); // Reset
            }
        } catch (error) {
            alert('Error al crear cliente: ' + error.message);
        }
    };

    // Helper para manejar fechas en zona horaria de Puerto Rico
    const getPRDateString = (dateInput) => {
        if (!dateInput) return '';
        const date = new Date(dateInput);
        return date.toLocaleDateString('en-CA', { timeZone: 'America/Puerto_Rico' });
    };

    // DATE FILTER LOGIC
    const effectiveDate = dateFilter === 'today' ? getPRDateString(new Date()) : customDate;

    // Filter transactions by the effective date
    const filteredTransactions = transactions.filter(t => getPRDateString(t.date) === effectiveDate);
    const filteredExpenses = expenses.filter(e => getPRDateString(e.date) === effectiveDate && e.category === 'lunch');

    // Para empleados: Filtrar SOLO sus transacciones para los contadores
    const myTransactions = filteredTransactions.filter(t => {
        // 1. Verificar si está en la lista de asignaciones (Multi-empleado)
        const isAssigned = t.transaction_assignments?.some(a => a.employee_id === myEmployeeId);
        // 2. Verificar si es el empleado principal (Legacy/Fallback)
        const isPrimary = t.employee_id === myEmployeeId;

        return isAssigned || isPrimary;
    });

    // Si es Admin, usa TODO. Si es Empleado, usa SOLO LO SUYO.
    const statsTransactions = userRole === 'admin' ? filteredTransactions : myTransactions;

    const totalIncome = filteredTransactions.reduce((sum, t) => sum + (parseFloat(t.total_price) || 0), 0);

    // Calcular comisiones basado en el rol (Admin ve total, Empleado ve suyo)
    const totalCommissions = statsTransactions.reduce((sum, t) => {
        // Calcular el monto total de comisión + propina de la transacción
        const txTotalCommission = (parseFloat(t.commission_amount) || 0) + (parseFloat(t.tip) || 0);

        // Determinar cuántos empleados participaron
        // Si hay assignments, usar su longitud. Si no, asumir 1 (el employee_id principal).
        const employeeCount = (t.transaction_assignments && t.transaction_assignments.length > 0)
            ? t.transaction_assignments.length
            : 1;

        // Dividir equitativamente
        const splitCommission = txTotalCommission / employeeCount;

        return sum + splitCommission;
    }, 0);

    // Calcular Almuerzos (Deducciones)
    const totalLunches = filteredExpenses.reduce((sum, e) => {
        // Si es Admin, suma todos los almuerzos. Si es Empleado, solo los suyos.
        if (userRole === 'admin' || e.employee_id === myEmployeeId) {
            return sum + (parseFloat(e.amount) || 0);
        }
        return sum;
    }, 0);

    const netCommissions = totalCommissions - totalLunches;

    // GAMIFICATION CALCULATIONS
    // 1. Daily Count: Already filtered in 'myTransactions' (todaysTransactions for Admin, myTransactions for Employee)
    // For the bar, we want to show the specific employee's progress. If Admin, maybe show global? Let's show personal for now.
    const dailyProductivityCount = myTransactions.length;

    // 2. Total XP (Lifetime Cars)
    const [totalXp, setTotalXp] = useState(0);
    const [dailyTarget, setDailyTarget] = useState(10); // Default 10

    useEffect(() => {
        const fetchXpAndSettings = async () => {
            // Fetch Settings
            const { data: settingsData } = await supabase
                .from('settings')
                .select('value')
                .eq('key', 'daily_target')
                .single();

            if (settingsData) {
                setDailyTarget(parseInt(settingsData.value, 10) || 10);
            }

            if (myEmployeeId) {
                // Count assignments (Source of Truth for XP)
                const { count, error } = await supabase
                    .from('transaction_assignments')
                    .select('*', { count: 'exact', head: true })
                    .eq('employee_id', myEmployeeId);

                if (!error) {
                    setTotalXp(count || 0);
                }
            }
        };
        fetchXpAndSettings();
    }, [myEmployeeId, transactions]); // Re-fetch when transactions change

    const handleEditTarget = async (newTarget) => {
        if (userRole !== 'admin') return;

        const { error } = await supabase
            .from('settings')
            .upsert({ key: 'daily_target', value: newTarget.toString() });

        if (error) {
            alert('Error al actualizar la meta: ' + error.message);
        } else {
            setDailyTarget(newTarget);
        }
    };

    const handleServiceChange = (e) => {
        const serviceId = e.target.value;
        const service = services.find(s => s.id === serviceId);
        if (service) {
            setFormData({
                ...formData,
                serviceId,
                price: service.price,
                commissionAmount: service.commission || 0 // Use fixed commission
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

    const handleUpdateTransaction = async (id, updates) => {
        try {
            await updateTransaction(id, updates);
            setEditingTransactionId(null);
            await refreshTransactions();
        } catch (error) {
            console.error("Update failed:", error);
            alert("Error al actualizar: " + error.message);
        }
    };

    const handleDeleteTransactionV2 = async (id) => {
        try {
            // 1. Delete assignments first (manual cascade)
            const { error: assignError } = await supabase
                .from('transaction_assignments')
                .delete()
                .eq('transaction_id', id);

            if (assignError) throw assignError;

            // 2. Delete the transaction
            await removeTransaction(id);
            await refreshTransactions();
            alert("Venta eliminada correctamente.");
        } catch (error) {
            console.error("Error deleting:", error);
            alert("Error al eliminar: " + error.message);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        alert("DEBUG: Iniciando registro..."); // DEBUG EXPLICITO

        const basePrice = parseFloat(formData.price) || 0;
        // En flujo pendiente, extras y propina son 0 inicialmente
        const extrasTotal = 0;
        const tip = 0;
        const totalPrice = basePrice;

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
            // Lógica condicional para servicio de $35:
            // Si es $35 y hay más de 1 empleado, la comisión total es $12.
            // Si es $35 y es 1 empleado, la comisión es la normal ($10).
            commission_amount: ((basePrice === 35 && assignedEmployees.length > 1)
                ? 12
                : parseFloat(formData.commissionAmount)) || 0,
            tip: 0, // Inicialmente 0
            payment_method: 'cash', // Placeholder válido (evitar error de constraint)
            extras: [], // Inicialmente sin extras
            total_price: basePrice, // Solo el precio base
            status: 'pending' // NUEVO ESTADO
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

                // REFRESH CRÍTICO: Recargar para traer las asignaciones recién creadas
                await refreshTransactions();
            }

            setIsModalOpen(false);
            setFormData({
                customerId: '',
                serviceId: '',
                employeeId: '',
                selectedEmployees: [],
                price: '',
                commissionAmount: '',
                serviceTime: new Date().toTimeString().slice(0, 5)
            });
            await refreshTransactions();
            alert("¡Servicio registrado correctamente!");

        } catch (error) {
            console.error("Error creating transaction:", error);
            alert("ERROR AL REGISTRAR: " + (error.message || JSON.stringify(error)));
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

    console.log("VERSION 3.7 NUCLEAR LOADED");
    return (
        <div>
            <div className="dashboard-header" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <h1 style={{ fontSize: '1.875rem', margin: 0 }}>Dashboard</h1>
                        <span style={{ fontSize: '0.8rem', color: 'white', backgroundColor: '#EC4899', border: '1px solid white', padding: '0.2rem 0.5rem', borderRadius: '4px', boxShadow: '0 0 10px #EC4899' }}>
                            v4.14 SORT FIX {new Date().toLocaleTimeString()}
                        </span>
                    </div>
                    <p style={{ color: 'var(--text-muted)' }}>Resumen: {effectiveDate}</p>

                    {/* DATE FILTER CONTROLS */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '1rem', alignItems: 'center' }}>
                        <button
                            className="btn"
                            style={{
                                backgroundColor: dateFilter === 'today' ? 'var(--primary)' : 'var(--bg-secondary)',
                                color: 'white',
                                flex: '1 1 auto',
                                justifyContent: 'center'
                            }}
                            onClick={() => setDateFilter('today')}
                        >
                            Hoy
                        </button>
                        <button
                            className="btn"
                            style={{
                                backgroundColor: dateFilter === 'custom' ? 'var(--primary)' : 'var(--bg-secondary)',
                                color: 'white',
                                flex: '1 1 auto',
                                justifyContent: 'center'
                            }}
                            onClick={() => setDateFilter('custom')}
                        >
                            Historial
                        </button>

                        {dateFilter === 'custom' && (
                            <input
                                type="date"
                                className="input"
                                style={{ padding: '0.4rem', width: '100%', maxWidth: '200px' }}
                                value={customDate}
                                onChange={(e) => setCustomDate(e.target.value)}
                            />
                        )}
                    </div>

                    <div style={{ fontSize: '0.8rem', color: 'yellow', backgroundColor: 'rgba(0,0,0,0.5)', padding: '5px', marginTop: '5px' }}>
                        DEBUG: Role={userRole || 'null'} | Tx={transactions.length} | Svc={services.length} | Emp={employees.length}
                    </div>
                </div>

                {/* MOSTRAR BOTÓN PARA TODOS (Admin y Empleados) */}
                <button className="btn btn-primary mobile-fab" onClick={() => setIsModalOpen(true)}>
                    <Plus size={20} />
                    <span className="desktop-text">Registrar Servicio</span>
                </button>
            </div>

            {/* GAMIFICATION BAR */}
            <ProductivityBar
                dailyCount={dailyProductivityCount}
                dailyTarget={dailyTarget}
                totalXp={totalXp}
                isEditable={userRole === 'admin'}
                onEditTarget={handleEditTarget}
            />

            <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                <div
                    className="card"
                    onClick={() => userRole === 'admin' && setActiveDetailModal('cars')}
                    style={{ cursor: userRole === 'admin' ? 'pointer' : 'default', transition: 'transform 0.2s' }}
                    onMouseEnter={(e) => userRole === 'admin' && (e.currentTarget.style.transform = 'scale(1.02)')}
                    onMouseLeave={(e) => userRole === 'admin' && (e.currentTarget.style.transform = 'scale(1)')}
                >
                    <h3 className="label">{userRole === 'admin' ? 'Autos Lavados Hoy (Ver Detalles)' : 'Mis Autos Lavados'}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <Car size={32} className="text-primary" />
                        <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary)' }}>{statsTransactions.length}</p>
                    </div>
                </div>

                {/* SOLO ADMIN VE INGRESOS TOTALES */}
                {userRole === 'admin' && (
                    <div
                        className="card"
                        onClick={() => setActiveDetailModal('income')}
                        style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        <h3 className="label">Ingresos Totales Hoy (Ver Detalles)</h3>
                        <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--success)' }}>${totalIncome.toFixed(2)}</p>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>(Incluye extras y propinas)</p>
                    </div>
                )}

                <div
                    className="card"
                    onClick={() => setActiveDetailModal('commissions')}
                    style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                    <h3 className="label">{userRole === 'admin' ? 'Comisiones Netas (Ver Desglose)' : 'Mi Neto (Menos Almuerzos)'}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--warning)' }}>${netCommissions.toFixed(2)}</p>
                        {totalLunches > 0 && (
                            <span style={{ fontSize: '0.9rem', color: 'var(--danger)', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '0.25rem 0.5rem', borderRadius: '0.5rem' }}>
                                -${totalLunches.toFixed(2)} en almuerzos
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* DETAIL MODAL */}
            {activeDetailModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000
                }} onClick={() => setActiveDetailModal(null)}>
                    <div style={{
                        backgroundColor: 'var(--bg-card)',
                        padding: '2rem',
                        borderRadius: '0.5rem',
                        width: '90%',
                        maxWidth: '500px',
                        maxHeight: '80vh',
                        overflowY: 'auto'
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 style={{ margin: 0 }}>
                                {activeDetailModal === 'cars' && '🚗 Detalle de Autos'}
                                {activeDetailModal === 'income' && '💰 Desglose de Ingresos'}
                                {activeDetailModal === 'commissions' && '👥 Desglose de Comisiones'}
                            </h2>
                            <button onClick={() => setActiveDetailModal(null)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: '1.5rem' }}>&times;</button>
                        </div>

                        {/* CONTENT BASED ON TYPE */}
                        {activeDetailModal === 'cars' && (
                            <div>
                                {statsTransactions.length === 0 ? <p>No hay autos hoy.</p> : (
                                    <ul style={{ listStyle: 'none', padding: 0 }}>
                                        {statsTransactions.map(t => (
                                            <li key={t.id} style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
                                                <span>{t.customers?.vehicle_plate || 'Sin Placa'} ({t.customers?.name})</span>
                                                <span style={{ color: 'var(--primary)' }}>{getServiceName(t.service_id)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}

                        {activeDetailModal === 'income' && (
                            <div>
                                <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '0.5rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                        <span>Efectivo:</span>
                                        <span style={{ fontWeight: 'bold' }}>${statsTransactions.filter(t => t.payment_method === 'cash').reduce((sum, t) => sum + (parseFloat(t.total_price) || 0), 0).toFixed(2)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                        <span>Tarjeta:</span>
                                        <span style={{ fontWeight: 'bold' }}>${statsTransactions.filter(t => t.payment_method === 'card').reduce((sum, t) => sum + (parseFloat(t.total_price) || 0), 0).toFixed(2)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>Ath Móvil:</span>
                                        <span style={{ fontWeight: 'bold' }}>${statsTransactions.filter(t => t.payment_method === 'transfer').reduce((sum, t) => sum + (parseFloat(t.total_price) || 0), 0).toFixed(2)}</span>
                                    </div>
                                    <hr style={{ borderColor: 'var(--border-color)', margin: '1rem 0' }} />
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', color: 'var(--success)' }}>
                                        <span>Total:</span>
                                        <span>${totalIncome.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeDetailModal === 'commissions' && (
                            <div>
                                {userRole === 'admin' ? (
                                    // VISTA DE ADMIN: LISTA DE EMPLEADOS
                                    <ul style={{ listStyle: 'none', padding: 0 }}>
                                        {employees.map(emp => {
                                            // Calculate commission for this employee
                                            const empCommission = statsTransactions.reduce((sum, t) => {
                                                const isAssigned = t.transaction_assignments?.some(a => a.employee_id === emp.id);
                                                const isPrimary = t.employee_id === emp.id;

                                                if (isAssigned || isPrimary) {
                                                    const txTotalCommission = (parseFloat(t.commission_amount) || 0) + (parseFloat(t.tip) || 0);
                                                    const count = (t.transaction_assignments?.length) || 1;
                                                    return sum + (txTotalCommission / count);
                                                }
                                                return sum;
                                            }, 0);

                                            // Calculate lunches
                                            const empLunches = filteredExpenses
                                                .filter(e => e.employee_id === emp.id)
                                                .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

                                            const empNet = empCommission - empLunches;

                                            if (empCommission === 0 && empLunches === 0) return null;

                                            return (
                                                <li key={emp.id} style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginBottom: '0.25rem' }}>
                                                        <span>{emp.name}</span>
                                                        <span style={{ color: empNet >= 0 ? 'var(--success)' : 'var(--danger)' }}>${empNet.toFixed(2)}</span>
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                                        <span>Comisión: ${empCommission.toFixed(2)}</span>
                                                        <span>Almuerzos: -${empLunches.toFixed(2)}</span>
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                ) : (
                                    // VISTA DE EMPLEADO: LISTA DE SUS TRANSACCIONES
                                    <div>
                                        <h4 style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>Mis Trabajos de Hoy</h4>
                                        <ul style={{ listStyle: 'none', padding: 0 }}>
                                            {statsTransactions.map(t => {
                                                // Calcular mi parte de esta transacción
                                                const txTotalCommission = (parseFloat(t.commission_amount) || 0) + (parseFloat(t.tip) || 0);
                                                const count = (t.transaction_assignments?.length) || 1;
                                                const myShare = txTotalCommission / count;

                                                return (
                                                    <li key={t.id} style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <div>
                                                            <div style={{ fontWeight: 'bold' }}>{t.customers?.name || 'Cliente Casual'}</div>
                                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{getServiceName(t.service_id)}</div>
                                                        </div>
                                                        <div style={{ textAlign: 'right' }}>
                                                            <div style={{ color: 'var(--success)', fontWeight: 'bold' }}>+${myShare.toFixed(2)}</div>
                                                            {count > 1 && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>(Compartido entre {count})</div>}
                                                        </div>
                                                    </li>
                                                );
                                            })}
                                        </ul>

                                        {totalLunches > 0 && (
                                            <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: '0.5rem' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--danger)', fontWeight: 'bold' }}>
                                                    <span>Descuento Almuerzos</span>
                                                    <span>-${totalLunches.toFixed(2)}</span>
                                                </div>
                                            </div>
                                        )}

                                        <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '2px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem', fontWeight: 'bold' }}>
                                            <span>Total Neto</span>
                                            <span style={{ color: 'var(--warning)' }}>${netCommissions.toFixed(2)}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {isModalOpen && (
                <div className="modal-overlay" style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000,
                    overflowY: 'auto'
                }}>
                    <div className="card modal-card" style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
                        <h3 style={{ marginBottom: '1.5rem' }}>Registrar Nuevo Servicio</h3>
                        <form onSubmit={handleSubmit}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div style={{ marginBottom: '1rem' }}>
                                    <label className="label">Cliente</label>
                                    {!isAddingCustomer ? (
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <select
                                                className="input"
                                                required
                                                value={formData.customerId}
                                                onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                                                style={{ flex: 1 }}
                                            >
                                                <option value="">Seleccionar Cliente...</option>
                                                {customers.map(c => (
                                                    <option key={c.id} value={c.id}>{c.name} - {c.vehicle_plate}</option>
                                                ))}
                                            </select>
                                            <button
                                                type="button"
                                                className="btn btn-primary"
                                                onClick={() => setIsAddingCustomer(true)}
                                                title="Nuevo Cliente"
                                                style={{
                                                    flexShrink: 0,
                                                    width: '48px',
                                                    padding: 0,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}
                                            >
                                                <Plus size={20} />
                                            </button>
                                        </div>
                                    ) : (
                                        <div style={{ padding: '1rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
                                            <h4 style={{ marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Nuevo Cliente Rápido</h4>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                                <input
                                                    type="text"
                                                    className="input"
                                                    placeholder="Nombre"
                                                    value={newCustomer.name}
                                                    onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                                                />
                                                <input
                                                    type="text"
                                                    className="input"
                                                    placeholder="Teléfono"
                                                    value={newCustomer.phone}
                                                    onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                                                />
                                                <input
                                                    type="text"
                                                    className="input"
                                                    placeholder="Placa"
                                                    value={newCustomer.vehicle_plate}
                                                    onChange={(e) => setNewCustomer({ ...newCustomer, vehicle_plate: e.target.value })}
                                                />
                                                <input
                                                    type="text"
                                                    className="input"
                                                    placeholder="Modelo (Opcional)"
                                                    value={newCustomer.vehicle_model}
                                                    onChange={(e) => setNewCustomer({ ...newCustomer, vehicle_model: e.target.value })}
                                                />
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                                <button
                                                    type="button"
                                                    className="btn"
                                                    onClick={() => setIsAddingCustomer(false)}
                                                    style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}
                                                >
                                                    Cancelar
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-primary"
                                                    onClick={handleCreateCustomer}
                                                    disabled={!newCustomer.name || !newCustomer.vehicle_plate}
                                                    style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}
                                                >
                                                    Guardar Cliente
                                                </button>
                                            </div>
                                        </div>
                                    )}
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



                            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                                <button type="button" className="btn" onClick={() => setIsModalOpen(false)} style={{ backgroundColor: 'var(--bg-secondary)', color: 'white' }}>
                                    Cancelar
                                </button>
                                <button type="button" className="btn btn-primary" onClick={handleSubmit}>
                                    Registrar Venta
                                </button>
                            </div>
                        </form>
                    </div>
                </div >
            )}

            {/* EDIT TRANSACTION MODAL */}
            {/* v3.11 FORM RESTORE */}
            {
                editingTransactionId && (
                    <EditTransactionModal
                        key={editingTransactionId}
                        isOpen={!!editingTransactionId}
                        onClose={() => setEditingTransactionId(null)}
                        transaction={transactions.find(t => t.id === editingTransactionId)}
                        services={services}
                        onUpdate={handleUpdateTransaction}
                    />
                )
            }

            {/* ERROR ALERT */}
            {error && (
                <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem', border: '1px solid #EF4444' }}>
                    <strong>Error:</strong> {error}
                    <button onClick={() => setError(null)} style={{ float: 'right', background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer' }}>✕</button>
                </div>
            )}

            {/* SECCIÓN DE SERVICIOS ACTIVOS (PENDIENTES) */}
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#F59E0B' }}>⏳ Servicios en Proceso</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
                {statsTransactions.filter(t => t.status === 'pending').length === 0 ? (
                    <div style={{ gridColumn: '1 / -1', padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', backgroundColor: 'var(--bg-card)', borderRadius: '0.5rem' }}>
                        No hay servicios activos en este momento.
                    </div>
                ) : (
                    statsTransactions.filter(t => t.status === 'pending').map(t => (
                        <div key={t.id} className="card" style={{ position: 'relative', borderLeft: '4px solid #F59E0B' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                <div>
                                    <h3 style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{t.customers?.name || 'Cliente Casual'}</h3>
                                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{t.customers?.vehicle_plate || 'Sin Placa'}</span>
                                </div>
                                <span style={{
                                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                                    color: '#F59E0B',
                                    padding: '0.25rem 0.5rem',
                                    borderRadius: '4px',
                                    fontSize: '0.8rem',
                                    fontWeight: 'bold'
                                }}>
                                    {new Date(t.date).toLocaleTimeString('es-PR', { timeZone: 'America/Puerto_Rico', hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>

                            <div style={{ marginBottom: '1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                    <ShoppingBag size={16} className="text-primary" />
                                    <span style={{ fontWeight: 'bold' }}>{getServiceName(t.service_id)}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                    <User size={16} />
                                    <span>
                                        {t.transaction_assignments && t.transaction_assignments.length > 0
                                            ? t.transaction_assignments.map(a => {
                                                const emp = employees.find(e => e.id === a.employee_id);
                                                return emp ? emp.name : 'Unknown';
                                            }).join(', ')
                                            : (employees.find(e => e.id === t.employee_id)?.name || 'Unknown')}
                                    </span>
                                </div>
                            </div>

                            <button
                                onClick={() => setEditingTransactionId(t.id)}
                                className="btn btn-primary"
                                style={{ width: '100%', justifyContent: 'center' }}
                            >
                                Completar y Cobrar
                            </button>
                        </div>
                    ))
                )}
            </div>

            {/* SECCIÓN DE HISTORIAL (PAGADOS) */}
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>✅ Historial de Ventas</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                {statsTransactions.filter(t => t.status !== 'pending').map(t => (
                    <div
                        key={t.id}
                        className="card"
                        style={{
                            borderLeft: t.payment_method === 'cash' ? '4px solid #10B981' : t.payment_method === 'card' ? '4px solid #3B82F6' : '4px solid #F59E0B',
                            cursor: 'pointer',
                            transition: 'transform 0.2s'
                        }}
                        onClick={() => setSelectedTransaction(t)}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                            <div>
                                <h3 style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{t.customers?.name || 'Cliente Casual'}</h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                    <span>{new Date(t.date).toLocaleTimeString('es-PR', { timeZone: 'America/Puerto_Rico', hour: '2-digit', minute: '2-digit' })}</span>
                                    <span>•</span>
                                    <span style={{
                                        padding: '0.1rem 0.5rem',
                                        borderRadius: '9999px',
                                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                        color: '#10B981'
                                    }}>
                                        {getPaymentMethodLabel(t.payment_method)}
                                    </span>
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
                                    ${parseFloat(t.price || 0).toFixed(2)}
                                </div>
                                {t.tip > 0 && (
                                    <div style={{ fontSize: '0.8rem', color: 'var(--warning)' }}>
                                        + ${parseFloat(t.tip).toFixed(2)} propina
                                    </div>
                                )}
                            </div>
                        </div>

                        <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '0.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Servicio:</span>
                                <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{getServiceName(t.service_id)}</span>
                            </div>
                            {t.extras && t.extras.length > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Extras:</span>
                                    <span style={{ fontSize: '0.9rem' }}>{t.extras.length} items</span>
                                </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Realizado por:</span>
                                <span style={{ fontSize: '0.9rem', textAlign: 'right' }}>
                                    {t.transaction_assignments && t.transaction_assignments.length > 0
                                        ? t.transaction_assignments.map(a => getEmployeeName(a.employee_id)).join(', ')
                                        : getEmployeeName(t.employee_id)
                                    }
                                </span>
                            </div>
                        </div>

                        {userRole === 'admin' && (
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }} onClick={(e) => e.stopPropagation()}>
                                <button
                                    className="btn"
                                    style={{ padding: '0.5rem', color: 'var(--primary)', backgroundColor: 'transparent' }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingTransactionId(t.id);
                                    }}
                                    title="Editar"
                                >
                                    <span style={{ marginRight: '0.5rem' }}>Editar</span> ✏️
                                </button>
                                <button
                                    className="btn"
                                    style={{ padding: '0.5rem', color: 'var(--error)', backgroundColor: 'transparent' }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (window.confirm('¿Seguro que quieres eliminar esta venta?')) {
                                            handleDeleteTransactionV2(t.id);
                                        }
                                    }}
                                    title="Eliminar"
                                >
                                    <span style={{ marginRight: '0.5rem' }}>Eliminar</span> <Trash2 size={18} />
                                </button>
                            </div>
                        )}
                    </div>
                ))}
                {statsTransactions.length === 0 && (
                    <div style={{ gridColumn: '1 / -1', padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', backgroundColor: 'var(--bg-card)', borderRadius: '0.5rem' }}>
                        No hay ventas registradas hoy
                    </div>
                )}
            </div>

            {/* TRANSACTION DETAIL MODAL */}
            {selectedTransaction && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000
                }} onClick={() => setSelectedTransaction(null)}>
                    <div style={{
                        backgroundColor: 'var(--bg-card)',
                        padding: '2rem',
                        borderRadius: '0.5rem',
                        width: '90%',
                        maxWidth: '500px',
                        maxHeight: '80vh',
                        overflowY: 'auto'
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 style={{ margin: 0 }}>🧾 Detalle de Venta</h2>
                            <button onClick={() => setSelectedTransaction(null)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: '1.5rem' }}>&times;</button>
                        </div>

                        <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
                            <h3 style={{ fontSize: '1.5rem', color: 'var(--primary)', margin: 0 }}>{selectedTransaction.customers?.name || 'Cliente Casual'}</h3>
                            <p style={{ color: 'var(--text-muted)', margin: '0.5rem 0' }}>{selectedTransaction.customers?.vehicle_plate || 'Sin Placa'}</p>
                            <span style={{
                                backgroundColor: 'var(--bg-secondary)',
                                padding: '0.25rem 0.75rem',
                                borderRadius: '9999px',
                                fontSize: '0.9rem'
                            }}>
                                {new Date(selectedTransaction.date).toLocaleTimeString('es-PR', { timeZone: 'America/Puerto_Rico', hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>

                        <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '1.1rem', fontWeight: 'bold' }}>
                                <span>{getServiceName(selectedTransaction.service_id)}</span>
                                <span>${(parseFloat(selectedTransaction.price) - (selectedTransaction.extras?.reduce((sum, e) => sum + e.price, 0) || 0)).toFixed(2)}</span>
                            </div>

                            {/* EXTRAS LIST */}
                            {selectedTransaction.extras && selectedTransaction.extras.length > 0 && (
                                <div style={{ marginTop: '0.5rem', paddingLeft: '1rem', borderLeft: '2px solid var(--border-color)' }}>
                                    <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Extras:</p>
                                    {selectedTransaction.extras.map((extra, idx) => (
                                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                                            <span>+ {extra.description}</span>
                                            <span>${extra.price.toFixed(2)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <hr style={{ borderColor: 'var(--border-color)', margin: '1rem 0' }} />

                            {selectedTransaction.tip > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--warning)', marginBottom: '0.5rem' }}>
                                    <span>Propina</span>
                                    <span>+ ${parseFloat(selectedTransaction.tip).toFixed(2)}</span>
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--success)' }}>
                                <span>Total Pagado</span>
                                <span>${(parseFloat(selectedTransaction.price) + (parseFloat(selectedTransaction.tip) || 0)).toFixed(2)}</span>
                            </div>
                            <div style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                Método: {getPaymentMethodLabel(selectedTransaction.payment_method)}
                            </div>
                        </div>

                        <div style={{ marginBottom: '1rem' }}>
                            <h4 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Realizado por:</h4>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                {selectedTransaction.transaction_assignments && selectedTransaction.transaction_assignments.length > 0
                                    ? selectedTransaction.transaction_assignments.map(a => (
                                        <span key={a.employee_id} style={{ backgroundColor: 'var(--bg-secondary)', padding: '0.25rem 0.75rem', borderRadius: '0.25rem', fontSize: '0.9rem' }}>
                                            {getEmployeeName(a.employee_id)}
                                        </span>
                                    ))
                                    : <span style={{ backgroundColor: 'var(--bg-secondary)', padding: '0.25rem 0.75rem', borderRadius: '0.25rem', fontSize: '0.9rem' }}>{getEmployeeName(selectedTransaction.employee_id)}</span>
                                }
                            </div>
                        </div>

                        <button onClick={() => setSelectedTransaction(null)} className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
                            Cerrar
                        </button>
                    </div>
                </div>
            )}


            {/* CHART SECTION (ADMIN ONLY) */}
            {
                userRole === 'admin' && (
                    <ServiceAnalyticsChart transactions={transactions} />
                )
            }



            {/* DEBUG PANEL */}
            <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#1e293b', borderRadius: '0.5rem', fontSize: '0.8rem', color: '#94a3b8' }}>
                <h4 style={{ marginBottom: '0.5rem', color: 'white' }}>🛠️ Panel de Diagnóstico (Solo visible durante pruebas)</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                        <p><strong>Email (Auth):</strong> {userEmail || 'Cargando...'}</p>
                        <p><strong>Mi ID (Auth):</strong> {myUserId || 'No detectado'}</p>
                        <p><strong>Mi ID (Empleado):</strong> {myEmployeeId || '⚠️ NO VINCULADO'}</p>
                        <p><strong>Rol:</strong> {userRole || 'Sin rol'}</p>
                        <p style={{ color: 'red' }}><strong>Error:</strong> {debugInfo || 'Ninguno'}</p>
                    </div>
                    <div>
                        {/* <p><strong>Sucursal:</strong> {branchId || 'Cargando...'}</p> REMOVED CAUSE CRASH */}
                        <p><strong>Transacciones Hoy:</strong> {statsTransactions.length}</p>
                        <p><strong>Total Ventas:</strong> ${totalIncome.toFixed(2)}</p>
                        <p><strong>Total Comisiones:</strong> ${totalCommissions.toFixed(2)}</p>
                    </div>
                </div>
                <p style={{ marginTop: '0.5rem', fontStyle: 'italic' }}>
                    <em>Si "Mi ID (Empleado)" dice "NO VINCULADO", contacta al administrador para que vincule tu email.</em>
                </p>
            </div>
        </div >
    );
};

export default Dashboard;
