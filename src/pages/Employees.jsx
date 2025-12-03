import React, { useState, useEffect } from 'react';
import { Plus, Trash2, User, Phone, Mail, Shield, Calendar, DollarSign, Clock, X } from 'lucide-react';
import useSupabase from '../hooks/useSupabase';
import { supabase } from '../supabase';

const Employees = () => {
    const { data: employees, create, remove } = useSupabase('employees');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [userRole, setUserRole] = useState(null);

    // Performance Modal State
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [performanceFilter, setPerformanceFilter] = useState('today'); // 'today', 'week', 'month'
    const [transactions, setTransactions] = useState([]);
    const [expenses, setExpenses] = useState([]);

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
            // Fetch completed transactions with assignments
            const { data: txs } = await supabase
                .from('transactions')
                .select(`
                    *,
                    transaction_assignments (employee_id),
                    customers (name, vehicle_plate)
                `)
                .eq('status', 'completed')
                .order('created_at', { ascending: false });

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
        user_id: ''
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const dataToSave = {
                ...formData,
                user_id: formData.user_id.trim() === '' ? null : formData.user_id
            };

            await create(dataToSave);
            setIsModalOpen(false);
            setFormData({ name: '', position: 'Lavador', phone: '', email: '', user_id: '' });
        } catch (error) {
            alert('Error al crear empleado: ' + error.message);
        }
    };

    const handleDelete = async (id, e) => {
        e.stopPropagation(); // Prevent opening modal
        if (window.confirm('¿Estás seguro de eliminar este empleado?')) {
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
            // Fix Timezone Issue: Parse YYYY-MM-DD as Local Time by appending T00:00:00
            // If using created_at (ISO UTC), it works fine.
            const tDate = t.date ? new Date(t.date + 'T00:00:00') : new Date(t.created_at);

            // Check if transaction belongs to employee
            const isAssigned = t.transaction_assignments?.some(a => a.employee_id === selectedEmployee.id);
            const isPrimary = t.employee_id === selectedEmployee.id; // Legacy support
            return (isAssigned || isPrimary) && tDate >= filterDate;
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
                    <p style={{ color: 'var(--text-muted)' }}>Gestiona tu equipo de trabajo</p>
                </div>

                {/* SOLO ADMIN PUEDE CREAR EMPLEADOS */}
                {userRole === 'admin' && (
                    <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
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
                        style={{ position: 'relative', cursor: 'pointer', transition: 'transform 0.2s' }}
                        onClick={() => setSelectedEmployee(employee)}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
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

                        {/* SOLO ADMIN PUEDE BORRAR */}
                        {userRole === 'admin' && (
                            <button
                                onClick={(e) => handleDelete(employee.id, e)}
                                style={{
                                    position: 'absolute', top: '1rem', right: '1rem',
                                    background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', opacity: 0.7
                                }}
                            >
                                <Trash2 size={18} />
                            </button>
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
                            <button onClick={() => setSelectedEmployee(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                <X size={24} />
                            </button>
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
                                                <div style={{ fontWeight: 'bold' }}>{t.customers?.vehicle_plate || 'Sin Placa'}</div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                    {new Date(t.date).toLocaleDateString()} - {new Date(t.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </div>
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
                        <h3 style={{ marginBottom: '1.5rem' }}>Registrar Empleado</h3>
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
                                <label className="label">Email (Contacto)</label>
                                <input
                                    type="email"
                                    className="input"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>

                            <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: 'rgba(99, 102, 241, 0.1)', borderRadius: '8px', border: '1px solid var(--primary)' }}>
                                <label className="label" style={{ color: 'var(--primary)' }}>Vincular Usuario (Importante)</label>
                                <p style={{ fontSize: '0.8rem', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>
                                    Crea el usuario en Supabase (Authentication), copia su "User UID" y pégalo aquí.
                                </p>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="Ej: a1b2c3d4-..."
                                    value={formData.user_id}
                                    onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                                    style={{ fontFamily: 'monospace' }}
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
