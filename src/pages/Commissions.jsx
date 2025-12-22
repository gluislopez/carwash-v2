import React, { useState, useEffect } from 'react';
import { DollarSign, User, Calendar, X } from 'lucide-react';
import useSupabase from '../hooks/useSupabase';
import { supabase } from '../supabase';
import { formatToFraction } from '../utils/fractionUtils';

const Commissions = () => {
    const { data: employees } = useSupabase('employees');
    const [userRole, setUserRole] = useState(null);
    const [myEmployeeId, setMyEmployeeId] = useState(null);

    // Helper for PR Date
    const getPRDateString = (dateInput) => {
        if (!dateInput) return '';
        const date = new Date(dateInput);
        return date.toLocaleDateString('en-CA', { timeZone: 'America/Puerto_Rico' });
    };

    // State for Stats View
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [performanceFilter, setPerformanceFilter] = useState('today'); // 'today', 'week', 'month', 'all'
    const [transactions, setTransactions] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [specificMonth, setSpecificMonth] = useState('');


    useEffect(() => {
        const init = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: employee } = await supabase
                    .from('employees')
                    .select('id, role, name, position')
                    .eq('user_id', user.id)
                    .single();

                if (employee) {
                    setUserRole(employee.role);
                    setMyEmployeeId(employee.id);

                    // If not admin, auto-select self
                    if (employee.role !== 'admin') {
                        setSelectedEmployee(employee);
                    }
                }
            }
        };

        const fetchData = async () => {
            // Fetch completed/paid transactions with assignments AND vehicle model
            const { data: txs, error } = await supabase
                .from('transactions')
                .select(`
                    *,
                    transaction_assignments (employee_id),
                    customers (name),
                    services (name),
                    vehicles (brand, model, plate)
                `)
                .in('status', ['completed', 'paid'])
                .order('created_at', { ascending: false });

            if (txs) setTransactions(txs);

            // Fetch expenses
            const { data: exps } = await supabase
                .from('expenses')
                .select('*');

            if (exps) setExpenses(exps);
            setLoading(false);
        };

        init();
        fetchData();
    }, []);

    // --- Stats Logic (Reused & Adapted) ---
    const getFilteredData = () => {
        if (!selectedEmployee) return { filteredTxs: [], filteredExps: [] };

        // Determine Date Range Strings (YYYY-MM-DD)
        const now = new Date();
        let startStr = '';
        let endStr = '';

        if (performanceFilter === 'today') {
            startStr = getPRDateString(now);
            endStr = startStr;
        } else if (performanceFilter === 'week') {
            const day = now.getDay();
            const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
            const start = new Date(now);
            start.setDate(diff);
            const end = new Date(start);
            end.setDate(start.getDate() + 6);

            startStr = getPRDateString(start);
            endStr = getPRDateString(end);
        } else if (performanceFilter === 'month') {
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            startStr = getPRDateString(start);
            endStr = getPRDateString(end);
            endStr = getPRDateString(end);
        } else if (performanceFilter === 'specific_month' && specificMonth) {
            const [year, month] = specificMonth.split('-');
            const start = new Date(year, month, 1);
            const end = new Date(year, parseInt(month) + 1, 0);
            startStr = getPRDateString(start);
            endStr = getPRDateString(end);
        }

        const filteredTxs = transactions.filter(t => {
            // Check assignment
            const isAssigned = t.transaction_assignments?.some(a => a.employee_id === selectedEmployee.id);
            const isPrimary = t.employee_id === selectedEmployee.id;

            if (!(isAssigned || isPrimary)) return false;

            // Date Filter
            if (performanceFilter === 'all') return true;

            // Use string comparison
            // Ensure we compare YYYY-MM-DD only
            const tDateStr = getPRDateString(t.date || t.created_at);

            return tDateStr >= startStr && tDateStr <= endStr;
        });

        const filteredExps = expenses.filter(e => {
            if (e.employee_id !== selectedEmployee.id) return false;
            if (performanceFilter === 'all') return true;

            const eDateStr = getPRDateString(e.date || e.created_at);

            return eDateStr >= startStr && eDateStr <= endStr;
        });

        return { filteredTxs, filteredExps };
    };

    const calculateStats = () => {
        const { filteredTxs, filteredExps } = getFilteredData();

        let totalCommission = 0;
        let totalTips = 0;
        let fractionalCount = 0;

        filteredTxs.forEach(t => {
            const comm = (parseFloat(t.commission_amount) || 0);
            const tip = (parseFloat(t.tip) || 0);
            const count = (t.transaction_assignments?.length) || 1;

            totalCommission += (comm / count);
            totalTips += (tip / count);
            fractionalCount += (1 / count);
        });

        const totalExpenses = filteredExps.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
        const netTotal = (totalCommission + totalTips) - totalExpenses;

        return {
            count: filteredTxs.length,
            fractionalCount,
            commission: totalCommission,
            tips: totalTips,
            expenses: totalExpenses,
            net: netTotal,
            txs: filteredTxs
        };
    };

    const stats = selectedEmployee ? calculateStats() : null;

    if (loading) return <div style={{ padding: '2rem', color: 'white' }}>Cargando datos...</div>;

    // --- RENDER ---

    // ADMIN VIEW: List of Employees
    if (userRole === 'admin' && !selectedEmployee) {
        return (
            <div>
                <h1 style={{ fontSize: '1.875rem', marginBottom: '0.5rem' }}>Comisiones</h1>
                <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Selecciona un empleado para ver sus ganancias.</p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                    {employees.map((employee) => (
                        <div
                            key={employee.id}
                            className="card"
                            style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
                            onClick={() => setSelectedEmployee(employee)}
                            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div style={{
                                    width: '50px', height: '50px', borderRadius: '50%',
                                    backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    <DollarSign size={24} />
                                </div>
                                <div>
                                    <h3 style={{ fontWeight: 'bold' }}>{employee.name}</h3>
                                    <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{employee.position}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // EMPLOYEE / DETAIL VIEW
    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', marginBottom: '0.5rem' }}>
                        {userRole === 'admin' ? `Comisiones: ${selectedEmployee.name}` : 'Mis Comisiones'}
                    </h1>
                    <p style={{ color: 'var(--text-muted)' }}>
                        {new Date().toLocaleDateString()}
                    </p>
                </div>
                {userRole === 'admin' && (
                    <button
                        onClick={() => setSelectedEmployee(null)}
                        className="btn"
                        style={{ backgroundColor: 'var(--bg-secondary)', color: 'white' }}
                    >
                        <X size={20} /> Volver
                    </button>
                )}
            </div>

            {/* Filters */}
            <div style={{ marginBottom: '2rem', display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                {['today', 'week', 'month', 'all'].map(filter => (
                    <button
                        key={filter}
                        onClick={() => setPerformanceFilter(filter)}
                        style={{
                            padding: '0.5rem 1.5rem',
                            borderRadius: '2rem',
                            border: '1px solid var(--primary)',
                            backgroundColor: performanceFilter === filter ? 'var(--primary)' : 'transparent',
                            color: performanceFilter === filter ? 'white' : 'var(--primary)',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            fontWeight: 'bold'
                        }}
                    >
                        {filter === 'today' && 'Hoy'}
                        {filter === 'week' && 'Esta Semana'}
                        {filter === 'month' && 'Este Mes'}
                        {filter === 'all' && 'Todo'}
                    </button>
                ))}
            </div>
            {/* Specific Month Selector */}
            <div style={{ marginBottom: '2rem' }}>
                <select
                    className="input"
                    onChange={(e) => {
                        setSpecificMonth(e.target.value);
                        setPerformanceFilter('specific_month');
                    }}
                    value={specificMonth}
                    style={{
                        padding: '0.5rem',
                        borderRadius: '0.5rem',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-secondary)',
                        color: 'white',
                        width: '100%',
                        maxWidth: '300px'
                    }}
                >
                    <option value="" disabled>Seleccionar Mes Anterior...</option>
                    {Array.from({ length: 12 }).map((_, i) => {
                        const d = new Date();
                        d.setDate(1);
                        d.setMonth(d.getMonth() - (i + 1));
                        const value = `${d.getFullYear()}-${d.getMonth()}`;
                        const label = d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
                        return (
                            <option key={value} value={value}>
                                {label.charAt(0).toUpperCase() + label.slice(1)}
                            </option>
                        );
                    })}
                </select>
            </div>

            {/* Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                <div className="card" style={{ textAlign: 'center' }}>
                    <div style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Autos Lavados</div>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{formatToFraction(stats.fractionalCount)}</div>
                </div>
                <div className="card" style={{ textAlign: 'center' }}>
                    <div style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Comisiones</div>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--success)' }}>${stats.commission.toFixed(2)}</div>
                </div>
                <div className="card" style={{ textAlign: 'center' }}>
                    <div style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Propinas</div>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--warning)' }}>${stats.tips.toFixed(2)}</div>
                </div>
                <div className="card" style={{ textAlign: 'center', border: '1px solid var(--success)', backgroundColor: 'rgba(16, 185, 129, 0.05)' }}>
                    <div style={{ color: 'var(--success)', marginBottom: '0.5rem', fontWeight: 'bold' }}>TOTAL NETO</div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--success)' }}>${stats.net.toFixed(2)}</div>
                    {stats.expenses > 0 && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--danger)' }}>
                            (Menos ${stats.expenses.toFixed(2)} en gastos)
                        </div>
                    )}
                </div>
            </div>

            {/* History List */}
            <div className="card">
                <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                    Historial de Servicios ({formatToFraction(stats.fractionalCount)})
                </h3>
                {stats.txs.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No hay registros en este periodo.</p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {stats.txs.map(t => (
                            <div key={t.id} style={{
                                padding: '1rem',
                                backgroundColor: 'var(--bg-secondary)',
                                borderRadius: '0.5rem',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                gap: '1rem'
                            }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                        <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{t.customers?.name || 'Cliente Casual'}</span>
                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                            {new Date(t.date || t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <div style={{ color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                                        🚗 {(() => {
                                            if (!t.vehicles) return 'Modelo No Registrado';
                                            const brand = t.vehicles.brand === 'Generico' ? '' : t.vehicles.brand;
                                            return `${brand || ''} ${t.vehicles.model || ''}`.trim() || 'Modelo No Registrado';
                                        })()}
                                        {/* Removed plate display as requested, or can keep it if user wants both. User said "instead of plate show name and vehicle". Name is already shown above. So just vehicle here. */}
                                    </div>
                                    <div style={{ fontSize: '0.9rem', color: 'var(--primary)' }}>
                                        {t.services?.name || 'Servicio'}
                                        {(t.transaction_assignments?.length || 1) > 1 && (
                                            <span style={{ marginLeft: '0.5rem', color: 'var(--warning)', fontWeight: 'bold', fontSize: '0.8rem' }}>
                                                (1/{t.transaction_assignments.length})
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div style={{ textAlign: 'right', minWidth: '100px' }}>
                                    <div style={{ color: 'var(--success)', fontWeight: 'bold', fontSize: '1.2rem' }}>
                                        +${((parseFloat(t.commission_amount) + parseFloat(t.tip)) / (t.transaction_assignments?.length || 1)).toFixed(2)}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                        (Comm: ${((parseFloat(t.commission_amount)) / (t.transaction_assignments?.length || 1)).toFixed(2)} + Tip: ${((parseFloat(t.tip)) / (t.transaction_assignments?.length || 1)).toFixed(2)})
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Commissions;
