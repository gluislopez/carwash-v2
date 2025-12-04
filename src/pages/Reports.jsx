import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Calendar, DollarSign, Car, Users, Filter, X, Download } from 'lucide-react';
import { generateReportPDF } from '../utils/pdfGenerator';
import useSupabase from '../hooks/useSupabase';

const Reports = () => {
    const [dateRange, setDateRange] = useState('week'); // 'today', 'week', 'month', 'custom'
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [myUserId, setMyUserId] = useState(null);
    const [myEmployeeId, setMyEmployeeId] = useState(null);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
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

    const { data: expenses } = useSupabase('expenses');

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

    const getPaymentMethodLabel = (method) => {
        switch (method) {
            case 'cash': return 'Efectivo';
            case 'card': return 'Tarjeta';
            case 'transfer': return 'Ath Móvil';
            default: return 'Otro';
        }
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

    const getFilteredExpenses = () => {
        if (!expenses) return [];

        const today = new Date();
        let start = new Date();
        let end = new Date();

        // Adjust dates based on range (Same logic as transactions)
        if (dateRange === 'today') {
        } else if (dateRange === 'week') {
            const day = today.getDay();
            const diff = today.getDate() - day + (day === 0 ? -6 : 1);
            start.setDate(diff);
            end.setDate(start.getDate() + 6);
        } else if (dateRange === 'month') {
            start = new Date(today.getFullYear(), today.getMonth(), 1);
            end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        } else if (dateRange === 'custom') {
            if (!startDate || !endDate) return [];
            start = new Date(startDate);
            end = new Date(endDate);
        }

        const startStr = getPRDateString(start);
        const endStr = getPRDateString(end);

        return expenses.filter(e => {
            const eDateStr = getPRDateString(e.date);
            const dateInRange = eDateStr >= startStr && eDateStr <= endStr;
            if (!dateInRange) return false;

            // Role Filter for Expenses
            if (userRole === 'admin') return true; // Admin sees all expenses
            // Employee sees only their lunches
            return e.category === 'lunch' && e.employee_id === myEmployeeId;
        });
    };

    const filteredTransactions = getFilteredTransactions().sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        if (dateB - dateA !== 0) return dateB - dateA;
        return new Date(b.created_at) - new Date(a.created_at);
    });
    const filteredExpenses = getFilteredExpenses();

    // Stats Calculation
    const totalCount = filteredTransactions.length;
    const totalIncome = filteredTransactions.reduce((sum, t) => sum + (parseFloat(t.total_price) || 0), 0);

    const totalCommissions = filteredTransactions.reduce((sum, t) => {
        const txTotalCommission = (parseFloat(t.commission_amount) || 0) + (parseFloat(t.tip) || 0);
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

    // Calculate Lunches/Expenses
    const totalLunches = filteredExpenses
        .filter(e => e.category === 'lunch')
        .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

    // For Admin, also calculate Product Expenses
    const totalProductExpenses = filteredExpenses
        .filter(e => e.category === 'product')
        .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

    // Net Calculations
    // Admin Net = Income - (Commissions + Lunches + Products)
    // Employee Net = My Commissions - My Lunches
    const netCommissions = totalCommissions - totalLunches;
    const adminNet = totalIncome - totalCommissions - totalProductExpenses; // Note: Lunches are paid from commissions, so they don't reduce business income further? 
    // Wait, if the business pays for lunch upfront and deducts it, then:
    // Business Cash Flow: +Income - CommissionPaid.
    // CommissionPaid = (GrossCommission - LunchCost).
    // So Business Expense is actually GrossCommission. The fact that part of it was paid as lunch is irrelevant to the business bottom line, 
    // UNLESS the business paid for the lunch from its own cash.
    // Let's assume Business Paid Lunch.
    // So Business Cash Out = CommissionPaid (Cash) + LunchPaid (Cash).
    // Total Cost to Business = Gross Commission.
    // So Admin Net = Income - Gross Commissions - Product Expenses.
    // The lunch deduction is internal to the employee's payout.

    // Breakdown Logic
    const getBreakdownData = () => {
        const groups = {};

        // 1. Add Transactions
        filteredTransactions.forEach(t => {
            const dateKey = getPRDateString(t.date);
            if (!groups[dateKey]) {
                groups[dateKey] = { date: dateKey, count: 0, income: 0, expenses: 0 };
            }

            const txIncome = parseFloat(t.total_price) || 0;
            const txCommission = (parseFloat(t.commission_amount) || 0) + (parseFloat(t.tip) || 0);

            groups[dateKey].count += 1;
            groups[dateKey].income += txIncome;
            groups[dateKey].expenses += txCommission;
        });

        // 2. Add Expenses (Products) to breakdown?
        // User asked for "Gastos" column. Usually this means Commissions + Business Expenses.
        // Let's add Product Expenses to the "Gastos" column for that day.
        if (userRole === 'admin') {
            filteredExpenses.forEach(e => {
                if (e.category === 'product') {
                    const dateKey = getPRDateString(e.date);
                    if (!groups[dateKey]) {
                        groups[dateKey] = { date: dateKey, count: 0, income: 0, expenses: 0 };
                    }
                    groups[dateKey].expenses += (parseFloat(e.amount) || 0);
                }
            });
        }

        // Convert to array and sort
        return Object.values(groups).sort((a, b) => new Date(b.date) - new Date(a.date));
    };

    const breakdownData = getBreakdownData();

    // Export Handlers
    const handleCopyToEmail = () => {
        // Create HTML Table for Email
        // Note: Images in email often need to be hosted publicly. 
        // For now we will use the text header, but if they have a public URL we could use it.
        // We will add a nice header block.
        const htmlContent = `
            <div style="font-family: Arial, sans-serif; color: #333; max-width: 800px; margin: 0 auto;">
                <div style="text-align: center; padding: 20px; border-bottom: 2px solid #2563eb; margin-bottom: 20px;">
                    <h1 style="margin: 0; color: #1e40af; font-size: 24px;">CARWASH SAAS</h1>
                    <p style="margin: 5px 0; color: #6b7280;">Reporte de Operaciones</p>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <p><strong>Periodo:</strong> ${dateRange}</p>
                    <p><strong>Generado:</strong> ${new Date().toLocaleDateString('es-PR')}</p>
                </div>

                <table border="1" cellpadding="12" cellspacing="0" style="border-collapse: collapse; width: 100%; border: 1px solid #e5e7eb;">
                    <thead style="background-color: #f8fafc;">
                        <tr>
                            <th style="text-align: left; border: 1px solid #e5e7eb; padding: 12px;">Fecha</th>
                            <th style="text-align: center; border: 1px solid #e5e7eb; padding: 12px;">Autos</th>
                            <th style="text-align: right; color: #10b981; border: 1px solid #e5e7eb; padding: 12px;">Ingreso</th>
                            <th style="text-align: right; color: #ef4444; border: 1px solid #e5e7eb; padding: 12px;">Gastos</th>
                            <th style="text-align: right; border: 1px solid #e5e7eb; padding: 12px;">Neto</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${breakdownData.map(row => {
            const net = row.income - row.expenses;
            return `
                                <tr>
                                    <td style="border: 1px solid #e5e7eb; padding: 12px;">${row.date}</td>
                                    <td style="text-align: center; border: 1px solid #e5e7eb; padding: 12px;">${row.count}</td>
                                    <td style="text-align: right; border: 1px solid #e5e7eb; padding: 12px;">$${row.income.toFixed(2)}</td>
                                    <td style="text-align: right; border: 1px solid #e5e7eb; padding: 12px;">$${row.expenses.toFixed(2)}</td>
                                    <td style="text-align: right; font-weight: bold; border: 1px solid #e5e7eb; padding: 12px;">$${net.toFixed(2)}</td>
                                </tr>
                            `;
        }).join('')}
                    </tbody>
                    <tfoot style="background-color: #f8fafc; font-weight: bold;">
                        <tr>
                            <td style="border: 1px solid #e5e7eb; padding: 12px;">TOTALES</td>
                            <td style="text-align: center; border: 1px solid #e5e7eb; padding: 12px;">${totalCount}</td>
                            <td style="text-align: right; color: #10b981; border: 1px solid #e5e7eb; padding: 12px;">$${totalIncome.toFixed(2)}</td>
                            <td style="text-align: right; color: #ef4444; border: 1px solid #e5e7eb; padding: 12px;">$${totalCommissions.toFixed(2)}</td>
                            <td style="text-align: right; border: 1px solid #e5e7eb; padding: 12px;">$${(totalIncome - totalCommissions).toFixed(2)}</td>
                        </tr>
                    </tfoot>
                </table>
                
                <div style="margin-top: 30px; text-align: center; font-size: 12px; color: #9ca3af;">
                    <p>Generado automáticamente por CarWash SaaS</p>
                </div>
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
                    .card { box-shadow: none; border: 1px solid #ddd; page-break-inside: avoid; }
                    body { background: white; color: black; }
                    .print-header { display: block !important; margin-bottom: 2rem; text-align: center; }
                    /* Hide other cards if we only want the table, but user asked for "report". 
                       Usually we keep the summary cards. */
                }
                .print-header { display: none; }
            `}</style>

            {/* PRINT HEADER (Logo & Title) */}
            <div className="print-header">
                <img src="/logo.jpg" alt="CarWash Logo" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', marginBottom: '1rem' }} />
                <h1 style={{ fontSize: '2rem', margin: 0 }}>Express CarWash</h1>
                <p style={{ color: '#666' }}>Reporte de Operaciones: {dateRange}</p>
            </div>

            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', marginBottom: '0.5rem' }}>Reportes</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Análisis financiero y operativo <span style={{ fontSize: '0.7rem', backgroundColor: '#EF4444', color: 'white', padding: '2px 4px', borderRadius: '4px' }}>v4.122 PDF FIX</span></p>
                </div>

                <button
                    onClick={() => {
                        try {
                            const stats = {
                                count: totalCount,
                                income: totalIncome,
                                expenses: totalCommissions + totalProductExpenses,
                                net: adminNet
                            };
                            // Map service IDs to names for the PDF
                            const enrichedTransactions = filteredTransactions.map(t => ({
                                ...t,
                                service_id: getServiceName(t.service_id)
                            }));
                            generateReportPDF(enrichedTransactions, dateRange, stats, userRole);
                        } catch (error) {
                            console.error("PDF Error:", error);
                            alert("Error al generar PDF: " + error.message);
                        }
                    }}
                    className="btn btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                    <Download size={20} />
                    Descargar PDF
                </button>
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
                    <h3 className="label">{userRole === 'admin' ? 'Gastos (Comisiones + Compras)' : 'Mi Neto (Menos Almuerzos)'}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <Users size={32} className="text-warning" />
                        <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--warning)' }}>
                            ${userRole === 'admin' ? (totalCommissions + totalProductExpenses).toFixed(2) : netCommissions.toFixed(2)}
                        </p>
                    </div>
                    {userRole !== 'admin' && totalLunches > 0 && (
                        <p style={{ fontSize: '0.9rem', color: 'var(--danger)', marginTop: '0.5rem' }}>
                            -${totalLunches.toFixed(2)} en almuerzos
                        </p>
                    )}
                </div>

                {userRole === 'admin' && (
                    <div className="card">
                        <h3 className="label">Ganancia Neta</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <DollarSign size={32} className="text-success" />
                            <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--success)' }}>${adminNet.toFixed(2)}</p>
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
                                <th style={{ padding: '1rem' }}>Método</th>
                                <th style={{ padding: '1rem' }}>{userRole === 'admin' ? 'Total Venta' : 'Mi Comisión'}</th>
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
                                    <td style={{ padding: '1rem' }}>
                                        {userRole === 'admin' ? (
                                            <button
                                                onClick={() => {
                                                    const cust = customersList.find(c => c.id === t.customer_id);
                                                    if (cust) setSelectedCustomer(cust);
                                                }}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    color: 'var(--primary)',
                                                    textDecoration: 'underline',
                                                    cursor: 'pointer',
                                                    fontWeight: 'bold',
                                                    fontSize: 'inherit'
                                                }}
                                            >
                                                {getCustomerName(t.customer_id)}
                                            </button>
                                        ) : (
                                            getCustomerName(t.customer_id)
                                        )}
                                    </td>
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
                                    <td style={{ padding: '1rem' }}>
                                        <span style={{
                                            fontSize: '0.75rem',
                                            padding: '0.1rem 0.4rem',
                                            borderRadius: '4px',
                                            backgroundColor: t.payment_method === 'cash' ? 'rgba(16, 185, 129, 0.2)' : t.payment_method === 'card' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                                            color: t.payment_method === 'cash' ? '#10B981' : t.payment_method === 'card' ? '#3B82F6' : '#F59E0B',
                                            border: `1px solid ${t.payment_method === 'cash' ? '#10B981' : t.payment_method === 'card' ? '#3B82F6' : '#F59E0B'}`
                                        }}>
                                            {getPaymentMethodLabel(t.payment_method)}
                                        </span>
                                    </td>
                                    <td style={{ padding: '1rem', fontWeight: 'bold' }}>
                                        {userRole === 'admin' ? (
                                            `$${t.total_price.toFixed(2)}`
                                        ) : (
                                            (() => {
                                                const txTotalCommission = (parseFloat(t.commission_amount) || 0) + (parseFloat(t.tip) || 0);
                                                const count = (t.transaction_assignments?.length) || 1;
                                                return `$${(txTotalCommission / count).toFixed(2)}`;
                                            })()
                                        )}
                                    </td>
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


            {/* CUSTOMER DETAILS MODAL */}
            {
                selectedCustomer && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 3000,
                        display: 'flex', justifyContent: 'center', alignItems: 'center'
                    }}>
                        <div className="card" style={{ width: '90%', maxWidth: '400px', position: 'relative' }}>
                            <button
                                onClick={() => setSelectedCustomer(null)}
                                style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                            >
                                <X size={24} />
                            </button>

                            <h2 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                                Detalles del Cliente
                            </h2>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div>
                                    <label className="label">Nombre</label>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{selectedCustomer.name}</div>
                                </div>

                                <div>
                                    <label className="label">Teléfono</label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span style={{ fontSize: '1.1rem' }}>{selectedCustomer.phone || 'No registrado'}</span>
                                        {selectedCustomer.phone && (
                                            <a href={`tel:${selectedCustomer.phone}`} style={{ color: 'var(--primary)', textDecoration: 'none', fontSize: '0.9rem' }}>
                                                (Llamar)
                                            </a>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <label className="label">Email</label>
                                    <div>{selectedCustomer.email || 'No registrado'}</div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <label className="label">Modelo</label>
                                        <div>{selectedCustomer.vehicle_model || 'N/A'}</div>
                                    </div>
                                    <div>
                                        <label className="label">Placa</label>
                                        <div style={{ fontFamily: 'monospace', backgroundColor: 'var(--bg-secondary)', padding: '0.2rem 0.5rem', borderRadius: '4px', display: 'inline-block' }}>
                                            {selectedCustomer.vehicle_plate || 'N/A'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => setSelectedCustomer(null)}
                                className="btn btn-primary"
                                style={{ width: '100%', marginTop: '2rem' }}
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default Reports;
