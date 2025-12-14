import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Calendar, DollarSign, Car, Users, Filter, X, Download, Clock, RefreshCw } from 'lucide-react';
import { getEmployeeName, getServiceName, getCustomerName, getVehicleInfo } from '../utils/relationshipHelpers';
import { formatDuration } from '../utils/formatUtils';
import { formatToFraction } from '../utils/fractionUtils';
import autoTable from 'jspdf-autotable';
import useSupabase from '../hooks/useSupabase';

const Reports = () => {
    const [dateRange, setDateRange] = useState('week'); // 'today', 'week', 'month', 'custom'
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [myUserId, setMyUserId] = useState(null);
    const [myEmployeeId, setMyEmployeeId] = useState(null);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [userRole, setUserRole] = useState(null);
    const [paymentMethodFilter, setPaymentMethodFilter] = useState('all'); // 'all', 'cash', 'transfer'
    const [editingTransactionId, setEditingTransactionId] = useState(null);
    const [activeModal, setActiveModal] = useState(null); // 'commissions', 'expenses'

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
    const { data: allTransactions, loading, update: updateTransaction } = useSupabase('transactions', '*, transaction_assignments(*)');

    const { data: expenses } = useSupabase('expenses');

    // Fetch Daily Notes
    const { data: allNotes } = useSupabase('daily_notes');


    // Helper to get customers/services names (fetching them separately would be better but for now we rely on IDs or need to fetch them)
    // Actually useSupabase returns data for the table passed. We need multiple hooks or a way to fetch others.
    // Let's use separate hooks for auxiliary data to map names.
    const { data: customersList } = useSupabase('customers');
    const { data: servicesList } = useSupabase('services');
    const { data: employeesList } = useSupabase('employees');
    const { data: vehiclesList } = useSupabase('vehicles');

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

            if (dateRange === 'today') {
                if (tDateStr !== startStr) return false;
            } else {
                if (tDateStr < startStr || tDateStr > endStr) return false;
            }

            // Payment Method Filter
            if (paymentMethodFilter !== 'all' && t.payment_method !== paymentMethodFilter) {
                return false;
            }

            // Role Filter: Admin sees all, Employee sees assigned
            if (userRole === 'admin') return true;

            const isAssigned = t.transaction_assignments?.some(a => a.employee_id === myEmployeeId);
            const isPrimary = t.employee_id === myEmployeeId;
            return isAssigned || isPrimary;
        });
    };



    // Calculate totals based on DATE FILTER ONLY (to show in buttons)
    const getDateFilteredTransactions = () => {
        if (!allTransactions) return [];
        const today = new Date();
        let start = new Date();
        let end = new Date();

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

        return allTransactions.filter(t => {
            const tDateStr = getPRDateString(t.date);
            if (dateRange === 'today') return tDateStr === startStr;
            return tDateStr >= startStr && tDateStr <= endStr;
        });
    };

    const dateFilteredTxs = getDateFilteredTransactions();
    const totalCash = dateFilteredTxs
        .filter(t => t.payment_method === 'cash')
        .reduce((sum, t) => sum + (parseFloat(t.price) || 0) + (parseFloat(t.tip) || 0), 0);

    const totalTransfer = dateFilteredTxs
        .filter(t => t.payment_method === 'transfer')
        .reduce((sum, t) => sum + (parseFloat(t.price) || 0) + (parseFloat(t.tip) || 0), 0);

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
    const totalCount = filteredTransactions.length; // Raw count for some uses if needed

    const fractionalCount = filteredTransactions.reduce((sum, t) => {
        const count = t.transaction_assignments?.length || 1;
        return sum + (1 / count);
    }, 0);

    const totalIncome = filteredTransactions.reduce((sum, t) => sum + (parseFloat(t.price) || 0) + (parseFloat(t.tip) || 0), 0);

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

    const netIncome = totalIncome - totalCommissions - totalLunches;

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
                groups[dateKey] = { date: dateKey, count: 0, income: 0, commissions: 0, productExpenses: 0 };
            }

            const txIncome = (parseFloat(t.price) || 0) + (parseFloat(t.tip) || 0); // User requested Tips included in Income
            const txCommission = (parseFloat(t.commission_amount) || 0) + (parseFloat(t.tip) || 0);

            groups[dateKey].count += 1;
            groups[dateKey].income += txIncome;
            groups[dateKey].commissions += txCommission;
        });

        // 2. Add Expenses (Products AND Lunches) to breakdown
        if (userRole === 'admin') {
            filteredExpenses.forEach(e => {
                const dateKey = getPRDateString(e.date);
                if (!groups[dateKey]) {
                    groups[dateKey] = { date: dateKey, count: 0, income: 0, commissions: 0, productExpenses: 0 };
                }

                if (e.category === 'product') {
                    groups[dateKey].productExpenses += (parseFloat(e.amount) || 0);
                } else if (e.category === 'lunch') {
                    // Shift Lunch from Commission (Labor Cost) to Expense (Vendor Cost)
                    // This shows "Net Payout" in Commission column
                    const amount = parseFloat(e.amount) || 0;
                    groups[dateKey].commissions -= amount;
                    groups[dateKey].productExpenses += amount;
                }
            });
        }

        // Convert to array and sort
        return Object.values(groups).sort((a, b) => new Date(b.date) - new Date(a.date));
    };

    const breakdownData = getBreakdownData();

    // Handlers
    const handlePaymentMethodUpdate = async (transactionId, newMethod) => {
        if (!updateTransaction) return;
        try {
            await updateTransaction(transactionId, { payment_method: newMethod });
            setEditingTransactionId(null);
        } catch (error) {
            console.error('Error updating payment method:', error);
            alert('Error al actualizar método de pago');
        }
    };

    // Export Handlers
    const handleCopyToEmail = () => {
        // Create HTML Table for Email
        // Note: Images in email often need to be hosted publicly. 
        // For now we will use the text header, but if they have a public URL we could use it.
        // We will add a nice header block.

        // Get notes for the period
        const periodNotes = allNotes ? allNotes.filter(n => {
            const nDateStr = getPRDateString(n.date);
            // Reuse filter logic logic if possible or just filter by range
            // We need filteredTransactions logic access
            if (dateRange === 'today') return nDateStr === getPRDateString(new Date());
            // For simplicity in this block we can approximate or duplicate logic:
            // Let's assume startDate/endDate are set for custom, or calculate based on dateRange.
            // Actually, `getFilteredTransactions` logic is local.
            // Better to calculate range first.
            // But for now let's just show ALL notes if range is custom or today.
            return true; // Simplify for now, or improve logic
        }).filter(n => {
            // Apply strict filter
            const nDateStr = getPRDateString(n.date);
            const today = new Date();
            let start = new Date();
            let end = new Date();

            if (dateRange === 'today') {
                return nDateStr === getPRDateString(today);
            } else if (dateRange === 'week') {
                const day = today.getDay();
                const diff = today.getDate() - day + (day === 0 ? -6 : 1);
                start.setDate(diff);
                end.setDate(start.getDate() + 6);
            } else if (dateRange === 'month') {
                start = new Date(today.getFullYear(), today.getMonth(), 1);
                end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            } else if (dateRange === 'custom') {
                if (!startDate || !endDate) return false;
                start = new Date(startDate);
                end = new Date(endDate);
            }
            return nDateStr >= getPRDateString(start) && nDateStr <= getPRDateString(end);
        }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) : [];

        const notesHtml = periodNotes.length > 0 ? `
            <div style="margin-top: 20px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
                <h3 style="color: #1e40af; margin-bottom: 10px;">📝 Bitácora / Notas</h3>
                <ul style="list-style: none; padding: 0;">
                    ${periodNotes.map(n => `
                        <li style="margin-bottom: 8px; padding: 8px; background: #f3f4f6; border-radius: 4px;">
                            <strong style="color: #4b5563;">${new Date(n.date).toLocaleDateString()}:</strong> ${n.content}
                        </li>
                    `).join('')}
                </ul>
            </div>
        ` : '';

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
                            <th style="text-align: right; color: #F59E0B; border: 1px solid #e5e7eb; padding: 12px;">Comisiones</th>
                            <th style="text-align: right; color: #ef4444; border: 1px solid #e5e7eb; padding: 12px;">Compras</th>
                            <th style="text-align: right; border: 1px solid #e5e7eb; padding: 12px;">Neto</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${breakdownData.map(row => {
            const net = row.income - row.commissions - row.productExpenses;
            return `
                                <tr>
                                    <td style="border: 1px solid #e5e7eb; padding: 12px;">${row.date}</td>
                                    <td style="text-align: center; border: 1px solid #e5e7eb; padding: 12px;">${row.count}</td>
                                    <td style="text-align: right; border: 1px solid #e5e7eb; padding: 12px;">$${row.income.toFixed(2)}</td>
                                    <td style="text-align: right; border: 1px solid #e5e7eb; padding: 12px;">$${row.commissions.toFixed(2)}</td>
                                    <td style="text-align: right; border: 1px solid #e5e7eb; padding: 12px;">$${row.productExpenses.toFixed(2)}</td>
                                    <td style="text-align: right; font-weight: bold; border: 1px solid #e5e7eb; padding: 12px;">$${net.toFixed(2)}</td>
                                </tr>
                            `;
        }).join('')}
                    </tbody>
                    <tfoot style="background-color: #f8fafc; font-weight: bold;">
                        <tr>
                            <td style={{ border: '1px solid #e5e7eb', padding: '12px' }}>TOTALES</td>
                            <td style={{ textAlign: 'center', border: '1px solid #e5e7eb', padding: '12px' }}>
                                ${userRole === 'admin' ? totalCount : formatToFraction(fractionalCount)}
                            </td>
                            <td style={{ textAlign: 'right', color: '#10b981', border: '1px solid #e5e7eb', padding: '12px' }}>$${totalIncome.toFixed(2)}</td>
                            <td style="text-align: right; color: #F59E0B; border: 1px solid #e5e7eb; padding: 12px;">$${(totalCommissions - totalLunches).toFixed(2)}</td>
                            <td style="text-align: right; color: #ef4444; border: 1px solid #e5e7eb; padding: 12px;">$${(totalProductExpenses + totalLunches).toFixed(2)}</td>
                            <td style="text-align: right; border: 1px solid #e5e7eb; padding: 12px;">$${(totalIncome - totalCommissions - totalProductExpenses).toFixed(2)}</td>
                        </tr>
                    </tfoot>
                </table>
                
                ${notesHtml}

                <div style="margin-top: 30px; text-align: center; font-size: 12px; color: #9ca3af;">
                    <p>Generado automáticamente por CarWash SaaS</p>
                </div>
            </div>
        `;

        // Copy HTML to clipboard
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const countDisplay = userRole === 'admin' ? totalCount : formatToFraction(fractionalCount);
        const plainText = `REPORTE CARWASH - ${dateRange}\nAutos: ${countDisplay}\nNeto: $${(totalIncome - totalCommissions - totalProductExpenses).toFixed(2)}`;
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
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', marginBottom: '0.5rem' }}>Reportes y Finanzas</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Resumen de operaciones</p>
                </div>
            </div>

            {/* DATE FILTERS */}
            <div style={{ marginBottom: '2rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                    className="btn"
                    style={{ backgroundColor: dateRange === 'today' ? 'var(--primary)' : 'var(--bg-secondary)', color: 'white' }}
                    onClick={() => setDateRange('today')}
                >
                    Hoy
                </button>
                <button
                    className="btn"
                    style={{ backgroundColor: dateRange === 'week' ? 'var(--primary)' : 'var(--bg-secondary)', color: 'white' }}
                    onClick={() => setDateRange('week')}
                >
                    Esta Semana
                </button>
                <button
                    className="btn"
                    style={{ backgroundColor: dateRange === 'month' ? 'var(--primary)' : 'var(--bg-secondary)', color: 'white' }}
                    onClick={() => setDateRange('month')}
                >
                    Este Mes
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto' }}>
                    <input
                        type="date"
                        className="input"
                        value={startDate}
                        onChange={(e) => { setStartDate(e.target.value); setDateRange('custom'); }}
                        style={{ padding: '0.5rem' }}
                    />
                    <span style={{ color: 'var(--text-muted)' }}>-</span>
                    <input
                        type="date"
                        className="input"
                        value={endDate}
                        onChange={(e) => { setEndDate(e.target.value); setDateRange('custom'); }}
                        style={{ padding: '0.5rem' }}
                    />
                </div>
            </div>

            {userRole === 'admin' && (
                <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '1rem' }}>
                    <button
                        onClick={() => setPaymentMethodFilter(paymentMethodFilter === 'transfer' ? 'all' : 'transfer')}
                        title={paymentMethodFilter === 'transfer' ? "Mostrar Todos" : "Filtrar solo ATH Móvil"}
                        style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center',
                            padding: '0.3rem 0.8rem',
                            border: '1px solid #F59E0B',
                            borderRadius: '6px',
                            backgroundColor: paymentMethodFilter === 'transfer' ? '#F59E0B' : 'transparent',
                            color: paymentMethodFilter === 'transfer' ? 'white' : '#F59E0B',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        <span style={{ fontSize: '0.7rem', fontWeight: 'bold' }}>ATH MÓVIL</span>
                        <span style={{ fontSize: '0.9rem' }}>${totalTransfer.toFixed(2)}</span>
                    </button>

                    <button
                        onClick={() => setPaymentMethodFilter(paymentMethodFilter === 'cash' ? 'all' : 'cash')}
                        title={paymentMethodFilter === 'cash' ? "Mostrar Todos" : "Filtrar solo Efectivo"}
                        style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center',
                            padding: '0.3rem 0.8rem',
                            border: '1px solid #10B981',
                            borderRadius: '6px',
                            backgroundColor: paymentMethodFilter === 'cash' ? '#10B981' : 'transparent',
                            color: paymentMethodFilter === 'cash' ? 'white' : '#10B981',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        <span style={{ fontSize: '0.7rem', fontWeight: 'bold' }}>EFECTIVO</span>
                        <span style={{ fontSize: '0.9rem' }}>${totalCash.toFixed(2)}</span>
                    </button>
                </div>
            )}



            {/* STATS CARDS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                <div className="card">
                    <h3 className="label">Total Autos</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <Car size={32} className="text-primary" />
                        <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                            {userRole === 'admin' ? totalCount : formatToFraction(fractionalCount)}
                        </p>
                    </div>
                </div>

                {
                    userRole === 'admin' && (
                        <div
                            className="card"
                            onClick={() => setActiveModal('income')}
                            style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
                            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                        >
                            <h3 className="label">Ingresos Totales</h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <DollarSign size={32} className="text-success" />
                                <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--success)' }}>${totalIncome.toFixed(2)}</p>
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem', textAlign: 'right' }}>
                                Ver detalle &rarr;
                            </div>
                        </div>
                    )
                }

                {userRole === 'admin' ? (
                    <>
                        <div
                            className="card"
                            onClick={() => setActiveModal('commissions')}
                            style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
                            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                        >
                            <h3 className="label">Comisiones (Nómina)</h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <Users size={32} className="text-warning" />
                                <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--warning)' }}>
                                    ${(totalCommissions - totalLunches).toFixed(2)}
                                </p>
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem', textAlign: 'right' }}>
                                Ver detalle &rarr;
                            </div>
                        </div>
                        <div
                            className="card"
                            onClick={() => setActiveModal('expenses')}
                            style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
                            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                        >
                            <h3 className="label">Gastos / Compras</h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <DollarSign size={32} className="text-danger" />
                                <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--danger)' }}>
                                    ${(totalProductExpenses + totalLunches).toFixed(2)}
                                </p>
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem', textAlign: 'right' }}>
                                Ver detalle &rarr;
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="card">
                        <h3 className="label">Mi Neto (Menos Almuerzos)</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <Users size={32} className="text-warning" />
                            <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--warning)' }}>
                                ${netCommissions.toFixed(2)}
                            </p>
                        </div>
                        {totalLunches > 0 && (
                            <p style={{ fontSize: '0.9rem', color: 'var(--danger)', marginTop: '0.5rem' }}>
                                -${totalLunches.toFixed(2)} en almuerzos
                            </p>
                        )}
                    </div>
                )}

                {
                    userRole === 'admin' && (
                        <div className="card">
                            <h3 className="label">Ganancia Neta</h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <DollarSign size={32} className="text-success" />
                                <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--success)' }}>${adminNet.toFixed(2)}</p>
                            </div>
                        </div>
                    )
                }
            </div >

            {/* OPERATIONAL INSIGHTS (Phase 2) */}
            {
                userRole === 'admin' && (
                    <div style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                            Insights Operativos ⚡️
                        </h2>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>

                            {/* PEAK HOURS CARD */}
                            <div className="card">
                                <h3 className="label">Hora Pico (Más Tráfico)</h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <Clock size={32} style={{ color: '#F59E0B' }} />
                                    <div>
                                        {(() => {
                                            const hourCounts = {};
                                            filteredTransactions.forEach(t => {
                                                const date = new Date(t.date);
                                                const hour = date.getHours();
                                                hourCounts[hour] = (hourCounts[hour] || 0) + 1;
                                            });

                                            let maxHour = null;
                                            let maxCount = 0;
                                            Object.entries(hourCounts).forEach(([hour, count]) => {
                                                if (count > maxCount) {
                                                    maxCount = count;
                                                    maxHour = parseInt(hour);
                                                }
                                            });

                                            if (maxHour !== null) {
                                                const ampm = maxHour >= 12 ? 'PM' : 'AM';
                                                const displayHour = maxHour % 12 || 12;
                                                return (
                                                    <>
                                                        <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                                                            {displayHour}:00 {ampm}
                                                        </p>
                                                        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                                            {maxCount} autos registrados
                                                        </p>
                                                    </>
                                                );
                                            }
                                            return <p style={{ color: 'var(--text-muted)' }}>No hay suficientes datos</p>;
                                        })()}
                                    </div>
                                </div>
                            </div>

                            {/* EFFICIENCY TIMER CARD */}
                            <div className="card">
                                <h3 className="label">Tiempo Promedio de Servicio</h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <RefreshCw size={32} style={{ color: '#3B82F6' }} />
                                    <div>
                                        {(() => {
                                            const completedTxs = filteredTransactions.filter(t =>
                                                (t.status === 'completed' || t.status === 'paid' || t.status === 'ready') &&
                                                t.finished_at && t.created_at
                                            );

                                            if (completedTxs.length === 0) {
                                                return <p style={{ color: 'var(--text-muted)' }}>No hay datos de tiempo</p>;
                                            }

                                            const totalMinutes = completedTxs.reduce((sum, t) => {
                                                const start = new Date(t.created_at);
                                                const end = new Date(t.finished_at);
                                                const diffMs = end - start;
                                                return sum + (diffMs / (1000 * 60));
                                            }, 0);

                                            const avgMinutes = Math.round(totalMinutes / completedTxs.length);

                                            // Color coding for efficiency
                                            let color = 'var(--success)'; // < 30 mins
                                            if (avgMinutes > 45) color = 'var(--danger)'; // > 45 mins
                                            else if (avgMinutes > 30) color = 'var(--warning)'; // 30-45 mins

                                            return (
                                                <>
                                                    <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color }}>
                                                        {formatDuration(avgMinutes)}
                                                    </p>
                                                    <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                                        Basado en {completedTxs.length} servicios
                                                    </p>
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                )
            }


            {/* FINANCIAL BREAKDOWN (DESGLOSE) */}
            {
                userRole === 'admin' && (
                    <div className="card" style={{ marginBottom: '2rem' }}>
                        <h3 className="label" style={{ marginBottom: '1rem' }}>Desglose Financiero</h3>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                                        <th style={{ padding: '1rem' }}>Fecha</th>
                                        <th style={{ padding: '1rem' }}>Autos</th>
                                        <th style={{ padding: '1rem', color: 'var(--success)' }}>Ingresos (+)</th>
                                        <th style={{ padding: '1rem', color: 'var(--warning)' }}>Comisiones (-)</th>
                                        <th style={{ padding: '1rem', color: 'var(--danger)' }}>Compras (-)</th>
                                        <th style={{ padding: '1rem' }}>Neto (=)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {breakdownData.map(row => (
                                        <tr key={row.date} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                            <td style={{ padding: '1rem' }}>{row.date}</td>
                                            <td style={{ padding: '1rem' }}>{row.count}</td>
                                            <td style={{ padding: '1rem', color: 'var(--success)' }}>${row.income.toFixed(2)}</td>
                                            <td style={{ padding: '1rem', color: 'var(--warning)' }}>${row.commissions.toFixed(2)}</td>
                                            <td style={{ padding: '1rem', color: 'var(--danger)' }}>${row.productExpenses.toFixed(2)}</td>
                                            <td style={{ padding: '1rem', fontWeight: 'bold' }}>${(row.income - row.commissions - row.productExpenses).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )
            }

            {/* DETAILED TABLE */}
            <div className="card">
                <h3 className="label" style={{ marginBottom: '1rem' }}>Detalle de Operaciones</h3>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                                <th style={{ padding: '1rem' }}>#</th>
                                <th style={{ padding: '1rem' }}>Fecha</th>
                                <th style={{ padding: '1rem' }}>Cliente</th>
                                <th style={{ padding: '1rem' }}>Servicio</th>
                                <th style={{ padding: '1rem' }}>Duración</th>
                                <th style={{ padding: '1rem' }}>Empleados</th>
                                <th style={{ padding: '1rem' }}>Método</th>
                                <th style={{ padding: '1rem' }}>{userRole === 'admin' ? 'Total Venta' : 'Mi Comisión'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTransactions.map((t, index) => (
                                <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>{filteredTransactions.length - index}</td>
                                    <td style={{ padding: '1rem' }}>
                                        {new Date(t.date).toLocaleDateString('es-PR')} <br />
                                        <small style={{ color: 'var(--text-muted)' }}>
                                            {new Date(t.date).toLocaleTimeString('es-PR', { hour: '2-digit', minute: '2-digit' })}
                                        </small>
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        {userRole === 'admin' ? (
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
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
                                                        fontSize: 'inherit',
                                                        textAlign: 'left',
                                                        padding: 0
                                                    }}
                                                >
                                                    {getCustomerName(t.customer_id, customersList)}
                                                </button>
                                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                    {getVehicleInfo(t, vehiclesList, customersList)}
                                                </span>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span>{getCustomerName(t.customer_id, customersList)}</span>
                                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                    {getVehicleInfo(t, vehiclesList, customersList)}
                                                </span>
                                            </div>
                                        )}
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        {getServiceName(t.service_id, servicesList)}
                                        {t.extras && t.extras.length > 0 && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>+ {t.extras.length} extras</span>}
                                        {(t.transaction_assignments?.length || 1) > 1 && (
                                            <span style={{ marginLeft: '0.5rem', color: 'var(--warning)', fontWeight: 'bold', fontSize: '0.8rem' }}>
                                                (1/{t.transaction_assignments.length})
                                            </span>
                                        )}
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        {(t.status === 'completed' || t.status === 'paid' || t.status === 'ready') ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>
                                                    {(() => {
                                                        if (!t.finished_at) return '--';
                                                        const diffMs = new Date(t.finished_at) - new Date(t.started_at || t.created_at);
                                                        const totalMins = Math.round(diffMs / 60000);
                                                        return formatDuration(totalMins);
                                                    })()}
                                                </span>
                                            </div>
                                        ) : (
                                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>En Curso</span>
                                        )}
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        {t.transaction_assignments && t.transaction_assignments.length > 0
                                            ? t.transaction_assignments.map(a => getEmployeeName(a.employee_id, employeesList)).join(', ')
                                            : getEmployeeName(t.employee_id, employeesList)
                                        }
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        {editingTransactionId === t.id ? (
                                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                                                <button onClick={() => handlePaymentMethodUpdate(t.id, 'cash')} style={{ fontSize: '0.7rem', padding: '2px 4px', border: '1px solid #10B981', background: '#10B981', color: 'white', borderRadius: '4px', cursor: 'pointer' }}>Efec</button>
                                                <button onClick={() => handlePaymentMethodUpdate(t.id, 'card')} style={{ fontSize: '0.7rem', padding: '2px 4px', border: '1px solid #3B82F6', background: '#3B82F6', color: 'white', borderRadius: '4px', cursor: 'pointer' }}>Tarj</button>
                                                <button onClick={() => handlePaymentMethodUpdate(t.id, 'transfer')} style={{ fontSize: '0.7rem', padding: '2px 4px', border: '1px solid #F59E0B', background: '#F59E0B', color: 'white', borderRadius: '4px', cursor: 'pointer' }}>ATH</button>
                                                <button onClick={() => setEditingTransactionId(null)} style={{ fontSize: '0.7rem', padding: '2px 4px', border: '1px solid #666', background: '#666', color: 'white', borderRadius: '4px', cursor: 'pointer' }}>X</button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => userRole === 'admin' && setEditingTransactionId(t.id)}
                                                disabled={userRole !== 'admin'}
                                                style={{
                                                    fontSize: '0.75rem',
                                                    padding: '0.1rem 0.4rem',
                                                    borderRadius: '4px',
                                                    backgroundColor: t.payment_method === 'cash' ? 'rgba(16, 185, 129, 0.2)' : t.payment_method === 'card' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                                                    color: t.payment_method === 'cash' ? '#10B981' : t.payment_method === 'card' ? '#3B82F6' : '#F59E0B',
                                                    border: `1px solid ${t.payment_method === 'cash' ? '#10B981' : t.payment_method === 'card' ? '#3B82F6' : '#F59E0B'}`,
                                                    cursor: userRole === 'admin' ? 'pointer' : 'default',
                                                    background: 'none', // Reset button default
                                                    // Re-apply background manually since button resets it or combine
                                                }}
                                                className={userRole === 'admin' ? "hover:opacity-80" : ""}
                                            >
                                                <span style={{
                                                    // Move styles here to ensure they apply inside the button or just style the button
                                                }}>
                                                    {getPaymentMethodLabel(t.payment_method)}
                                                </span>
                                            </button>
                                        )}
                                    </td>
                                    <td style={{ padding: '1rem', fontWeight: 'bold' }}>
                                        {userRole === 'admin' ? (
                                            `$${t.price.toFixed(2)}`
                                        ) : (
                                            (() => {
                                                const txTotalCommission = (parseFloat(t.commission_amount) || 0);
                                                const tip = (parseFloat(t.tip) || 0);
                                                const count = (t.transaction_assignments?.length) || 1;

                                                // 1. Calculate Total Assigned Extras (to subtract from pool)
                                                const allAssignedExtras = t.extras?.filter(e => e.assignedTo) || [];
                                                const allAssignedCommission = allAssignedExtras.reduce((s, e) => s + (parseFloat(e.commission) || 0), 0);

                                                // 2. Shared Pool (Base Commission - Assigned Extras)
                                                const sharedPool = Math.max(0, txTotalCommission - allAssignedCommission);
                                                const sharedShare = sharedPool / count;
                                                const tipShare = tip / count;

                                                // 3. My Extras
                                                const myExtras = t.extras?.filter(e => e.assignedTo === myEmployeeId) || [];
                                                const myExtrasCommission = myExtras.reduce((s, e) => s + (parseFloat(e.commission) || 0), 0);

                                                return `$${(sharedShare + tipShare + myExtrasCommission).toFixed(2)}`;
                                            })()
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {filteredTransactions.length === 0 && (
                                <tr>
                                    <td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
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
            {/* MODALS FOR REPORT DETAILS */}
            {activeModal === 'commissions' && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2100
                }} onClick={() => setActiveModal(null)}>
                    <div className="card" style={{ width: '90%', maxWidth: '600px', maxHeight: '80vh', overflowY: 'auto', position: 'relative' }} onClick={e => e.stopPropagation()}>
                        <button
                            onClick={() => setActiveModal(null)}
                            style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                        >
                            <X size={24} />
                        </button>
                        <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                            Desglose de Nómina
                        </h3>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                                    <th style={{ padding: '0.5rem' }}>Empleado</th>
                                    <th style={{ padding: '0.5rem', textAlign: 'right' }}>Bruto</th>
                                    <th style={{ padding: '0.5rem', textAlign: 'right', color: 'var(--danger)' }}>Almuerzos</th>
                                    <th style={{ padding: '0.5rem', textAlign: 'right' }}>A Pagar</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(() => {
                                    const totalsByEmp = {};
                                    // 1. Calc Gross Commissions (Base + Extras + Tips)
                                    filteredTransactions.forEach(t => {
                                        const count = t.transaction_assignments?.length || 1;
                                        // Base
                                        // Heuristic Re-Calc (Simplified)
                                        // For report breakdown we can use stored 'assignedTo' for extras but shared part is tricky without service base price known perfectly here.
                                        // BUT for 'totalCommissions' we used a simple sum.
                                        // For accurate breakdown per employee we need to iterate assignments.

                                        // Let's use simpler approach:
                                        // Total Commission for TX
                                        const totalTxComm = (parseFloat(t.commission_amount) || 0) + (parseFloat(t.tip) || 0);

                                        // Split Logic
                                        // Any assigned Extra goes to specific person.
                                        const assignedExtras = t.extras?.filter(e => e.assignedTo) || [];
                                        const assignedExtrasSum = assignedExtras.reduce((s, e) => s + (parseFloat(e.commission) || 0), 0);

                                        const sharedPool = Math.max(0, parseFloat(t.commission_amount) - assignedExtrasSum); // Only base commission is shared, tips are usually shared?
                                        // Wait, tip logic in Employees.jsx splits tips evenly.
                                        // Commission logic: storedTotal - allAssignedExtras = SharedBase.

                                        const tip = parseFloat(t.tip) || 0;
                                        const sharedBasePerPerson = sharedPool / count;
                                        const tipPerPerson = tip / count;

                                        t.transaction_assignments?.forEach(a => {
                                            if (!totalsByEmp[a.employee_id]) totalsByEmp[a.employee_id] = { gross: 0, lunch: 0 };
                                            totalsByEmp[a.employee_id].gross += (sharedBasePerPerson + tipPerPerson);
                                        });

                                        // Add Extras
                                        assignedExtras.forEach(e => {
                                            if (!totalsByEmp[e.assignedTo]) totalsByEmp[e.assignedTo] = { gross: 0, lunch: 0 };
                                            totalsByEmp[e.assignedTo].gross += (parseFloat(e.commission) || 0);
                                        });
                                    });

                                    // 2. Add Lunches
                                    filteredExpenses.forEach(e => {
                                        if (e.category === 'lunch' && e.employee_id) {
                                            if (!totalsByEmp[e.employee_id]) totalsByEmp[e.employee_id] = { gross: 0, lunch: 0 };
                                            totalsByEmp[e.employee_id].lunch += (parseFloat(e.amount) || 0);
                                        }
                                    });

                                    return Object.entries(totalsByEmp).map(([empId, stats]) => (
                                        <tr key={empId} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                            <td style={{ padding: '0.5rem' }}>{getEmployeeName(empId, employeesList)}</td>
                                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>${stats.gross.toFixed(2)}</td>
                                            <td style={{ padding: '0.5rem', textAlign: 'right', color: 'var(--danger)' }}>-${stats.lunch.toFixed(2)}</td>
                                            <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 'bold' }}>${(stats.gross - stats.lunch).toFixed(2)}</td>
                                        </tr>
                                    ));
                                })()}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeModal === 'expenses' && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2100
                }} onClick={() => setActiveModal(null)}>
                    <div className="card" style={{ width: '90%', maxWidth: '600px', maxHeight: '80vh', overflowY: 'auto', position: 'relative' }} onClick={e => e.stopPropagation()}>
                        <button
                            onClick={() => setActiveModal(null)}
                            style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                        >
                            <X size={24} />
                        </button>
                        <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                            Detalle de Gastos
                        </h3>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                                    <th style={{ padding: '0.5rem' }}>Fecha</th>
                                    <th style={{ padding: '0.5rem' }}>Concepto</th>
                                    <th style={{ padding: '0.5rem' }}>Tipo</th>
                                    <th style={{ padding: '0.5rem', textAlign: 'right' }}>Monto</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredExpenses
                                    .filter(e => e.category === 'product' || e.category === 'lunch')
                                    .map(e => (
                                        <tr key={e.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                            <td style={{ padding: '0.5rem' }}>{new Date(e.date).toLocaleDateString()}</td>
                                            <td style={{ padding: '0.5rem' }}>
                                                {e.category === 'lunch'
                                                    ? `Almuerzo: ${getEmployeeName(e.employee_id, employeesList)}`
                                                    : (e.description || 'Compra General')}
                                            </td>
                                            <td style={{ padding: '0.5rem' }}>
                                                <span style={{
                                                    backgroundColor: e.category === 'lunch' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                                                    color: e.category === 'lunch' ? 'var(--danger)' : 'var(--warning)',
                                                    padding: '2px 6px', borderRadius: '4px', fontSize: '0.8rem'
                                                }}>
                                                    {e.category === 'lunch' ? 'Almuerzo' : 'Producto'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>${parseFloat(e.amount).toFixed(2)}</td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeModal === 'income' && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2100
                }} onClick={() => setActiveModal(null)}>
                    <div className="card" style={{ width: '90%', maxWidth: '700px', maxHeight: '80vh', overflowY: 'auto', position: 'relative' }} onClick={e => e.stopPropagation()}>
                        <button
                            onClick={() => setActiveModal(null)}
                            style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                        >
                            <X size={24} />
                        </button>
                        <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                            Desglose de Ingresos
                        </h3>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                            {/* BY PAYMENT METHOD */}
                            <div>
                                <h4 style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>Por Método de Pago</h4>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <tbody>
                                        {['cash', 'card', 'transfer'].map(method => {
                                            const total = filteredTransactions
                                                .filter(t => t.payment_method === method)
                                                .reduce((sum, t) => sum + (parseFloat(t.price) || 0) + (parseFloat(t.tip) || 0), 0);
                                            const percent = totalIncome > 0 ? (total / totalIncome) * 100 : 0;

                                            // Determine Label & Color
                                            let label = 'Otro';
                                            let color = 'var(--text-primary)';
                                            if (method === 'cash') { label = 'Efectivo'; color = '#10B981'; } // Success Green
                                            if (method === 'card') { label = 'Tarjeta'; color = '#3B82F6'; } // Blue
                                            if (method === 'transfer') { label = 'ATH Móvil'; color = '#F59E0B'; } // Warning Orange

                                            return (
                                                <tr key={method} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                    <td style={{ padding: '0.5rem' }}>{label}</td>
                                                    <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 'bold', color }}>
                                                        ${total.toFixed(2)}
                                                    </td>
                                                    <td style={{ padding: '0.5rem', textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                        {percent.toFixed(1)}%
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* BY SERVICE */}
                            <div>
                                <h4 style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>Por Servicio (Top 5)</h4>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <tbody>
                                        {(() => {
                                            const serviceStats = {};
                                            filteredTransactions.forEach(t => {
                                                const sId = t.service_id;
                                                if (!serviceStats[sId]) serviceStats[sId] = { count: 0, amount: 0 };
                                                serviceStats[sId].count += 1;
                                                serviceStats[sId].amount += ((parseFloat(t.price) || 0) + (parseFloat(t.tip) || 0));
                                            });

                                            return Object.entries(serviceStats)
                                                .sort((a, b) => b[1].amount - a[1].amount)
                                                .slice(0, 5)
                                                .map(([sId, stats]) => (
                                                    <tr key={sId} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                        <td style={{ padding: '0.5rem' }}>
                                                            {getServiceName(sId, servicesList)}
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                                {stats.count} autos
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 'bold' }}>
                                                            ${stats.amount.toFixed(2)}
                                                        </td>
                                                    </tr>
                                                ));
                                        })()}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
};

export default Reports;
