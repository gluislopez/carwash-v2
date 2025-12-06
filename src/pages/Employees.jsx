import React, { useState, useEffect } from 'react';
import { Plus, Trash2, User, Phone, Mail, Shield, Calendar, DollarSign, Clock, X, Edit, Power } from 'lucide-react';
import useSupabase from '../hooks/useSupabase';
import { supabase } from '../supabase';
import { createAccount } from '../utils/authAdmin';

const Employees = () => {
    const { data: employees, create, remove, update } = useSupabase('employees', '*', { orderBy: { column: 'is_active', ascending: false } });
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [userRole, setUserRole] = useState(null);

    // Performance Modal State
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [performanceFilter, setPerformanceFilter] = useState('today'); // 'today', 'week', 'month'
    const [transactions, setTransactions] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [fetchError, setFetchError] = useState(null);

    useEffect(() => {
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
        };

        getUserRole();
        fetchData();
    }, []);

    const [formData, setFormData] = useState({
        name: '',
        position: 'Lavador',
        phone: '',
        email: '',
        password: '', // New password field
        user_id: ''
    });

    const [editingId, setEditingId] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            let finalUserId = formData.user_id.trim();

            // Only create auth user if we are NOT editing (or if we want to allow linking later, but for now keep simple)
            // If editing, we generally don't change the auth user unless explicitly requested, but the form allows editing the ID.

            if (!editingId && formData.password && formData.email) {
                const { user, error } = await createAccount(formData.email, formData.password);
                if (error) throw new Error('Error creando usuario: ' + error.message);
                if (user) {
                    finalUserId = user.id;
                    alert(`Usuario creado exitosamente.\nID: ${user.id}`);
                }
            }

            const dataToSave = {
                name: formData.name,
                position: formData.position,
                phone: formData.phone,
                email: formData.email,
                user_id: finalUserId === '' ? null : finalUserId
            };

            if (editingId) {
                await update(editingId, dataToSave);
                alert('Empleado actualizado correctamente');
            } else {
                await create(dataToSave);
            }

            setIsModalOpen(false);
            setFormData({ name: '', position: 'Lavador', phone: '', email: '', password: '', user_id: '' });
            setEditingId(null);
        } catch (error) {
            alert('Error: ' + error.message);
        }
    };

    const handleEdit = (employee) => {
        setFormData({
            name: employee.name,
            position: employee.position,
            phone: employee.phone || '',
            email: employee.email || '',
            password: '', // Don't edit password here
            user_id: employee.user_id || ''
        });
        setEditingId(employee.id);
        setIsModalOpen(true);
    };

    const handleToggleStatus = async (employee, e) => {
        e.stopPropagation();
        const newStatus = !employee.is_active;
        const action = newStatus ? 'activar' : 'desactivar';
        if (window.confirm(`¿Estás seguro de ${action} a ${employee.name}?`)) {
            await update(employee.id, { is_active: newStatus });
        }
    };

    const handleDelete = async (id, e) => {
        e.stopPropagation();
        if (window.confirm('¿Estás seguro de eliminar este empleado permanentemente?')) {
            await remove(id);
        }
    };

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

        // Start of Week (Sunday)
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);

        // Start of Month
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        let filterDate;
        if (performanceFilter === 'today') filterDate = startOfDay;
        else if (performanceFilter === 'week') filterDate = startOfWeek;
        else if (performanceFilter === 'month') filterDate = startOfMonth;

        const filteredTxs = transactions.filter(t => {
            // Check if transaction belongs to employee
            const isAssigned = t.transaction_assignments?.some(a => a.employee_id === selectedEmployee.id);
            const isPrimary = t.employee_id === selectedEmployee.id; // Legacy support

            if (!(isAssigned || isPrimary)) return false;

            const txDate = new Date(t.created_at);
            const now = new Date();

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

            return true; // 'all'
        });

        const filteredExps = expenses.filter(e => {
            const eDate = new Date(e.date);
            return e.employee_id === selectedEmployee.id && eDate >= filterDate;
        });

        return { filteredTxs, filteredExps };
    };

    const calculateStats = () => {
        const { filteredTxs, filteredExps } = getFilteredData();

        let totalCommission = 0;
        let totalTips = 0;

        filteredTxs.forEach(t => {
            const comm = (parseFloat(t.commission_amount) || 0);
            const tip = (parseFloat(t.tip) || 0);
            const count = (t.transaction_assignments?.length) || 1;

            totalCommission += (comm / count);
            totalTips += (tip / count);
        });

        const totalExpenses = filteredExps.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
        const netTotal = (totalCommission + totalTips) - totalExpenses;

        return {
            count: filteredTxs.length,
            commission: totalCommission,
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
                    <p style={{ color: 'var(--text-muted)' }}>Gestiona tu equipo de trabajo <span style={{ fontSize: '0.7rem', backgroundColor: '#3B82F6', color: 'white', padding: '2px 4px', borderRadius: '4px' }}>v4.220</span></p>
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
                                                doc.text(`Periodo: ${performanceFilter === 'today' ? 'Hoy' : performanceFilter === 'week' ? 'Esta Semana' : performanceFilter === 'month' ? 'Este Mes' : 'Todo'}`, 14, 36);
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
                                                    const shareCount = t.transaction_assignments?.length || 1;
                                                    const myShare = ((parseFloat(t.commission_amount) + parseFloat(t.tip)) / shareCount).toFixed(2);
                                                    return [
                                                        new Date(t.date).toLocaleDateString(),
                                                        vehicle,
                                                        `$${t.commission_amount}`,
                                                        `$${t.tip}`,
                                                        `$${myShare}`
                                                    ];
                                                });

                                                autoTable.default(doc, {
                                                    startY: doc.lastAutoTable.finalY + 15,
                                                    head: [['Fecha', 'Vehículo', 'Comm Total', 'Propina Total', 'Mi Parte']],
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
                        <div style={{ padding: '1rem', display: 'flex', gap: '0.5rem', overflowX: 'auto' }}>
                            {['today', 'week', 'month', 'all'].map(filter => (
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
                                </button>
                            ))}
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
                                <span>Comisiones:</span>
                                <span>${stats.commission.toFixed(2)}</span>
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
                                                {/* Debug Line */}
                                                <div style={{ fontSize: '0.7rem', color: '#555' }}>
                                                    Comm: ${t.commission_amount} | Tip: ${t.tip} | Status: {t.status}
                                                </div>
                                                {t.transaction_assignments?.length > 1 && (
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--primary)', marginTop: '0.2rem' }}>
                                                        Compartido con: {t.transaction_assignments
                                                            .filter(a => a.employee_id !== selectedEmployee.id)
                                                            .map(a => {
                                                                const emp = employees?.find(e => e.id === a.employee_id);
                                                                return emp?.name || 'Otro';
                                                            })
                                                            .join(', ')}
                                                    </div>
                                                )}
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ color: 'var(--success)' }}>
                                                    +${((parseFloat(t.commission_amount) + parseFloat(t.tip)) / (t.transaction_assignments?.length || 1)).toFixed(2)}
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
