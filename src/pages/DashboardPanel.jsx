import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Plus, Car, DollarSign, Users, Trash2, Edit2, Clock, RefreshCw, Loader2, CheckCircle, Play, Send, Droplets } from 'lucide-react';
import useSupabase from '../hooks/useSupabase';
import ProductivityBar from '../components/ProductivityBar';
import ServiceAnalyticsChart from '../components/ServiceAnalyticsChart';
import EmployeeProductivityChart from '../components/EmployeeProductivityChart';
import EditTransactionModal from '../components/EditTransactionModal';



const Dashboard = () => {
    const [myUserId, setMyUserId] = useState(null);
    const [myEmployeeId, setMyEmployeeId] = useState(null); // Nuevo: ID del perfil de empleado

    const [dateFilter, setDateFilter] = useState('today');
    const [customDate, setCustomDate] = useState(new Date().toISOString().split('T')[0]);

    // REFACTOR: Store ID only, not the whole object
    const [editingTransactionId, setEditingTransactionId] = useState(null); // Nuevo: ID del perfil de empleado
    const [userRole, setUserRole] = useState(null); // Estado para el rol
    const [isRefreshing, setIsRefreshing] = useState(false); // Estado para el botón de refresh

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setMyUserId(user.id);

                // Consultar el rol del empleado
                let { data: employee, error } = await supabase
                    .from('employees')
                    .select('*')
                    .eq('user_id', user.id)
                    .single();

                if (error) {
                    console.error("Error fetching employee:", error);
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

    const { data: transactionsData, create: createTransaction, update: updateTransaction, remove: removeTransaction, refresh: refreshTransactions } = useSupabase('transactions', `*, customers(name, vehicle_plate, vehicle_model, phone), transaction_assignments(employee_id)`, { orderBy: { column: 'date', ascending: false } });
    const transactions = transactionsData || [];

    // Auto-refresh transactions every 2 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            refreshTransactions();
        }, 2000);
        return () => clearInterval(interval);
    }, [refreshTransactions]);

    const { data: expensesData } = useSupabase('expenses');
    const expenses = expensesData || [];

    const handleNotifyReady = async (transaction) => {
        if (!transaction.customers?.phone) {
            alert('Este cliente no tiene número de teléfono registrado.');
            return;
        }

        const phone = transaction.customers.phone.replace(/\D/g, '');
        if (!phone) {
            alert('Número de teléfono inválido.');
            return;
        }

        // Update status to 'ready'
        try {
            await updateTransaction(transaction.id, {
                status: 'ready',
                finished_at: new Date().toISOString()
            });
            await refreshTransactions();
        } catch (error) {
            console.error('Error updating status:', error);
            alert('Error al actualizar estado.');
            return;
        }

        const customerName = transaction.customers.name.split(' ')[0]; // First name
        const vehicle = `${transaction.customers.vehicle_plate} (${transaction.customers.vehicle_model || ''})`;

        const message = `Hola ${customerName}, su vehículo ${vehicle} ya está listo para recoger en Express CarWash. 🚗✨\n¡Lo esperamos!`;
        const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

        // Use location.href to avoid popup blockers
        window.location.href = url;
    };

    const [isModalOpen, setIsModalOpen] = useState(false);

    // HELPER FUNCTIONS (Moved to top to avoid ReferenceError)
    const getCustomerName = (id) => customers.find(c => c.id === id)?.name || 'Cliente Casual';
    const getServiceName = (id) => services.find(s => s.id === id)?.name || 'Servicio Desconocido';
    const getEmployeeName = (id) => employees.find(e => e.id === id)?.name || 'Desconocido';
    const [activeDetailModal, setActiveDetailModal] = useState(null); // 'cars', 'income', 'commissions'
    const [selectedTransaction, setSelectedTransaction] = useState(null); // For detailed view of a specific transaction
    const [debugInfo, setDebugInfo] = useState(""); // DEBUG STATE
    const [error, setError] = useState(null); // FIX: Restore error state
    const [isSubmitting, setIsSubmitting] = useState(false); // Prevent double clicks

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
    const [customerSearch, setCustomerSearch] = useState(''); // Estado para el buscador de clientes
    const [showCustomerSearch, setShowCustomerSearch] = useState(false); // Toggle para mostrar el input

    // Quick Add Customer State
    const [isAddingCustomer, setIsAddingCustomer] = useState(false);
    const [newCustomer, setNewCustomer] = useState({
        name: '',
        phone: '',
        vehicle_plate: '',
        vehicle_model: '',
        email: '' // Optional
    });

    // ASSIGNMENT MODAL STATE (Missing in previous deploy)
    const [assigningTransactionId, setAssigningTransactionId] = useState(null);
    const [selectedEmployeesForAssignment, setSelectedEmployeesForAssignment] = useState([]);

    const handleStartService = (txId) => {
        setAssigningTransactionId(txId);
        setSelectedEmployeesForAssignment([]); // Reset selection
    };

    const handleConfirmAssignment = async () => {
        if (selectedEmployeesForAssignment.length === 0) {
            alert("Selecciona al menos un empleado.");
            return;
        }

        const tx = transactions.find(t => t.id === assigningTransactionId);
        if (!tx) return;

        try {
            // 1. Create Assignments
            const assignments = selectedEmployeesForAssignment.map(empId => ({
                transaction_id: tx.id,
                employee_id: empId
            }));

            const { error: assignError } = await supabase
                .from('transaction_assignments')
                .insert(assignments);

            if (assignError) throw assignError;

            // 2. Calculate Commission
            // Logic: If $35 service & >1 employee => $12 total commission. Else standard.
            // We need to know the service commission.
            const service = services.find(s => s.id === tx.service_id);
            const baseCommission = service?.commission || 0;

            let finalCommission = baseCommission;
            if (tx.price === 35 && selectedEmployeesForAssignment.length > 1) {
                finalCommission = 12;
            }

            // 3. Update Transaction Status & Commission
            await updateTransaction(tx.id, {
                status: 'in_progress',
                commission_amount: finalCommission,
                employee_id: selectedEmployeesForAssignment[0] // Legacy primary
            });

            setAssigningTransactionId(null);
            await refreshTransactions();
            alert("¡Servicio comenzado!");

        } catch (error) {
            console.error("Error starting service:", error);
            alert("Error al comenzar: " + error.message);
        }
    };

    const handlePayment = (tx) => {
        // Open the Edit Modal to allow adding tips, extras, and selecting payment method
        setEditingTransactionId(tx.id);
    };

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
        try {
            const date = new Date(dateInput);
            // Ensure we are getting YYYY-MM-DD
            return date.toLocaleDateString('en-CA', { timeZone: 'America/Puerto_Rico' });
        } catch (e) {
            console.error("Date parse error:", e);
            return '';
        }
    };

    // DATE FILTER LOGIC
    const effectiveDate = dateFilter === 'today' ? getPRDateString(new Date()) : customDate;

    // Filter transactions by the effective date OR if they are active (waiting/in_progress)
    const filteredTransactions = transactions.filter(t => {
        const isToday = getPRDateString(t.date) === effectiveDate;
        const isActive = t.status === 'waiting' || t.status === 'in_progress' || t.status === 'ready';
        return isToday || isActive;
    });
    const filteredExpenses = expenses.filter(e => getPRDateString(e.date) === effectiveDate && e.category === 'lunch');

    // Para empleados: Filtrar SOLO sus transacciones para los contadores
    const myTransactions = filteredTransactions.filter(t => {
        // 1. Verificar si está en la lista de asignaciones (Multi-empleado)
        const isAssigned = t.transaction_assignments?.some(a => a.employee_id === myEmployeeId);
        // 2. Verificar si es el empleado principal (Legacy/Fallback)
        const isPrimary = t.employee_id === myEmployeeId;
        // 3. Permitir ver la Cola de Espera (Shared Pool)
        const isWaiting = t.status === 'waiting';

        return isAssigned || isPrimary || isWaiting;
    });

    // Si es Admin, usa TODO. Si es Empleado, usa SOLO LO SUYO.
    const statsTransactions = userRole === 'admin' ? filteredTransactions : myTransactions;

    const totalIncome = filteredTransactions
        .filter(t => t.status === 'completed' || t.status === 'paid')
        .reduce((sum, t) => sum + (parseFloat(t.total_price) || 0) - (parseFloat(t.tip) || 0), 0);

    // Calcular comisiones basado en el rol (Admin ve total, Empleado ve suyo)
    const totalCommissions = statsTransactions.reduce((sum, t) => {
        // SOLO contar comisiones si el servicio está COMPLETADO o PAGADO
        if (t.status !== 'completed' && t.status !== 'paid') return sum;

        // Calcular el monto total de comisión + propina de la transacción
        const txTotalCommission = (parseFloat(t.commission_amount) || 0) + (parseFloat(t.tip) || 0);

        // Determinar cuántos empleados participaron
        // Si hay assignments, usar su longitud. Si no, asumir 1 (el employee_id principal).
        const employeeCount = (t.transaction_assignments && t.transaction_assignments.length > 0)
            ? t.transaction_assignments.length
            : 1;

        // Dividir equitativamente
        const splitCommission = txTotalCommission / employeeCount;

        // FIX: Si es Admin, sumar el TOTAL de la comisión (lo que paga el negocio).
        // Si es Empleado, sumar solo SU PARTE (split).
        if (userRole === 'admin') {
            return sum + txTotalCommission;
        } else {
            return sum + splitCommission;
        }
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
    // FIX: Exclude 'waiting' from productivity count
    const dailyProductivityCount = myTransactions.filter(t => t.status !== 'waiting').length;

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
            // Si se está completando, guardar la hora de finalización
            if (updates.status === 'completed') {
                updates.finished_at = new Date().toISOString();
            }

            await updateTransaction(id, updates);
            // setEditingTransactionId(null); // REMOVED: Let the modal close itself to allow async receipt upload
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

        const basePrice = parseFloat(formData.price) || 0;
        const transactionDate = new Date();
        const [hours, minutes] = formData.serviceTime.split(':');
        transactionDate.setHours(hours, minutes, 0, 0);

        // NEW FLOW: Register -> Waiting (No Employee Assigned Yet)
        const newTransaction = {
            date: transactionDate.toISOString(),
            customer_id: formData.customerId,
            service_id: formData.serviceId,
            employee_id: null, // No assigned yet
            price: basePrice,
            commission_amount: 0, // Calculated at assignment/completion
            tip: 0,
            payment_method: 'cash',
            extras: [],
            total_price: basePrice,
            status: 'waiting' // Initial Status
        };

        try {
            setIsSubmitting(true); // Disable button
            await createTransaction(newTransaction);

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
            // await refreshTransactions(); // Remove explicit refresh if createTransaction updates state, or keep it but ensure no race condition.
            // Actually, useSupabase updates state. refreshTransactions fetches again.
            // To be safe against duplication, let's rely on refreshTransactions but clear the form first.
            await refreshTransactions();
            alert("¡Turno registrado! Añadido a Cola de Espera.");

        } catch (error) {
            console.error("Error creating transaction:", error);
            alert("ERROR AL REGISTRAR: " + (error.message || JSON.stringify(error)));
        } finally {
            setIsSubmitting(false); // Re-enable button
        }
    };

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
                        <span style={{ fontSize: '0.8rem', color: 'white', backgroundColor: '#6366f1', border: '1px solid white', padding: '0.2rem 0.5rem', borderRadius: '4px', boxShadow: '0 0 10px #6366f1' }}>
                            v4.159 EMP MANAGEMENT {new Date().toLocaleTimeString()}
                        </span>
                    </div>
                </div>
                <p style={{ color: 'var(--text-muted)' }}>Resumen: {effectiveDate}</p>
            </div>


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

                <button
                    className="btn"
                    style={{
                        backgroundColor: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        padding: '0.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        opacity: isRefreshing ? 0.7 : 1,
                        cursor: isRefreshing ? 'wait' : 'pointer'
                    }}
                    onClick={async () => {
                        if (isRefreshing) return;
                        setIsRefreshing(true);
                        await refreshTransactions();
                        await refreshCustomers();
                        setTimeout(() => setIsRefreshing(false), 500); // Visual delay
                    }}
                    title="Recargar datos"
                >
                    <RefreshCw size={18} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
                    <style>{`
                                @keyframes spin { 100% { transform: rotate(360deg); } }
                            `}</style>
                </button>
            </div>


            {/* MOSTRAR BOTÓN PARA TODOS (Admin y Empleados) */}
            <button className="btn btn-primary mobile-fab" onClick={() => setIsModalOpen(true)}>
                <Plus size={20} />
                <span className="desktop-text">Registrar Servicio</span>
            </button>




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
                        <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                            {statsTransactions.filter(t => t.status === 'completed' || t.status === 'paid').length}
                        </p>
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
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>(Sin propinas)</p>
                    </div>
                )}

                <div
                    className="card"
                    onClick={() => setActiveDetailModal('commissions')}
                    style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                    <h3 className="label">{userRole === 'admin' ? 'Comisiones Totales (Ver Desglose)' : 'Mi Neto (Menos Almuerzos)'}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--warning)' }}>
                            ${userRole === 'admin' ? totalCommissions.toFixed(2) : netCommissions.toFixed(2)}
                        </p>
                        {totalLunches > 0 && userRole !== 'admin' && (
                            <span style={{ fontSize: '0.9rem', color: 'var(--danger)', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '0.25rem 0.5rem', borderRadius: '0.5rem' }}>
                                -${totalLunches.toFixed(2)} en almuerzos
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* MULTI-STAGE FLOW SECTIONS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>

                {/* COLA DE ESPERA (Summary Card) */}
                <div
                    onClick={() => setActiveDetailModal('waiting_list')}
                    style={{
                        backgroundColor: 'var(--bg-card)', padding: '1.5rem', borderRadius: '0.5rem',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)', cursor: 'pointer',
                        border: activeDetailModal === 'waiting_list' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                        transition: 'transform 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <h3 style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem', textTransform: 'uppercase' }}>Cola de Espera</h3>
                        <div style={{ backgroundColor: 'rgba(99, 102, 241, 0.2)', padding: '0.5rem', borderRadius: '50%' }}>
                            <Clock size={24} color="#6366f1" />
                        </div>
                    </div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                        {statsTransactions.filter(t => t.status === 'waiting').length}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                        Click para asignar
                    </div>
                </div>

                {/* CARD: EN PROCESO */}
                <div
                    onClick={() => setActiveDetailModal('in_progress_list')}
                    style={{
                        backgroundColor: 'var(--bg-card)', padding: '1.5rem', borderRadius: '0.5rem',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)', cursor: 'pointer',
                        border: activeDetailModal === 'in_progress_list' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                        transition: 'transform 0.2s'
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <h3 style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem', textTransform: 'uppercase' }}>En Proceso</h3>
                        <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.2)', padding: '0.5rem', borderRadius: '50%', display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <Car size={20} color="#F59E0B" />
                            <Droplets size={16} color="#3B82F6" />
                        </div>
                    </div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                        {statsTransactions.filter(t => t.status === 'in_progress').length}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                        Lavando ahora
                    </div>
                </div>

                {/* CARD: LISTO PARA RECOGER (NUEVO) */}
                <div
                    onClick={() => setActiveDetailModal('ready_list')}
                    style={{
                        backgroundColor: 'var(--bg-card)', padding: '1.5rem', borderRadius: '0.5rem',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)', cursor: 'pointer',
                        border: activeDetailModal === 'ready_list' ? '2px solid #10B981' : '1px solid var(--border-color)',
                        transition: 'transform 0.2s'
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <h3 style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem', textTransform: 'uppercase' }}>Listo para Recoger</h3>
                        <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)', padding: '0.5rem', borderRadius: '50%' }}>
                            <DollarSign size={24} color="#10B981" />
                        </div>
                    </div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                        {statsTransactions.filter(t => t.status === 'ready').length}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                        Esperando cliente
                    </div>
                </div>
            </div>

            {/* ASSIGNMENT MODAL */}
            {
                assigningTransactionId && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000
                    }} onClick={() => setAssigningTransactionId(null)}>
                        <div style={{
                            backgroundColor: 'var(--bg-card)',
                            padding: '2rem',
                            borderRadius: '0.5rem',
                            width: '90%',
                            maxWidth: '400px'
                        }} onClick={e => e.stopPropagation()}>
                            <h2 style={{ marginTop: 0 }}>Asignar Empleado(s)</h2>
                            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>¿Quién lavará este auto?</p>

                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '2rem' }}>
                                {employees.map(emp => (
                                    <button
                                        key={emp.id}
                                        onClick={() => {
                                            const current = selectedEmployeesForAssignment;
                                            const isSelected = current.includes(emp.id);
                                            if (isSelected) {
                                                setSelectedEmployeesForAssignment(current.filter(id => id !== emp.id));
                                            } else {
                                                setSelectedEmployeesForAssignment([...current, emp.id]);
                                            }
                                        }}
                                        style={{
                                            padding: '0.5rem 1rem',
                                            borderRadius: '20px',
                                            border: '1px solid var(--primary)',
                                            backgroundColor: selectedEmployeesForAssignment.includes(emp.id) ? 'var(--primary)' : 'transparent',
                                            color: selectedEmployeesForAssignment.includes(emp.id) ? 'white' : 'var(--text-primary)',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {emp.name}
                                    </button>
                                ))}
                            </div>

                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <button
                                    className="btn"
                                    style={{ flex: 1, backgroundColor: 'var(--bg-secondary)', color: 'white' }}
                                    onClick={() => setAssigningTransactionId(null)}
                                >
                                    Cancelar
                                </button>
                                <button
                                    className="btn btn-primary"
                                    style={{ flex: 1 }}
                                    onClick={handleConfirmAssignment}
                                >
                                    Confirmar
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* EDIT TRANSACTION MODAL */}
            {
                editingTransactionId && (
                    <EditTransactionModal
                        transaction={transactions.find(t => t.id === editingTransactionId)}
                        services={services}
                        employees={employees}
                        onClose={() => setEditingTransactionId(null)}
                        onUpdate={handleUpdateTransaction}
                        onDelete={handleDeleteTransactionV2}
                        userRole={userRole}
                    />
                )
            }

            {/* DETAIL MODAL */}
            {
                activeDetailModal && (
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
                            maxWidth: '600px',
                            maxHeight: '80vh',
                            overflowY: 'auto'
                        }} onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <h2 style={{ margin: 0 }}>
                                    {activeDetailModal === 'cars' && '🚗 Detalle de Autos'}
                                    {activeDetailModal === 'waiting_list' && '⏳ Cola de Espera'}
                                    {activeDetailModal === 'in_progress_list' && '🚿 Autos en Proceso'}
                                    {activeDetailModal === 'ready_list' && '✅ Listos para Recoger'}
                                    {activeDetailModal === 'income' && '💰 Desglose de Ingresos'}
                                    {activeDetailModal === 'commissions' && '👥 Desglose de Comisiones'}
                                </h2>
                                <button onClick={() => setActiveDetailModal(null)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: '1.5rem' }}>&times;</button>
                            </div>

                            {/* CONTENT BASED ON TYPE */}
                            {activeDetailModal === 'cars' && (
                                <div>
                                    {statsTransactions.filter(t => t.status === 'completed' || t.status === 'paid').length === 0 ? <p>No hay autos lavados hoy.</p> : (
                                        <ul style={{ listStyle: 'none', padding: 0 }}>
                                            {[...statsTransactions]
                                                .filter(t => t.status === 'completed' || t.status === 'paid')
                                                .sort((a, b) => {
                                                    const dateA = new Date(a.date);
                                                    const dateB = new Date(b.date);
                                                    if (dateB - dateA !== 0) return dateB - dateA;
                                                    return new Date(b.created_at) - new Date(a.created_at);
                                                })
                                                .map(t => (
                                                    <li key={t.id} style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <div>
                                                            <div style={{ fontWeight: 'bold' }}>
                                                                {new Date(t.date).toLocaleTimeString('es-PR', { timeZone: 'America/Puerto_Rico', hour: '2-digit', minute: '2-digit' })}
                                                                <span style={{ margin: '0 0.5rem' }}>-</span>
                                                                {t.customers?.vehicle_plate || 'Sin Placa'}
                                                                <span style={{ color: 'var(--text-muted)', fontWeight: 'normal', marginLeft: '0.5rem' }}>
                                                                    ({t.customers?.vehicle_model || 'Modelo?'} - {t.customers?.name})
                                                                </span>
                                                            </div>
                                                            {t.finished_at && (
                                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                                    Esperó: {Math.round((new Date(t.finished_at) - new Date(t.created_at)) / 60000)} min
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div style={{ textAlign: 'right' }}>
                                                            <span style={{
                                                                fontSize: '0.75rem',
                                                                padding: '0.1rem 0.4rem',
                                                                borderRadius: '4px',
                                                                marginRight: '0.5rem',
                                                                backgroundColor: t.payment_method === 'cash' ? 'rgba(16, 185, 129, 0.2)' : t.payment_method === 'card' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                                                                color: t.payment_method === 'cash' ? '#10B981' : t.payment_method === 'card' ? '#3B82F6' : '#F59E0B',
                                                                border: `1px solid ${t.payment_method === 'cash' ? '#10B981' : t.payment_method === 'card' ? '#3B82F6' : '#F59E0B'}`
                                                            }}>
                                                                {getPaymentMethodLabel(t.payment_method)}
                                                            </span>
                                                            <span style={{ color: 'var(--primary)' }}>{getServiceName(t.service_id)}</span>
                                                        </div>
                                                    </li>
                                                ))}
                                        </ul>
                                    )}
                                </div>
                            )}

                            {activeDetailModal === 'waiting_list' && (
                                <div>
                                    {statsTransactions.filter(t => t.status === 'waiting').length === 0 ? (
                                        <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No hay autos en espera.</p>
                                    ) : (
                                        <ul style={{ listStyle: 'none', padding: 0 }}>
                                            {statsTransactions.filter(t => t.status === 'waiting').map(t => (
                                                <li key={t.id} style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(255,255,255,0.02)', marginBottom: '0.5rem', borderRadius: '8px' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                        <div>
                                                            <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{t.customers?.vehicle_plate || 'Sin Placa'}</div>
                                                            <div style={{ color: 'var(--text-muted)' }}>{t.customers?.name}</div>
                                                            <div style={{ color: 'var(--primary)', fontWeight: 'bold', marginTop: '0.2rem' }}>{getServiceName(t.service_id)}</div>
                                                            <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.2rem' }}>
                                                                {new Date(t.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </div>
                                                        </div>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                            <button
                                                                className="btn btn-primary"
                                                                onClick={() => handleStartService(t.id)}
                                                                style={{ padding: '0.5rem 1rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                                            >
                                                                <Play size={18} style={{ minWidth: '18px' }} /> <span style={{ fontWeight: '600' }}>Comenzar</span>
                                                            </button>
                                                            <button
                                                                onClick={() => setEditingTransactionId(t.id)}
                                                                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline', display: 'flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'flex-end' }}
                                                            >
                                                                <Edit2 size={14} /> Editar
                                                            </button>
                                                        </div>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )}



                            {activeDetailModal === 'in_progress_list' && (
                                <div>
                                    {statsTransactions.filter(t => t.status === 'in_progress').length === 0 ? <p>No hay autos lavándose.</p> : (
                                        <ul style={{ listStyle: 'none', padding: 0 }}>
                                            {statsTransactions
                                                .filter(t => t.status === 'in_progress')
                                                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                                                .map(t => (
                                                    <li key={t.id} style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(255,255,255,0.02)', marginBottom: '0.5rem', borderRadius: '8px' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                            <div>
                                                                <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{t.customers?.vehicle_plate || 'Sin Placa'}</div>
                                                                <div style={{ color: 'var(--text-muted)' }}>{t.customers?.name}</div>
                                                                <div style={{ color: 'var(--warning)', fontWeight: 'bold', marginTop: '0.2rem' }}>{getServiceName(t.service_id)}</div>

                                                                {/* Assigned Employees */}
                                                                <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                                                                    {t.transaction_assignments?.map(a => (
                                                                        <span key={a.employee_id} style={{ fontSize: '0.75rem', backgroundColor: '#333', padding: '2px 6px', borderRadius: '4px' }}>
                                                                            {getEmployeeName(a.employee_id)}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
                                                                <button
                                                                    className="btn"
                                                                    onClick={() => handleNotifyReady(t)}
                                                                    title="Notificar al cliente que está listo"
                                                                    style={{ backgroundColor: '#3B82F6', color: 'white', padding: '0.5rem 1rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                                                >
                                                                    <Send size={18} style={{ minWidth: '18px' }} /> <span style={{ fontWeight: '600' }}>Listo</span>
                                                                </button>
                                                                <button
                                                                    onClick={() => setEditingTransactionId(t.id)}
                                                                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                                                >
                                                                    <Edit2 size={14} /> Editar
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </li>
                                                ))}
                                        </ul>
                                    )}
                                </div>
                            )}

                            {activeDetailModal === 'ready_list' && (
                                <div>
                                    {statsTransactions.filter(t => t.status === 'ready').length === 0 ? <p>No hay autos listos para recoger.</p> : (
                                        <ul style={{ listStyle: 'none', padding: 0 }}>
                                            {statsTransactions
                                                .filter(t => t.status === 'ready')
                                                .sort((a, b) => new Date(b.finished_at) - new Date(a.finished_at))
                                                .map(t => (
                                                    <li key={t.id} style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(16, 185, 129, 0.05)', marginBottom: '0.5rem', borderRadius: '8px', borderLeft: '4px solid #10B981' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                            <div>
                                                                <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{t.customers?.vehicle_plate || 'Sin Placa'}</div>
                                                                <div style={{ color: 'var(--text-muted)' }}>{t.customers?.name}</div>
                                                                <div style={{ color: 'var(--success)', fontWeight: 'bold', marginTop: '0.2rem' }}>{getServiceName(t.service_id)}</div>

                                                                {t.finished_at && (
                                                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                                                        Listo hace: {Math.round((new Date() - new Date(t.finished_at)) / 60000)} min
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
                                                                <button
                                                                    className="btn"
                                                                    onClick={() => handlePayment(t)}
                                                                    style={{ backgroundColor: 'var(--success)', color: 'white', padding: '0.5rem 1rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                                                >
                                                                    <DollarSign size={18} style={{ minWidth: '18px' }} /> <span style={{ fontWeight: '600' }}>Pagar</span>
                                                                </button>
                                                                <button
                                                                    onClick={() => setEditingTransactionId(t.id)}
                                                                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                                                >
                                                                    <Edit2 size={14} /> Editar
                                                                </button>
                                                            </div>
                                                        </div>
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
                                            <span style={{ fontWeight: 'bold' }}>${statsTransactions.filter(t => t.status === 'completed' && t.payment_method === 'cash').reduce((sum, t) => sum + (parseFloat(t.total_price) || 0) - (parseFloat(t.tip) || 0), 0).toFixed(2)}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                            <span>Tarjeta:</span>
                                            <span style={{ fontWeight: 'bold' }}>${statsTransactions.filter(t => t.status === 'completed' && t.payment_method === 'card').reduce((sum, t) => sum + (parseFloat(t.total_price) || 0) - (parseFloat(t.tip) || 0), 0).toFixed(2)}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span>Ath Móvil:</span>
                                            <span style={{ fontWeight: 'bold' }}>${statsTransactions.filter(t => t.status === 'completed' && t.payment_method === 'transfer').reduce((sum, t) => sum + (parseFloat(t.total_price) || 0) - (parseFloat(t.tip) || 0), 0).toFixed(2)}</span>
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
                                                    // SOLO contar si está completado
                                                    if (t.status !== 'completed') return sum;

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
                                                {statsTransactions
                                                    .filter(t => t.status === 'completed') // SOLO completados
                                                    .map(t => {
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
                )
            }

            {
                isModalOpen && (
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

                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                {/* SEARCH MODE OR SELECT MODE */}
                                                {showCustomerSearch ? (
                                                    <div style={{ position: 'relative' }}>
                                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                            <input
                                                                type="text"
                                                                className="input"
                                                                placeholder="🔍 Escribe nombre o placa..."
                                                                value={customerSearch}
                                                                onChange={(e) => setCustomerSearch(e.target.value)}
                                                                autoFocus
                                                                style={{ flex: 1 }}
                                                            />
                                                            <button
                                                                type="button"
                                                                className="btn"
                                                                onClick={() => {
                                                                    setShowCustomerSearch(false);
                                                                    setCustomerSearch('');
                                                                }}
                                                                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                                                            >
                                                                ✕
                                                            </button>
                                                        </div>

                                                        {/* RESULTS LIST */}
                                                        {customerSearch.length > 0 && (
                                                            <div style={{
                                                                position: 'absolute',
                                                                top: '100%',
                                                                left: 0,
                                                                right: 0,
                                                                backgroundColor: 'var(--bg-card)',
                                                                border: '1px solid var(--border-color)',
                                                                borderRadius: '0.5rem',
                                                                maxHeight: '200px',
                                                                overflowY: 'auto',
                                                                zIndex: 10,
                                                                marginTop: '0.25rem',
                                                                boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
                                                            }}>
                                                                {customers
                                                                    .filter(c =>
                                                                        (c.name || '').toLowerCase().includes(customerSearch.toLowerCase()) ||
                                                                        (c.vehicle_plate || '').toLowerCase().includes(customerSearch.toLowerCase())
                                                                    )
                                                                    .map(c => (
                                                                        <div
                                                                            key={c.id}
                                                                            onClick={() => {
                                                                                setFormData({ ...formData, customerId: c.id });
                                                                                setShowCustomerSearch(false);
                                                                                setCustomerSearch('');
                                                                            }}
                                                                            style={{
                                                                                padding: '0.75rem',
                                                                                borderBottom: '1px solid var(--border-color)',
                                                                                cursor: 'pointer',
                                                                                display: 'flex',
                                                                                justifyContent: 'space-between',
                                                                                alignItems: 'center'
                                                                            }}
                                                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                                                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                                                        >
                                                                            <span style={{ fontWeight: 'bold' }}>{c.name}</span>
                                                                            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{c.vehicle_plate}</span>
                                                                        </div>
                                                                    ))}
                                                                {customers.filter(c => (c.name || '').toLowerCase().includes(customerSearch.toLowerCase()) || (c.vehicle_plate || '').toLowerCase().includes(customerSearch.toLowerCase())).length === 0 && (
                                                                    <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                                                        No se encontraron resultados
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
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

                                                        {/* SEARCH TOGGLE BUTTON */}
                                                        <button
                                                            type="button"
                                                            className="btn"
                                                            onClick={() => setShowCustomerSearch(true)}
                                                            title="Buscar Cliente"
                                                            style={{
                                                                flexShrink: 0,
                                                                width: '48px',
                                                                padding: 0,
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                backgroundColor: 'var(--bg-secondary)',
                                                                color: 'white',
                                                                fontSize: '1.5rem'
                                                            }}
                                                        >
                                                            🔍
                                                        </button>

                                                        {/* ADD CUSTOMER BUTTON */}
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
                                                                justifyContent: 'center',
                                                                fontSize: '2rem',
                                                                lineHeight: '1'
                                                            }}
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div style={{ padding: '1rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
                                                <h4 style={{ marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Nuevo Cliente Rápido</h4>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '0.5rem' }}>
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
                                    <button
                                        type="button"
                                        className="btn btn-primary"
                                        onClick={handleSubmit}
                                        disabled={isSubmitting}
                                        style={{ opacity: isSubmitting ? 0.7 : 1 }}
                                    >
                                        {isSubmitting ? 'Registrando...' : 'Registrar Venta'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div >
                )
            }

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
                        employees={employees} // Pass employees
                        onUpdate={handleUpdateTransaction}
                    />
                )
            }

            {/* ERROR ALERT */}
            {
                error && (
                    <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem', border: '1px solid #EF4444' }}>
                        <strong>Error:</strong> {error}
                        <button onClick={() => setError(null)} style={{ float: 'right', background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer' }}>✕</button>
                    </div>
                )
            }



            {/* SECCIÓN DE HISTORIAL (PAGADOS) */}
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>✅ Historial de Ventas</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                {statsTransactions
                    .filter(t => t.status === 'completed' || t.status === 'paid')
                    .sort((a, b) => {
                        const dateA = new Date(a.date);
                        const dateB = new Date(b.date);
                        if (dateB - dateA !== 0) return dateB - dateA;
                        return new Date(b.created_at) - new Date(a.created_at);
                    })
                    .map(t => (
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
                                    <div style={{ fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                                        🚗 {t.customers?.vehicle_model || 'Modelo?'} <span style={{ color: 'var(--text-muted)' }}>({t.customers?.vehicle_plate || 'Sin Placa'})</span>
                                    </div>
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
            {
                selectedTransaction && (
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
                )
            }


            {/* CHART SECTION (ADMIN ONLY) */}
            {
                userRole === 'admin' && (
                    <ServiceAnalyticsChart transactions={transactions} />
                )
            }

            {/* GAMIFICATION BAR OR ADMIN CHART (MOVED TO BOTTOM) */}
            {
                userRole === 'admin' && dateFilter === 'custom' ? (
                    <EmployeeProductivityChart transactions={transactions} employees={employees} />
                ) : (
                    <ProductivityBar
                        dailyCount={dailyProductivityCount}
                        dailyTarget={dailyTarget}
                        totalXp={totalXp}
                        isEditable={userRole === 'admin'}
                        onEditTarget={handleEditTarget}
                    />
                )
            }





        </div >
    );
};

export default Dashboard;
