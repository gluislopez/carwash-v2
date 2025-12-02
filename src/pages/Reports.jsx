import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Calendar, DollarSign, Car, Users, Filter } from 'lucide-react';
import useSupabase from '../hooks/useSupabase';

const Reports = () => {
    const [dateRange, setDateRange] = useState('week'); // 'today', 'week', 'month', 'custom'
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [myUserId, setMyUserId] = useState(null);
    const [myEmployeeId, setMyEmployeeId] = useState(null);
    const [userRole, setUserRole] = useState(null);

    // Fetch user info
    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setMyUserId(user.id);
                const { data: employee } = await supabase
                    .from('employees')
                    .select('*')
                    .eq('user_id', user.id)
                    .single();

                if (employee) {
                    setUserRole(employee.role);
                    setMyEmployeeId(employee.id);
                }
            }
        };
        getUser();
    }, []);

    // Fetch all transactions with assignments
    const { data: allTransactions, loading, data: customers, data: services, data: employees } = useSupabase('transactions', `
        *,
        transaction_assignments (
            employee_id
        )
    `);

    // Helper to get customers/services names (fetching them separately would be better but for now we rely on IDs or need to fetch them)
    // Actually useSupabase returns data for the table passed. We need multiple hooks or a way to fetch others.
    // Let's use separate hooks for auxiliary data to map names.
    const { data: customersList } = useSupabase('customers');
    const { data: servicesList } = useSupabase('services');
    const { data: employeesList } = useSupabase('employees');

    const getCustomerName = (id) => customersList.find(c => c.id === id)?.name || 'Cliente Casual';
    const getServiceName = (id) => servicesList.find(s => s.id === id)?.name || 'Servicio Desconocido';
    const getEmployeeName = (id) => employeesList.find(e => e.id === id)?.name || 'Desconocido';

    // Date Helpers
    const getPRDateString = (dateInput) => {
        if (!dateInput) return '';
        const date = new Date(dateInput);
        return date.toLocaleDateString('en-CA', { timeZone: 'America/Puerto_Rico' });
    };

    // Filter Logic
    const getFilteredTransactions = () => {
        if (!allTransactions) return [];

        const today = new Date();
        let start = new Date();
        let end = new Date();

        // Adjust dates based on range
        if (dateRange === 'today') {
            // Start and end are today
        } else if (dateRange === 'week') {
            const day = today.getDay();
            const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
            start.setDate(diff); // Monday
            end.setDate(start.getDate() + 6); // Sunday
        } else if (dateRange === 'month') {
            start = new Date(today.getFullYear(), today.getMonth(), 1);
            end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        } else if (dateRange === 'custom') {
            if (!startDate || !endDate) return [];
            start = new Date(startDate);
            end = new Date(endDate);
        }

        // Normalize strings for comparison
        const startStr = getPRDateString(start);
        const endStr = getPRDateString(end);

        return allTransactions.filter(t => {
            const tDateStr = getPRDateString(t.date);
            const dateInRange = tDateStr >= startStr && tDateStr <= endStr;

            if (!dateInRange) return false;

            // Role Filter: Admin sees all, Employee sees assigned
            if (userRole === 'admin') return true;

            const isAssigned = t.transaction_assignments?.some(a => a.employee_id === myEmployeeId);
            const isPrimary = t.employee_id === myEmployeeId;
            return isAssigned || isPrimary;
        });
    };

    const filteredTransactions = getFilteredTransactions();

    // Stats Calculation
    const totalCount = filteredTransactions.length;
    const totalIncome = filteredTransactions.reduce((sum, t) => sum + (parseFloat(t.total_price) || 0), 0);

    const totalCommissions = filteredTransactions.reduce((sum, t) => {
        const txTotalCommission = (parseFloat(t.commission_amount) || 0) + (parseFloat(t.tip_amount) || 0);
        const employeeCount = (t.transaction_assignments && t.transaction_assignments.length > 0)
            ? t.transaction_assignments.length
            : 1;

        // If Admin, show total commission generated. If Employee, show their share.
        if (userRole === 'admin') {
            return sum + txTotalCommission;
        } else {
            return sum + (txTotalCommission / employeeCount);
        }
    }, 0);

    // Breakdown Logic
    const getBreakdownData = () => {
        const groups = {};

        filteredTransactions.forEach(t => {
            const dateKey = getPRDateString(t.date); // Group by Day
            if (!groups[dateKey]) {
                groups[dateKey] = {
                    date: dateKey,
                    count: 0,
                    income: 0,
                    expenses: 0
                };
            }

            const txIncome = parseFloat(t.total_price) || 0;
            const txCommission = (parseFloat(t.commission_amount) || 0) + (parseFloat(t.tip_amount) || 0);

            groups[dateKey].count += 1;
            groups[dateKey].income += txIncome;
            groups[dateKey].expenses += txCommission;
        });

        // Convert to array and sort
        return Object.values(groups).sort((a, b) => new Date(b.date) - new Date(a.date));
    };

    const breakdownData = getBreakdownData();

    // Export Handlers
    const handleCopyToEmail = () => {
        // Create HTML Table for Email
        const htmlContent = `
            <div style="font-family: Arial, sans-serif; color: #333;">
                <h2 style="color: #2563eb;">Reporte CarWash</h2>
                <p><strong>Periodo:</strong> ${dateRange}</p>
                <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; max-width: 600px;">
                    <thead style="background-color: #f3f4f6;">
                        <tr>
                            <th style="text-align: left;">Fecha</th>
                            <th style="text-align: center;">Autos</th>
                            <th style="text-align: right; color: #10b981;">Ingreso</th>
                            <th style="text-align: right; color: #ef4444;">Gastos</th>
                            <th style="text-align: right;">Neto</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${breakdownData.map(row => {
            const net = row.income - row.expenses;
            return `
                                <tr>
                                    <td>${row.date}</td>
                                    <td style="text-align: center;">${row.count}</td>
                                    <td style="text-align: right;">$${row.income.toFixed(2)}</td>
                                    <td style="text-align: right;">$${row.expenses.toFixed(2)}</td>
                                    <td style="text-align: right; font-weight: bold;">$${net.toFixed(2)}</td>
                                </tr>
                            `;
        }).join('')}
                    </tbody>
                    <tfoot style="background-color: #f3f4f6; font-weight: bold;">
                        <tr>
                            <td>TOTALES</td>
                            <td style="text-align: center;">${totalCount}</td>
                            <td style="text-align: right; color: #10b981;">$${totalIncome.toFixed(2)}</td>
                            <td style="text-align: right; color: #ef4444;">$${totalCommissions.toFixed(2)}</td>
                            <td style="text-align: right;">$${(totalIncome - totalCommissions).toFixed(2)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;

        // Copy HTML to clipboard
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const plainText = `REPORTE CARWASH - ${dateRange}\nAutos: ${totalCount}\nNeto: $${(totalIncome - totalCommissions).toFixed(2)}`;
        const textBlob = new Blob([plainText], { type: 'text/plain' });

        const item = new ClipboardItem({
            'text/html': blob,
            'text/plain': textBlob
        });

        navigator.clipboard.write([item]).then(() => {
            alert("Tabla copiada con formato. ¡Pégala en tu email!");
        }).catch(err => {
            console.error('Error al copiar:', err);
            alert('Tu navegador no soporta copiado avanzado. Se copiará solo texto.');
            // Fallback to text
            navigator.clipboard.writeText(plainText);
        });
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="reports-container">
            <style>{`
                @media print {
                    .no-print { display: none !important; }
                    .card { box-shadow: none; border: 1px solid #ddd; }
                    body { background: white; color: black; }
                }
            `}</style>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', marginBottom: '0.5rem' }}>Reportes</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Historial y estadísticas</p>
                </div>
                <div className="no-print" style={{ display: 'flex', gap: '1rem' }}>
                    <button className="btn" onClick={handleCopyToEmail} style={{ backgroundColor: 'var(--bg-secondary)', color: 'white' }}>
                        Copiar para Email
                    </button>
                    <button className="btn btn-primary" onClick={handlePrint}>
                        Imprimir / PDF
                    </button>
                </div>
            </div>

            {/* FILTERS */}
            <div className="card no-print" style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Filter size={20} color="var(--text-muted)" />
                        <span style={{ fontWeight: 'bold' }}>Periodo:</span>
                    </div>
                    <select
                        className="input"
                        style={{ width: 'auto' }}
                        value={dateRange}
                        onChange={(e) => setDateRange(e.target.value)}
                    >
                        <option value="today">Hoy</option>
                        <option value="week">Esta Semana</option>
                        <option value="month">Este Mes</option>
                        <option value="custom">Personalizado</option>
                    </select>

                    {dateRange === 'custom' && (
                        <>
                            <input
                                type="date"
                                className="input"
                                style={{ width: 'auto' }}
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                            <span style={{ color: 'var(--text-muted)' }}>a</span>
                            <input
                                type="date"
                                className="input"
                                style={{ width: 'auto' }}
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </>
                    )}
                </div>
            </div>

            {/* STATS CARDS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                <div className="card">
                    <h3 className="label">Total Autos</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <Car size={32} className="text-primary" />
                        <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary)' }}>{totalCount}</p>
                    </div>
                </div>

                {userRole === 'admin' && (
                    <div className="card">
                        <h3 className="label">Ingresos Totales</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <DollarSign size={32} className="text-success" />
                            <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--success)' }}>${totalIncome.toFixed(2)}</p>
                        </div>
                    </div>
                )}

                <div className="card">
                    <h3 className="label">{userRole === 'admin' ? 'Gastos (Comisiones)' : 'Mis Ganancias'}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <Users size={32} className="text-warning" />
                        <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--warning)' }}>${totalCommissions.toFixed(2)}</p>
                    </div>
                </div>

                {userRole === 'admin' && (
                    <div className="card">
                        <h3 className="label">Ganancia Neta</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <DollarSign size={32} className="text-success" />
                            <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--success)' }}>${(totalIncome - totalCommissions).toFixed(2)}</p>
                        </div>
                    </div>
                )}
            </div>

            {/* FINANCIAL BREAKDOWN (DESGLOSE) */}
            {userRole === 'admin' && (
                <div className="card" style={{ marginBottom: '2rem' }}>
                    <h3 className="label" style={{ marginBottom: '1rem' }}>Desglose Financiero</h3>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                                    <th style={{ padding: '1rem' }}>Fecha</th>
                                    <th style={{ padding: '1rem' }}>Autos</th>
                                    <th style={{ padding: '1rem', color: 'var(--success)' }}>Ingresos (+)</th>
                                    <th style={{ padding: '1rem', color: 'var(--danger)' }}>Gastos (-)</th>
                                    <th style={{ padding: '1rem' }}>Neto (=)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {breakdownData.map(row => (
                                    <tr key={row.date} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '1rem' }}>{row.date}</td>
                                        <td style={{ padding: '1rem' }}>{row.count}</td>
                                        <td style={{ padding: '1rem', color: 'var(--success)' }}>${row.income.toFixed(2)}</td>
                                        <td style={{ padding: '1rem', color: 'var(--danger)' }}>${row.expenses.toFixed(2)}</td>
                                        <td style={{ padding: '1rem', fontWeight: 'bold' }}>${(row.income - row.expenses).toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* DETAILED TABLE */}
            <div className="card">
                <h3 className="label" style={{ marginBottom: '1rem' }}>Detalle de Operaciones</h3>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                                <th style={{ padding: '1rem' }}>Fecha</th>
                                <th style={{ padding: '1rem' }}>Cliente</th>
                                <th style={{ padding: '1rem' }}>Servicio</th>
                                <th style={{ padding: '1rem' }}>Empleados</th>
                                <th style={{ padding: '1rem' }}>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTransactions.map(t => (
                                <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <td style={{ padding: '1rem' }}>
                                        {new Date(t.date).toLocaleDateString('es-PR')} <br />
                                        <small style={{ color: 'var(--text-muted)' }}>
                                            {new Date(t.date).toLocaleTimeString('es-PR', { hour: '2-digit', minute: '2-digit' })}
                                        </small>
                                    </td>
                                    <td style={{ padding: '1rem' }}>{getCustomerName(t.customer_id)}</td>
                                    <td style={{ padding: '1rem' }}>
                                        {getServiceName(t.service_id)}
                                        {t.extras && t.extras.length > 0 && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>+ {t.extras.length} extras</span>}
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        {t.transaction_assignments && t.transaction_assignments.length > 0
                                            ? t.transaction_assignments.map(a => getEmployeeName(a.employee_id)).join(', ')
                                            : getEmployeeName(t.employee_id)
                                        }
                                    </td>
                                    <td style={{ padding: '1rem', fontWeight: 'bold' }}>${t.total_price.toFixed(2)}</td>
                                </tr>
                            ))}
                            {filteredTransactions.length === 0 && (
                                <tr>
                                    <td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        No hay datos para este periodo
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

export default Reports;
