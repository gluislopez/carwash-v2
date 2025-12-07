import React, { useState, useEffect } from 'react';
import { Plus, Trash2, User, Phone, Mail, Shield, Calendar, DollarSign, Clock, X, Edit, Power } from 'lucide-react';
import useSupabase from '../hooks/useSupabase';
import { supabase } from '../supabase';
import { createAccount } from '../utils/authAdmin';

const Employees = () => {
    const { data: employees, create, remove, update } = useSupabase('employees', '*', { orderBy: { column: 'is_active', ascending: false } });
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [userRole, setUserRole] = useState(null);

    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [performanceFilter, setPerformanceFilter] = useState('today'); // 'today', 'week', 'month', 'manual'
    const [dateRange, setDateRange] = useState({
        start: new Date().toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });
    const [transactions, setTransactions] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [services, setServices] = useState([]); // Fetch Services for robust commission calc
    const [fetchError, setFetchError] = useState(null);

    useEffect(() => {
        // ... (existing getUserRole and fetchData logic) ...
        const getUserRole = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: employee } = await supabase
                    .from('employees')
                    .select('role')
                    .eq('user_id', user.id)
                    .single();
                if (employee) setUserRole(employee.role);
            }
        };

        const fetchData = async () => {
            // Fetch completed/paid transactions with assignments
            const { data: txs, error } = await supabase
                .from('transactions')
                .select(`
                    *,
                    transaction_assignments (employee_id),
                    customers (name),
                    vehicles (brand, model)
                `)
                .in('status', ['completed', 'paid'])
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching transactions:', error);
            }
            if (txs) setTransactions(txs);

            // Fetch expenses
            const { data: exps } = await supabase
                .from('expenses')
                .select('*');

            if (exps) setExpenses(exps);

            // Fetch Services
            const { data: srvs } = await supabase
                .from('services')
                .select('*');
            if (srvs) setServices(srvs);
        };

        getUserRole();
        fetchData();
    }, []);

    // ... (rest of component) ...

    // --- Performance Logic ---

    const getFilteredData = () => {
        if (!selectedEmployee) return { filteredTxs: [], filteredExps: [] };

        if (performanceFilter === 'all') {
            const filteredTxs = transactions.filter(t => {
                const isAssigned = t.transaction_assignments?.some(a => a.employee_id === selectedEmployee.id);
                const isPrimary = t.employee_id === selectedEmployee.id;
                return (isAssigned || isPrimary);
            });
            const filteredExps = expenses.filter(e => e.employee_id === selectedEmployee.id);
            return { filteredTxs, filteredExps };
        }

        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        let filterDate;
        // Logic for presets
        if (performanceFilter === 'today') filterDate = startOfDay;
        else if (performanceFilter === 'week') {
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() - now.getDay());
            startOfWeek.setHours(0, 0, 0, 0);
            filterDate = startOfWeek;
        }
        else if (performanceFilter === 'month') {
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            filterDate = startOfMonth;
        }

        const filteredTxs = transactions.filter(t => {
            const isAssigned = t.transaction_assignments?.some(a => a.employee_id === selectedEmployee.id);
            const isPrimary = t.employee_id === selectedEmployee.id;

            if (!(isAssigned || isPrimary)) return false;

            const txDate = new Date(t.created_at);
            const now = new Date();

            if (performanceFilter === 'manual') {
                // Parse selectedDate (YYYY-MM-DD local)
                // We need to compare dates ignoring time.
                // Note: t.created_at is UTC usually. But selectedDate is local string "YYYY-MM-DD".
                // Safest is to compare YYYY-MM-DD string of txDate converted to local with selectedDate.
                const txLocal = txDate.toLocaleDateString('en-CA'); // YYYY-MM-DD format in local time
                return txLocal >= dateRange.start && txLocal <= dateRange.end;
            }

            if (performanceFilter === 'today') {
                return txDate.getDate() === now.getDate() &&
                    txDate.getMonth() === now.getMonth() &&
                    txDate.getFullYear() === now.getFullYear();
            }

            if (performanceFilter === 'week') {
                const startOfWeek = new Date(now);
                startOfWeek.setDate(now.getDate() - now.getDay());
                startOfWeek.setHours(0, 0, 0, 0);
                return txDate >= startOfWeek;
            }

            if (performanceFilter === 'month') {
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                return txDate >= startOfMonth;
            }

            return true; // Should not reach here
        });

        const filteredExps = expenses.filter(e => {
            const eDate = new Date(e.date);

            if (performanceFilter === 'manual') {
                const exLocal = eDate.toLocaleDateString('en-CA');
                return (e.employee_id === selectedEmployee.id) && (exLocal >= dateRange.start && exLocal <= dateRange.end);
            }

            return e.employee_id === selectedEmployee.id && eDate >= filterDate;
        });

        return { filteredTxs, filteredExps };
    };

    const calculateStats = () => {
        const { filteredTxs, filteredExps } = getFilteredData();

        let totalBaseCommission = 0;
        let totalExtrasCommission = 0;
        let totalTips = 0;

        filteredTxs.forEach(t => {
            const count = (t.transaction_assignments?.length) || 1;

            // 1. Identify Commissions - USE LOOSE EQUALITY
            const myExtras = t.extras?.filter(e => e.assignedTo == selectedEmployee.id) || [];
            const myExtrasCommission = myExtras.reduce((s, e) => s + (parseFloat(e.commission) || 0), 0);

            const allAssignedExtras = t.extras?.filter(e => e.assignedTo) || [];
            const allAssignedCommission = allAssignedExtras.reduce((s, e) => s + (parseFloat(e.commission) || 0), 0);

            const storedTotal = parseFloat(t.commission_amount) || 0;

            // 2. Heuristic SAFEGUARDED
            let sharedPool = 0;
            const service = services.find(s => s.id == t.service_id);
            const likelyBase = service ? (parseFloat(service.commission) || 0) : 0;

            if (service) {
                const likelyTotal = likelyBase + allAssignedCommission;
                if (storedTotal < (likelyTotal - 0.1)) {
                    sharedPool = storedTotal;
                } else {
                    sharedPool = Math.max(0, storedTotal - allAssignedCommission);
                }
            } else {
                sharedPool = Math.max(0, storedTotal - allAssignedCommission);
            }

            const sharedPart = (sharedPool / count) || 0;
            const tip = (parseFloat(t.tip) || 0);
            const tipShare = (tip / count) || 0;

            const myTotalParams = sharedPart + myExtrasCommission + tipShare;
            if (!isNaN(myTotalParams)) {
                totalBaseCommission += sharedPart;
                totalExtrasCommission += myExtrasCommission;
                totalTips += tipShare;
            }
        });

        const totalExpenses = filteredExps.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
        const netTotal = (totalBaseCommission + totalExtrasCommission + totalTips) - totalExpenses;

        return {
            count: filteredTxs.length,
            commission: totalBaseCommission + totalExtrasCommission, // Total Commission
            commissionBase: totalBaseCommission,
            commissionExtras: totalExtrasCommission,
            tips: totalTips,
            expenses: totalExpenses,
            net: netTotal,
            txs: filteredTxs
        };
    };

    const stats = selectedEmployee ? calculateStats() : null;

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', marginBottom: '0.5rem' }}>Empleados</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Gestiona tu equipo de trabajo <span style={{ fontSize: '0.7rem', backgroundColor: '#3B82F6', color: 'white', padding: '2px 4px', borderRadius: '4px' }}>v4.237.0</span></p>
                </div>

                {/* SOLO ADMIN PUEDE CREAR EMPLEADOS */}
                {userRole === 'admin' && (
                    <button className="btn btn-primary" onClick={() => {
                        setEditingId(null);
                        setFormData({ name: '', position: 'Lavador', phone: '', email: '', password: '', user_id: '' });
                        setIsModalOpen(true);
                    }}>
                        <Plus size={20} />
                        Nuevo Empleado
                    </button>
                )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                {employees.map((employee) => (
                    <div
                        key={employee.id}
                        className="card"
                        style={{
                            position: 'relative',
                            cursor: userRole === 'admin' ? 'pointer' : 'default',
                            transition: 'transform 0.2s',
                            opacity: employee.is_active ? (userRole === 'admin' ? 1 : 0.9) : 0.5,
                            filter: employee.is_active ? 'none' : 'grayscale(100%)'
                        }}
                        onClick={() => {
                            if (userRole === 'admin') setSelectedEmployee(employee);
                        }}
                        onMouseEnter={(e) => {
                            if (userRole === 'admin') e.currentTarget.style.transform = 'scale(1.02)';
                        }}
                        onMouseLeave={(e) => {
                            if (userRole === 'admin') e.currentTarget.style.transform = 'scale(1)';
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                            <div style={{
                                width: '50px', height: '50px', borderRadius: '50%',
                                backgroundColor: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <User size={24} />
                            </div>
                            <div>
                                <h3 style={{ fontWeight: 'bold' }}>{employee.name}</h3>
                                <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', backgroundColor: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                                    {employee.position}
                                </span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                            {employee.phone && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Phone size={16} /> {employee.phone}
                                </div>
                            )}
                            {employee.email && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Mail size={16} /> {employee.email}
                                </div>
                            )}
                            {employee.user_id && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--success)' }}>
                                    <Shield size={16} /> Cuenta Vinculada
                                </div>
                            )}
                        </div>

                        {/* ADMIN ACTIONS */}
                        {userRole === 'admin' && (
                            <div style={{ position: 'absolute', top: '1rem', right: '1rem', display: 'flex', gap: '0.5rem' }}>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleEdit(employee); }}
                                    style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer' }}
                                    title="Editar"
                                >
                                    <Edit size={18} />
                                </button>
                                <button
                                    onClick={(e) => handleToggleStatus(employee, e)}
                                    style={{ background: 'none', border: 'none', color: employee.is_active ? 'var(--success)' : 'var(--text-muted)', cursor: 'pointer' }}
                                    title={employee.is_active ? "Desactivar" : "Activar"}
                                >
                                    <Power size={18} />
                                </button>
                                <button
                                    onClick={(e) => handleDelete(employee.id, e)}
                                    style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', opacity: 0.5 }}
                                    title="Eliminar permanentemente"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* PERFORMANCE MODAL */}
            {selectedEmployee && stats && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000
                }} onClick={() => setSelectedEmployee(null)}>
                    <div className="card" style={{ width: '95%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', padding: '0' }} onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h2 style={{ margin: 0 }}>{selectedEmployee.name}</h2>
                                <p style={{ color: 'var(--text-muted)', margin: 0 }}>Rendimiento y Pagos</p>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                    onClick={() => {
                                        import('jspdf').then(jsPDF => {
                                            import('jspdf-autotable').then(autoTable => {
                                                const doc = new jsPDF.default();

                                                // Header
                                                doc.setFontSize(18);
                                                doc.text('Recibo de Nómina - CarWash SaaS', 14, 20);

                                                doc.setFontSize(12);
                                                doc.text(`Empleado: ${selectedEmployee.name}`, 14, 30);

                                                let periodText = '';
                                                if (performanceFilter === 'today') periodText = 'Hoy';
                                                else if (performanceFilter === 'week') periodText = 'Esta Semana';
                                                else if (performanceFilter === 'month') periodText = 'Este Mes';
                                                else if (performanceFilter === 'manual') periodText = `Desde ${dateRange.start} hasta ${dateRange.end}`;
                                                else periodText = 'Todo';

                                                doc.text(`Periodo: ${periodText}`, 14, 36);
                                                doc.text(`Fecha Generación: ${new Date().toLocaleDateString()}`, 14, 42);

                                                // Summary Table
                                                autoTable.default(doc, {
                                                    startY: 50,
                                                    head: [['Concepto', 'Monto']],
                                                    body: [
                                                        ['Comisiones', `$${stats.commission.toFixed(2)}`],
                                                        ['Propinas', `$${stats.tips.toFixed(2)}`],
                                                        ['Descuentos/Almuerzos', `-$${stats.expenses.toFixed(2)}`],
                                                        ['TOTAL A PAGAR', `$${stats.net.toFixed(2)}`]
                                                    ],
                                                    theme: 'striped',
                                                    headStyles: { fillColor: [99, 102, 241] }
                                                });

                                                // Transactions Detail
                                                doc.text('Detalle de Servicios', 14, doc.lastAutoTable.finalY + 10);

                                                const tableData = stats.txs.map(t => {
                                                    const vehicle = t.vehicles ? `${t.vehicles.brand === 'Generico' ? '' : t.vehicles.brand} ${t.vehicles.model}` : 'N/A';
                                                    const count = t.transaction_assignments?.length || 1;

                                                    // Logic: Shared Pool + My Extras
                                                    const myExtras = t.extras?.filter(e => e.assignedTo === selectedEmployee.id) || [];
                                                    const myExtrasCommission = myExtras.reduce((s, e) => s + (parseFloat(e.commission) || 0), 0);

                                                    const allAssignedExtras = t.extras?.filter(e => e.assignedTo) || [];
                                                    const allAssignedCommission = allAssignedExtras.reduce((s, e) => s + (parseFloat(e.commission) || 0), 0);

                                                    const storedTotal = parseFloat(t.commission_amount) || 0;

                                                    const service = services.find(s => s.id == t.service_id);
                                                    const likelyBase = service ? (parseFloat(service.commission) || 0) : 0;

                                                    let sharedPool = 0;
                                                    if (service) {
                                                        const likelyTotal = likelyBase + allAssignedCommission;
                                                        if (storedTotal < (likelyTotal - 0.1)) {
                                                            sharedPool = storedTotal;
                                                        } else {
                                                            sharedPool = Math.max(0, storedTotal - allAssignedCommission);
                                                        }
                                                    } else {
                                                        sharedPool = Math.max(0, storedTotal - allAssignedCommission);
                                                    }

                                                    const sharedPart = (sharedPool / count) || 0;
                                                    const myShare = sharedPart + myExtrasCommission + ((parseFloat(t.tip) || 0) / count);

                                                    return [
                                                        new Date(t.date).toLocaleDateString(),
                                                        vehicle,
                                                        `$${sharedPart.toFixed(2)}`, // Base
                                                        `$${myExtrasCommission.toFixed(2)}`, // Extras
                                                        `$${(parseFloat(t.tip) || 0).toFixed(2)}`, // Propina
                                                        `$${(isNaN(myShare) ? 0 : myShare).toFixed(2)}` // Total
                                                    ];
                                                });

                                                autoTable.default(doc, {
                                                    startY: doc.lastAutoTable.finalY + 15,
                                                    head: [['Fecha', 'Vehículo', 'Base', 'Extras', 'Propina', 'Total']],
                                                    body: tableData,
                                                    theme: 'grid',
                                                    styles: { fontSize: 8 }
                                                });

                                                doc.save(`Nomina_${selectedEmployee.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
                                            });
                                        });
                                    }}
                                    className="btn btn-primary"
                                    style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                >
                                    <DollarSign size={16} /> Descargar Recibo
                                </button>
                                <button onClick={() => setSelectedEmployee(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                    <X size={24} />
                                </button>
                            </div>
                        </div>

                        {/* Filters */}
                        <div style={{ padding: '1rem', display: 'flex', gap: '0.5rem', overflowX: 'auto', alignItems: 'center' }}>
                            {['today', 'week', 'month', 'all', 'manual'].map(filter => (
                                <button
                                    key={filter}
                                    onClick={() => setPerformanceFilter(filter)}
                                    style={{
                                        padding: '0.5rem 1rem',
                                        borderRadius: '2rem',
                                        border: '1px solid var(--primary)',
                                        backgroundColor: performanceFilter === filter ? 'var(--primary)' : 'transparent',
                                        color: performanceFilter === filter ? 'white' : 'var(--primary)',
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    {filter === 'today' && 'Hoy'}
                                    {filter === 'week' && 'Esta Semana'}
                                    {filter === 'month' && 'Este Mes'}
                                    {filter === 'all' && 'Todo'}
                                    {filter === 'manual' && 'Rango/Fecha'}
                                </button>
                            ))}

                            {/* Manual Date Input */}
                            {performanceFilter === 'manual' && (
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <input
                                        type="date"
                                        value={dateRange.start}
                                        onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                                        style={{
                                            padding: '0.4rem',
                                            borderRadius: '0.5rem',
                                            border: '1px solid var(--border-color)',
                                            backgroundColor: 'var(--bg-input)',
                                            color: 'var(--text-primary)'
                                        }}
                                        title="Desde"
                                    />
                                    <span style={{ color: 'var(--text-muted)' }}>-</span>
                                    <input
                                        type="date"
                                        value={dateRange.end}
                                        onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                                        style={{
                                            padding: '0.4rem',
                                            borderRadius: '0.5rem',
                                            border: '1px solid var(--border-color)',
                                            backgroundColor: 'var(--bg-input)',
                                            color: 'var(--text-primary)'
                                        }}
                                        title="Hasta"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Stats Grid */}
                        <div style={{ padding: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '0.5rem' }}>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Autos Lavados</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.count}</div>
                            </div>
                            <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '1rem', borderRadius: '0.5rem' }}>
                                <div style={{ color: 'var(--success)', fontSize: '0.9rem' }}>Total Neto</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--success)' }}>${stats.net.toFixed(2)}</div>
                            </div>
                        </div>

                        {/* Detailed Breakdown */}
                        <div style={{ padding: '0 1.5rem 1.5rem' }}>
                            <h4 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Desglose</h4>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                <span>Comisiones Base:</span>
                                <span>${(stats.net - stats.tips + stats.expenses - stats.commissionExtras || 0).toFixed(2)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                <span>Extras Asignados:</span>
                                <span>${(stats.commissionExtras || 0).toFixed(2)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                <span>Propinas:</span>
                                <span>${stats.tips.toFixed(2)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: 'var(--danger)' }}>
                                <span>Descuentos/Almuerzos:</span>
                                <span>-${stats.expenses.toFixed(2)}</span>
                            </div>
                        </div>

                        {/* Transaction List */}
                        <div style={{ padding: '0 1.5rem 1.5rem' }}>
                            <h4 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Historial ({stats.txs.length})</h4>
                            {stats.txs.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>No hay actividad en este periodo.</p> : (
                                <ul style={{ listStyle: 'none', padding: 0 }}>
                                    {stats.txs.map(t => (
                                        <li key={t.id} style={{ padding: '0.75rem 0', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <div style={{ fontWeight: 'bold' }}>
                                                    {(() => {
                                                        if (!t.vehicles) return 'Modelo No Registrado';
                                                        const brand = t.vehicles.brand === 'Generico' ? '' : t.vehicles.brand;
                                                        return `${brand || ''} ${t.vehicles.model || ''}`.trim() || 'Modelo No Registrado';
                                                    })()}
                                                </div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                    {new Date(t.date).toLocaleDateString()} - {new Date(t.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                                {/* Details Line */}
                                                <div style={{ fontSize: '0.75rem', color: '#aaa', marginTop: '0.2rem' }}>
                                                    {t.transaction_assignments?.length > 1 && (
                                                        <span style={{ color: 'var(--primary)', marginRight: '0.5rem' }}>
                                                            Compartido ({t.transaction_assignments.length})
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ color: 'var(--success)', fontWeight: 'bold' }}>
                                                    {(() => {
                                                        const count = t.transaction_assignments?.length || 1;
                                                        const storedTotal = parseFloat(t.commission_amount) || 0;

                                                        // 1. Calculate Extras
                                                        const myExtras = t.extras?.filter(e => e.assignedTo == selectedEmployee.id) || [];
                                                        const myExtrasCommission = myExtras.reduce((s, e) => s + (parseFloat(e.commission) || 0), 0);

                                                        const allAssignedExtras = t.extras?.filter(e => e.assignedTo) || [];
                                                        const allAssignedCommission = allAssignedExtras.reduce((s, e) => s + (parseFloat(e.commission) || 0), 0);

                                                        // HEURISTIC WITH SAFEGUARDS
                                                        let sharedPool = Math.max(0, storedTotal - allAssignedCommission);

                                                        const sharedPart = (sharedPool / count) || 0;
                                                        const myShare = sharedPart + myExtrasCommission + ((parseFloat(t.tip) || 0) / count);

                                                        if (isNaN(myShare)) return "$0.00";

                                                        return (
                                                            <span>
                                                                ${myShare.toFixed(2)}
                                                                {(myExtrasCommission > 0) && (
                                                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                                                        (Base: ${sharedPart.toFixed(1)} + Extra: ${myExtrasCommission.toFixed(1)})
                                                                    </div>
                                                                )}
                                                            </span>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {isModalOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
                }}>
                    <div className="card" style={{ width: '100%', maxWidth: '500px' }}>
                        <h3 style={{ marginBottom: '1.5rem' }}>{editingId ? 'Editar Empleado' : 'Registrar Empleado'}</h3>
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
                                    <label className="label">Cargo</label>
                                    <select
                                        className="input"
                                        value={formData.position}
                                        onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                                    >
                                        <option value="Lavador">Lavador</option>
                                        <option value="Cajero">Cajero</option>
                                        <option value="Gerente">Gerente</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="label">Teléfono</label>
                                    <input
                                        type="tel"
                                        className="input"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div style={{ marginBottom: '1rem' }}>
                                <label className="label">Email (Contacto y Login)</label>
                                <input
                                    type="email"
                                    className="input"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>

                            <div style={{ marginBottom: '1rem' }}>
                                <label className="label">Contraseña (Opcional - Para crear cuenta)</label>
                                <input
                                    type="password"
                                    className="input"
                                    placeholder="Mínimo 6 caracteres"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                />
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                    Si escribes una contraseña, se creará el usuario automáticamente.
                                </p>
                            </div>

                            <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: 'rgba(99, 102, 241, 0.1)', borderRadius: '8px', border: '1px solid var(--primary)' }}>
                                <label className="label" style={{ color: 'var(--primary)' }}>ID de Usuario (Automático)</label>
                                <p style={{ fontSize: '0.8rem', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>
                                    Si pusiste contraseña arriba, <b>esto se llenará solo</b>. <br />
                                    Solo úsalo si ya creaste el usuario manualmente en Supabase.
                                </p>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="Se genera automáticamente..."
                                    value={formData.user_id}
                                    onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                                    style={{ fontFamily: 'monospace', backgroundColor: formData.password ? 'rgba(0,0,0,0.1)' : 'var(--bg-card)' }}
                                    readOnly={!!formData.password}
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                                <button type="button" className="btn" onClick={() => setIsModalOpen(false)} style={{ backgroundColor: 'var(--bg-secondary)', color: 'white' }}>
                                    Cancelar
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    Guardar Empleado
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Employees;
