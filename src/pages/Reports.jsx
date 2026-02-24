import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Calendar, DollarSign, Car, Users, Filter, X, Download, Clock, RefreshCw, Settings } from 'lucide-react';
import { getEmployeeName, getServiceName, getCustomerName, getVehicleInfo } from '../utils/relationshipHelpers';
import { formatDuration } from '../utils/formatUtils';
import { formatToFraction } from '../utils/fractionUtils';
import autoTable from 'jspdf-autotable';
import useSupabase from '../hooks/useSupabase';
import EditTransactionModal from '../components/EditTransactionModal';

const Reports = () => {
    const [dateRange, setDateRange] = useState('week'); // 'today', 'week', 'month', 'custom'
    const [selectedDay, setSelectedDay] = useState(null);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [myUserId, setMyUserId] = useState(null);
    const [myEmployeeId, setMyEmployeeId] = useState(null);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [userRole, setUserRole] = useState(null);
    const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
    const [editingTransactionId, setEditingTransactionId] = useState(null);
    const [activeModal, setActiveModal] = useState(null);
    const [reviewLink, setReviewLink] = useState('');

    // Update main date setters to reset day
    const handleSetDateRange = (newRange) => {
        setDateRange(newRange);
        setSelectedDay(null);
    };

    // Fetch user info
    useEffect(() => {
        const getUserAndSettings = async () => {
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

            // Fetch Settings
            const { data: settingsData } = await supabase.from('settings').select('key, value');
            if (settingsData) {
                const link = settingsData.find(s => s.key === 'review_link');
                if (link) setReviewLink(link.value);
            }
        };
        getUserAndSettings();
    }, []);

    const handleUpdateSettings = async (updates) => {
        if (userRole !== 'admin' && userRole !== 'manager') return;

        try {
            const upserts = Object.entries(updates).map(([key, value]) => ({
                key,
                value: value.toString()
            }));

            const { error } = await supabase
                .from('settings')
                .upsert(upserts);

            if (error) throw error;
            if (updates.review_link !== undefined) setReviewLink(updates.review_link);

            return { success: true };
        } catch (error) {
            console.error('Error updating settings:', error);
            alert('Error al actualizar: ' + error.message);
            return { success: false };
        }
    };

    // Fetch all transactions with assignments - ORDER BY date DESC to ensure today is first!
    const { data: allTransactions, loading, update: updateTransaction } = useSupabase('transactions', '*, customers(name, vehicle_plate, vehicle_model, phone), services(name), vehicles(brand, model), transaction_assignments(*)', { orderBy: { column: 'date', ascending: false } });

    const { data: expenses } = useSupabase('expenses');
    const { data: allNotes } = useSupabase('daily_notes');
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
            const diff = today.getDate() - day + (day === 0 ? -6 : 1);
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

            // 1. First check Day Filter (sub-filter)
            if (selectedDay) {
                if (tDateStr !== selectedDay) return false;
            } else {
                // Standard Range Filter
                if (dateRange === 'today') {
                    if (tDateStr !== startStr) return false;
                } else {
                    if (tDateStr < startStr || tDateStr > endStr) return false;
                }
            }

            // Payment Method Filter
            if (paymentMethodFilter !== 'all' && t.payment_method !== paymentMethodFilter) {
                return false;
            }

            // Role Filter: Admin/Manager sees all, Employees see assigned + Membership sales (for transparency)
            if (userRole === 'admin' || userRole === 'manager') return true;
            if (!t.service_id) return true; // Show membership/miscellaneous sales to everyone

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

            // If a specific day is selected, only return that day
            if (selectedDay) {
                return tDateStr === selectedDay;
            }

            if (dateRange === 'today') return tDateStr === startStr;
            return tDateStr >= startStr && tDateStr <= endStr;
        });
    };

    const dateFilteredTxs = getDateFilteredTransactions();
    const totalCash = dateFilteredTxs
        .filter(t => t.payment_method === 'cash' && (t.status === 'completed' || t.status === 'paid'))
        .reduce((sum, t) => sum + (parseFloat(t.total_price || (parseFloat(t.price) + (parseFloat(t.tip) || 0) + (t.extras || []).reduce((s, ex) => s + (parseFloat(ex.price) || 0), 0)))) || 0, 0);

    const totalTransfer = dateFilteredTxs
        .filter(t => t.payment_method === 'transfer' && (t.status === 'completed' || t.status === 'paid'))
        .reduce((sum, t) => sum + (parseFloat(t.total_price || (parseFloat(t.price) + (parseFloat(t.tip) || 0) + (t.extras || []).reduce((s, ex) => s + (parseFloat(ex.price) || 0), 0)))) || 0, 0);

    const totalCard = dateFilteredTxs
        .filter(t => t.payment_method === 'card' && (t.status === 'completed' || t.status === 'paid'))
        .reduce((sum, t) => sum + (parseFloat(t.total_price || (parseFloat(t.price) + (parseFloat(t.tip) || 0) + (t.extras || []).reduce((s, ex) => s + (parseFloat(ex.price) || 0), 0)))) || 0, 0);

    const totalMembershipsRevenue = dateFilteredTxs
        .filter(t => !t.service_id && (t.status === 'completed' || t.status === 'paid')) // No service_id = Membership sale
        .reduce((sum, t) => {
            // For membership sales, we trust total_price if exists, or price if not. 
            // We avoid summing extras manually here because sometimes they are double-recorded for description.
            return sum + (parseFloat(t.total_price || t.price) || 0);
        }, 0);

    const totalPending = dateFilteredTxs
        .filter(t => t.status === 'waiting' || t.status === 'in_progress' || t.status === 'ready')
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

            // If a specific day is selected, ONLY show that day
            if (selectedDay) {
                if (eDateStr !== selectedDay) return false;
            } else {
                const dateInRange = eDateStr >= startStr && eDateStr <= endStr;
                if (!dateInRange) return false;
            }

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

    const totalIncome = filteredTransactions
        .filter(t => t.status === 'completed' || t.status === 'paid')
        .reduce((sum, t) => sum + (parseFloat(t.price) || 0) + (parseFloat(t.tip) || 0), 0);

    const totalCommissions = filteredTransactions.reduce((sum, t) => {
        const totalBaseComm = (parseFloat(t.commission_amount) || 0);
        const totalTip = (parseFloat(t.tip) || 0);
        const employeeCount = (t.transaction_assignments && t.transaction_assignments.length > 0)
            ? t.transaction_assignments.length
            : 1;

        // ADMIN: Show TOTAL generated (all commissions + all tips)
        if (userRole === 'admin') {
            return sum + totalBaseComm + totalTip;
        }

        // EMPLOYEE: Calculate THEIR share (matching the table logic)
        else {
            const allAssignedExtras = t.extras?.filter(e => e.assignedTo) || [];
            const allAssignedCommission = allAssignedExtras.reduce((s, e) => s + (parseFloat(e.commission) || 0), 0);

            // 1. Shared Commission (Base - Assigned Extras)
            const sharedPool = Math.max(0, totalBaseComm - allAssignedCommission);
            const myShareBase = sharedPool / employeeCount;

            // 2. My Tips
            const myShareTip = totalTip / employeeCount;

            // 3. My Assigned Extras
            const myExtras = t.extras?.filter(e => e.assignedTo === myEmployeeId) || [];
            const myExtrasCommission = myExtras.reduce((s, e) => s + (parseFloat(e.commission) || 0), 0);

            return sum + myShareBase + myShareTip + myExtrasCommission;
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
                groups[dateKey] = { date: dateKey, count: 0, income: 0, commissions: 0, productExpenses: 0, pending: 0, cashIncome: 0, transferIncome: 0, cardIncome: 0, membershipIncome: 0 };
            }

            const isPaid = t.status === 'completed' || t.status === 'paid';
            const isPending = t.status === 'ready' || t.status === 'in_progress' || t.status === 'waiting';

            const txIncome = isPaid ? (parseFloat(t.price) || 0) + (parseFloat(t.tip) || 0) : 0;
            const txPending = isPending ? (parseFloat(t.price) || 0) : 0;
            const txCommission = (parseFloat(t.commission_amount) || 0) + (parseFloat(t.tip) || 0);

            groups[dateKey].count += 1;
            groups[dateKey].income += txIncome;
            groups[dateKey].pending += txPending;
            groups[dateKey].commissions += txCommission;

            if (isPaid) {
                if (t.payment_method === 'cash') groups[dateKey].cashIncome += txIncome;
                else if (t.payment_method === 'transfer') groups[dateKey].transferIncome += txIncome;
                else if (t.payment_method === 'card') groups[dateKey].cardIncome += txIncome;

                if (!t.service_id) {
                    groups[dateKey].membershipIncome += (parseFloat(t.price) || 0);
                }
            }
        });

        // 2. Add Expenses (Products AND Lunches) to breakdown
        if (userRole === 'admin') {
            filteredExpenses.forEach(e => {
                const dateKey = getPRDateString(e.date);
                if (!groups[dateKey]) {
                    groups[dateKey] = { date: dateKey, count: 0, income: 0, commissions: 0, productExpenses: 0, cashIncome: 0, transferIncome: 0, cardIncome: 0, pending: 0 };
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

    // TOTALS CALCULATION
    const totals = breakdownData.reduce((acc, row) => ({
        count: acc.count + (row.count || 0),
        income: acc.income + (row.income || 0),
        cashIncome: acc.cashIncome + (row.cashIncome || 0),
        transferIncome: acc.transferIncome + (row.transferIncome || 0),
        cardIncome: acc.cardIncome + (row.cardIncome || 0),
        pending: acc.pending + (row.pending || 0),
        commissions: acc.commissions + (row.commissions || 0),
        productExpenses: acc.productExpenses + (row.productExpenses || 0),
        net: acc.net + ((row.income || 0) - (row.commissions || 0) - (row.productExpenses || 0))
    }), { count: 0, income: 0, cashIncome: 0, transferIncome: 0, pending: 0, commissions: 0, productExpenses: 0, net: 0 });

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
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div>
                        <h1 style={{ fontSize: '1.875rem', marginBottom: '0.5rem' }}>Reportes y Finanzas</h1>
                        <p style={{ color: 'var(--text-muted)' }}>Resumen de operaciones</p>
                    </div>
                    {(userRole === 'admin' || userRole === 'manager') && (
                        <button
                            onClick={() => setActiveModal('settings')}
                            title="Configuración de Recibo"
                            style={{
                                backgroundColor: 'var(--bg-secondary)',
                                color: 'var(--text-primary)',
                                border: '1px solid var(--border-color)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '40px',
                                height: '40px',
                                cursor: 'pointer',
                                borderRadius: '0.5rem',
                                transition: 'all 0.2s',
                                marginTop: '-0.5rem'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--border-color)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                        >
                            <Settings size={20} />
                        </button>
                    )}
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
                {/* Previous Months Selector */}
                <select
                    className="input"
                    onChange={(e) => {
                        if (!e.target.value) return;
                        const [year, month] = e.target.value.split('-');
                        const start = new Date(year, month, 1);
                        const end = new Date(year, parseInt(month) + 1, 0);
                        setStartDate(start.toISOString().split('T')[0]);
                        setEndDate(end.toISOString().split('T')[0]);
                        setDateRange('custom');
                    }}
                    style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'white' }}
                    defaultValue=""
                >
                    <option value="" disabled>Meses Anteriores</option>
                    {Array.from({ length: 12 }).map((_, i) => {
                        const d = new Date();
                        d.setDate(1); // Avoid month skipping on 31st
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto' }}>
                    <input
                        type="date"
                        className="input"
                        value={startDate}
                        onChange={(e) => { setStartDate(e.target.value); setDateRange('custom'); setSelectedDay(null); }}
                        style={{ padding: '0.5rem' }}
                    />
                    <span style={{ color: 'var(--text-muted)' }}>-</span>
                    <input
                        type="date"
                        className="input"
                        value={endDate}
                        onChange={(e) => { setEndDate(e.target.value); setDateRange('custom'); setSelectedDay(null); }}
                        style={{ padding: '0.5rem' }}
                    />
                </div>
            </div>

            {/* DAILY TABS (Only visible if range is Week or Custom week-ish or Month) */}
            {/* We show this if dateRange is 'week' OR 'month' OR 'custom' */}
            {(dateRange === 'week' || dateRange === 'month' || dateRange === 'custom') && (
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                    {(() => {
                        let days = [];
                        const today = new Date();
                        let start = new Date();
                        let end = new Date();

                        if (dateRange === 'week') {
                            const day = today.getDay();
                            const diff = (day === 0 ? -6 : 1) - day; // Correction: To get to Monday
                            start.setDate(today.getDate() + diff); // Monday
                            end = new Date(start);
                            end.setDate(start.getDate() + 6);
                        } else if (dateRange === 'month') {
                            start = new Date(today.getFullYear(), today.getMonth(), 1);
                            end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                        } else if (dateRange === 'custom' && startDate && endDate) {
                            start = new Date(startDate);
                            end = new Date(endDate);
                        }

                        // Generate days loop
                        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                            // Limit to max 7 days for now to avoid overcrowding if month is selected?
                            // User asked for "días de la semana en curso" specifically below "Meses Anteriores". 
                            // So if month is selected, maybe we shouldn't show 30 tabs?
                            // Let's limit to 7 days if range > 10 days? No, let's just scroll.
                            days.push(new Date(d));
                        }
                        // Re-limit to current week if user specifically meant that, but sticking to range is more logical.
                        // Actually, if 'month' is selected, showing 31 buttons is intense.
                        // The user prompt was: "Below current months... tabs with current week days".
                        // This implies regardless of the filter? Or only when looking at current stuff?
                        // Let's assume if 'week' is selected, we show the 7 days.
                        // If 'month' is selected, we show nothing? Or we show weeks?
                        // I will stick to showing tabs primarily for 'week' mode as it fits "days of the week".

                        if (dateRange !== 'week') return null; // Only show for week for now as per "Pestañas con los días de la semana"

                        return (
                            <>
                                {/* "Whole Week" Button */}
                                <button
                                    onClick={() => setSelectedDay(null)}
                                    style={{
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '80px',
                                        padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)',
                                        backgroundColor: selectedDay === null ? 'var(--primary)' : 'var(--bg-card)',
                                        color: selectedDay === null ? 'white' : 'var(--text-primary)',
                                        cursor: 'pointer', flexShrink: 0, justifyContent: 'center', fontWeight: 'bold'
                                    }}
                                >
                                    <span style={{ fontSize: '0.8rem' }}>📅 ESTA</span>
                                    <span style={{ fontSize: '1rem' }}>SEMANA</span>
                                </button>

                                {days.map(d => {
                                    const dateStr = getPRDateString(d);
                                    const dayName = d.toLocaleDateString('es-ES', { weekday: 'short' });
                                    const dayNum = d.getDate();
                                    const isSelected = selectedDay === dateStr;
                                    const isToday = getPRDateString(new Date()) === dateStr;

                                    return (
                                        <button
                                            key={dateStr}
                                            onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                                            style={{
                                                display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '60px',
                                                padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)',
                                                backgroundColor: isSelected ? 'var(--primary)' : (isToday ? 'rgba(37, 99, 235, 0.1)' : 'var(--bg-card)'),
                                                color: isSelected ? 'white' : 'var(--text-primary)',
                                                cursor: 'pointer', flexShrink: 0
                                            }}
                                        >
                                            <span style={{ fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase' }}>{dayName}</span>
                                            <span style={{ fontSize: '1.2rem' }}>{dayNum}</span>
                                        </button>
                                    );
                                })}
                            </>
                        );
                    })()}
                </div>
            )}

            {/* DOWNLOAD BUTTON */}
            {userRole === 'admin' && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                    <button
                        onClick={() => {
                            const stats = {
                                count: totalCount,
                                income: totalIncome,
                                totalCash: totalCash,
                                totalTransfer: totalTransfer,
                                totalCard: totalCard,
                                expenses: totalCommissions + totalProductExpenses,
                                net: adminNet
                            };
                            import('../utils/pdfGenerator').then(mod => {
                                mod.generateReportPDF(dateFilteredTxs, dateRange.toUpperCase(), stats, userRole);
                            });
                        }}
                        className="btn btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                        <Download size={18} /> Descargar Reporte PDF
                    </button>
                </div>
            )}

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

                    <button
                        onClick={() => setPaymentMethodFilter(paymentMethodFilter === 'card' ? 'all' : 'card')}
                        title={paymentMethodFilter === 'card' ? "Mostrar Todos" : "Filtrar solo Tarjeta"}
                        style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center',
                            padding: '0.3rem 0.8rem',
                            border: '1px solid #3B82F6',
                            borderRadius: '6px',
                            backgroundColor: paymentMethodFilter === 'card' ? '#3B82F6' : 'transparent',
                            color: paymentMethodFilter === 'card' ? 'white' : '#3B82F6',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        <span style={{ fontSize: '0.7rem', fontWeight: 'bold' }}>TARJETAS</span>
                        <span style={{ fontSize: '0.9rem' }}>${totalCard.toFixed(2)}</span>
                    </button>

                    <div style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        padding: '0.3rem 0.8rem',
                        border: '1px solid #6366F1',
                        borderRadius: '6px',
                        backgroundColor: 'transparent',
                        color: '#6366F1',
                        cursor: 'default'
                    }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 'bold' }}>PENDIENTE</span>
                        <span style={{ fontSize: '0.9rem' }}>${totalPending.toFixed(2)}</span>
                    </div>

                    <div style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        padding: '0.3rem 0.8rem',
                        border: '1px solid #ec4899',
                        borderRadius: '6px',
                        backgroundColor: 'transparent',
                        color: '#ec4899',
                        cursor: 'default'
                    }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 'bold' }}>MEMBRESÍAS</span>
                        <span style={{ fontSize: '0.9rem' }}>${totalMembershipsRevenue.toFixed(2)}</span>
                    </div>
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
                    (userRole === 'admin' || userRole === 'manager') && (
                        <>
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

                            <div className="card" style={{ border: '1px solid #ec4899' }}>
                                <h3 className="label" style={{ color: '#ec4899' }}>Venta Membresías 💎</h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <RefreshCw size={32} style={{ color: '#ec4899' }} />
                                    <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ec4899' }}>${totalMembershipsRevenue.toFixed(2)}</p>
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                                    Ingresos por ventas de planes mensuales.
                                </div>
                            </div>
                        </>
                    )
                }

                {(userRole === 'admin' || userRole === 'manager') ? (
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
                                                const hour12 = maxHour % 12 || 12;
                                                return (
                                                    <>
                                                        <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{hour12}:00 {ampm}</p>
                                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{maxCount} autos registrados</p>
                                                    </>
                                                );
                                            }
                                            return <p style={{ color: 'var(--text-muted)' }}>No hay suficientes datos</p>;
                                        })()}
                                    </div>
                                </div>
                            </div>

                            {/* EMPLOYEE PERFORMANCE GRAPH */}
                            <div className="card" style={{ gridColumn: 'span 2' }}>
                                <h3 className="label">Desempeño por Empleado</h3>
                                <div style={{ marginTop: '1rem' }}>
                                    {(() => {
                                        const empStats = {};
                                        filteredTransactions.forEach(t => {
                                            const assigns = t.transaction_assignments || [];
                                            // Fallback for legacy single employee_id if no assignments
                                            if (assigns.length === 0 && t.employee_id) {
                                                assigns.push({ employee_id: t.employee_id });
                                            }

                                            assigns.forEach(a => {
                                                const emp = employeesList?.find(e => e.id === a.employee_id);
                                                const name = emp ? emp.name.split(' ')[0] : 'Desc.';
                                                empStats[name] = (empStats[name] || 0) + 1;
                                            });
                                        });

                                        const sortedStats = Object.entries(empStats).sort(([, a], [, b]) => b - a);
                                        const maxVal = sortedStats.length > 0 ? sortedStats[0][1] : 1;

                                        if (sortedStats.length === 0) return <p style={{ color: 'var(--text-muted)' }}>No hay datos de empleados</p>;

                                        return (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                {sortedStats.map(([name, count]) => (
                                                    <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                        <div style={{ width: '80px', fontSize: '0.9rem', fontWeight: 'bold' }}>{name}</div>
                                                        <div style={{ flex: 1, backgroundColor: 'var(--bg-secondary)', borderRadius: '4px', height: '24px', overflow: 'hidden' }}>
                                                            <div style={{
                                                                width: `${(count / maxVal) * 100}%`,
                                                                backgroundColor: 'var(--primary)',
                                                                height: '100%',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                paddingLeft: '0.5rem',
                                                                color: 'white',
                                                                fontSize: '0.8rem',
                                                                transition: 'width 0.5s ease-out'
                                                            }}>
                                                                {count > 0 && <span style={{ marginLeft: '5px' }}>{count}</span>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })()}
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
                        <div className="mobile-hide">
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border-color)', fontSize: '0.85rem' }}>
                                        <th style={{ padding: '0.75rem' }}>Fecha</th>
                                        <th style={{ padding: '0.75rem' }}>Autos</th>
                                        <th style={{ padding: '0.75rem', color: 'var(--success)' }}>Efectivo</th>
                                        <th style={{ padding: '0.75rem', color: '#3B82F6' }}>Tarjeta</th>
                                        <th style={{ padding: '0.75rem', color: 'var(--warning)' }}>ATH Móvil</th>
                                        <th style={{ padding: '0.75rem', color: 'var(--success)', fontWeight: 'bold' }}>Total Ingresos (+)</th>
                                        <th style={{ padding: '0.75rem', color: '#6366F1' }}>Pendiente</th>
                                        <th style={{ padding: '0.75rem', color: 'var(--warning)' }}>Comisiones (-)</th>
                                        <th style={{ padding: '0.75rem', color: 'var(--danger)' }}>Compras (-)</th>
                                        <th style={{ padding: '0.75rem' }}>Neto (=)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {breakdownData.map(row => (
                                        <tr key={row.date} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.9rem' }}>
                                            <td style={{ padding: '0.75rem' }}>{row.date}</td>
                                            <td style={{ padding: '0.75rem' }}>{row.count}</td>
                                            <td style={{ padding: '0.75rem', color: 'var(--success)' }}>${(row.cashIncome || 0).toFixed(2)}</td>
                                            <td style={{ padding: '0.75rem', color: '#3B82F6' }}>${(row.cardIncome || 0).toFixed(2)}</td>
                                            <td style={{ padding: '0.75rem', color: 'var(--warning)' }}>${(row.transferIncome || 0).toFixed(2)}</td>
                                            <td style={{ padding: '0.75rem', color: 'var(--success)', fontWeight: 'bold' }}>${row.income.toFixed(2)}</td>
                                            <td style={{ padding: '0.75rem', color: '#6366F1' }}>${row.pending.toFixed(2)}</td>
                                            <td style={{ padding: '0.75rem', color: 'var(--warning)' }}>${row.commissions.toFixed(2)}</td>
                                            <td style={{ padding: '0.75rem', color: 'var(--danger)' }}>${row.productExpenses.toFixed(2)}</td>
                                            <td style={{ padding: '0.75rem', fontWeight: 'bold' }}>${(row.income - row.commissions - row.productExpenses).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                    {/* TOTALS ROW */}
                                    <tr style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', fontWeight: 'bold', borderTop: '2px solid var(--primary)' }}>
                                        <td style={{ padding: '0.75rem' }}>TOTAL</td>
                                        <td style={{ padding: '0.75rem' }}>{totals.count}</td>
                                        <td style={{ padding: '0.75rem', color: 'var(--success)' }}>${totals.cashIncome.toFixed(2)}</td>
                                        <td style={{ padding: '0.75rem', color: '#3B82F6' }}>${(totals.cardIncome || 0).toFixed(2)}</td>
                                        <td style={{ padding: '0.75rem', color: 'var(--warning)' }}>${totals.transferIncome.toFixed(2)}</td>
                                        <td style={{ padding: '0.75rem', color: 'var(--success)' }}>${totals.income.toFixed(2)}</td>
                                        <td style={{ padding: '0.75rem', color: '#6366F1' }}>${totals.pending.toFixed(2)}</td>
                                        <td style={{ padding: '0.75rem', color: 'var(--warning)' }}>${totals.commissions.toFixed(2)}</td>
                                        <td style={{ padding: '0.75rem', color: 'var(--danger)' }}>${totals.productExpenses.toFixed(2)}</td>
                                        <td style={{ padding: '0.75rem', color: 'var(--primary)', fontSize: '1.1rem' }}>${totals.net.toFixed(2)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <div className="mobile-only">
                            <div className="mobile-card-list">
                                {breakdownData.map(row => (
                                    <div key={row.date} className="mobile-card-item">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                            <span style={{ fontWeight: 'bold' }}>{row.date}</span>
                                            <span style={{ color: 'var(--text-muted)' }}>{row.count} Autos</span>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.9rem' }}>
                                            <div style={{ color: 'var(--success)' }}>Efectivo: ${(row.cashIncome || 0).toFixed(2)}</div>
                                            <div style={{ color: '#3B82F6' }}>Tarjeta: ${(row.cardIncome || 0).toFixed(2)}</div>
                                            <div style={{ color: 'var(--warning)' }}>ATH Móvil: ${(row.transferIncome || 0).toFixed(2)}</div>
                                            <div style={{ color: 'var(--success)', fontWeight: 'bold' }}>Ingresos: ${row.income.toFixed(2)}</div>
                                            <div style={{ color: '#6366F1' }}>Pendiente: ${row.pending.toFixed(2)}</div>
                                            <div style={{ color: 'var(--warning)' }}>Comisiones: ${row.commissions.toFixed(2)}</div>
                                            <div style={{ color: 'var(--danger)' }}>Compras: ${row.productExpenses.toFixed(2)}</div>
                                        </div>
                                        <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontWeight: 'bold' }}>Neto:</span>
                                            <span style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>${(row.income - row.commissions - row.productExpenses).toFixed(2)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )
            }

            {/* DETAILED TABLE */}
            <div className="card">
                <h3 className="label" style={{ marginBottom: '1rem' }}>Detalle de Operaciones</h3>
                <div className="mobile-hide">
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
                                    {(userRole === 'admin' || userRole === 'manager') && <th style={{ padding: '1rem' }}>Recibo</th>}
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

                                                    const allAssignedExtras = t.extras?.filter(e => e.assignedTo) || [];
                                                    const allAssignedCommission = allAssignedExtras.reduce((s, e) => s + (parseFloat(e.commission) || 0), 0);

                                                    const sharedPool = Math.max(0, txTotalCommission - allAssignedCommission);
                                                    const sharedShare = sharedPool / count;
                                                    const tipShare = tip / count;

                                                    const myExtras = t.extras?.filter(e => e.assignedTo === myEmployeeId) || [];
                                                    const myExtrasCommission = myExtras.reduce((s, e) => s + (parseFloat(e.commission) || 0), 0);

                                                    return `$${(sharedShare + tipShare + myExtrasCommission).toFixed(2)}`;
                                                })()
                                            )}
                                        </td>
                                        {(userRole === 'admin' || userRole === 'manager') && (
                                            <td style={{ padding: '1rem' }}>
                                                <button
                                                    onClick={() => setEditingTransactionId(t.id)}
                                                    style={{
                                                        background: 'none',
                                                        border: 'none',
                                                        color: 'var(--success)',
                                                        cursor: 'pointer',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '0.2rem',
                                                        fontSize: '0.8rem',
                                                        fontWeight: 'bold'
                                                    }}
                                                >
                                                    <DollarSign size={14} /> Recibo
                                                </button>
                                            </td>
                                        )}
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

                <div className="mobile-only">
                    <div className="mobile-card-list">
                        {filteredTransactions.map((t, index) => (
                            <div key={t.id} className="mobile-card-item">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                                    <div>
                                        <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{getCustomerName(t.customer_id, customersList)}</div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{getVehicleInfo(t, vehiclesList, customersList)}</div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontWeight: 'bold', color: 'var(--primary)', fontSize: '1.1rem' }}>
                                            {userRole === 'admin' ? (
                                                `$${(parseFloat(t.price) || 0).toFixed(2)}`
                                            ) : (
                                                (() => {
                                                    const txTotalCommission = (parseFloat(t.commission_amount) || 0);
                                                    const tip = (parseFloat(t.tip) || 0);
                                                    const count = (t.transaction_assignments?.length) || 1;
                                                    const allAssignedExtras = t.extras?.filter(e => e.assignedTo) || [];
                                                    const allAssignedCommission = allAssignedExtras.reduce((s, e) => s + (parseFloat(e.commission) || 0), 0);
                                                    const sharedPool = Math.max(0, txTotalCommission - allAssignedCommission);
                                                    const sharedShare = sharedPool / count;
                                                    const tipShare = tip / count;
                                                    return `$${(sharedShare + tipShare).toFixed(2)}`;
                                                })()
                                            )}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>{getPaymentMethodLabel(t.payment_method)}</div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                                    <span>{getServiceName(t.service_id, servicesList)}</span>
                                    <span style={{ color: 'var(--text-muted)' }}>
                                        {new Date(t.date).toLocaleTimeString('es-PR', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                        {t.transaction_assignments && t.transaction_assignments.length > 0
                                            ? t.transaction_assignments.map(a => getEmployeeName(a.employee_id, employeesList)).join(', ')
                                            : getEmployeeName(t.employee_id, employeesList)
                                        }
                                    </div>
                                    {(userRole === 'admin' || userRole === 'manager') && (
                                        <button
                                            onClick={() => {
                                                import('../utils/pdfGenerator').then(mod => {
                                                    const vehicle = vehiclesList.find(v => v.id === t.vehicle_id);
                                                    const vehicleName = vehicle ? `${vehicle.brand} ${vehicle.model}` : (t.customers?.vehicle_model || 'Modelo N/A');
                                                    const empNames = t.transaction_assignments && t.transaction_assignments.length > 0
                                                        ? t.transaction_assignments.map(a => getEmployeeName(a.employee_id, employeesList)).join(', ')
                                                        : getEmployeeName(t.employee_id, employeesList);

                                                    mod.generateReceiptPDF(
                                                        t,
                                                        getServiceName(t.service_id, servicesList),
                                                        t.extras || [],
                                                        t.price,
                                                        t.tip || 0,
                                                        empNames,
                                                        reviewLink
                                                    );
                                                });
                                            }}
                                            className="btn btn-primary"
                                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                                        >
                                            Recibo PDF
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
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
            {/* SETTINGS MODAL */}
            {activeModal === 'settings' && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000
                }} onClick={() => setActiveModal(null)}>
                    <div className="card" style={{ width: '90%', maxWidth: '400px', position: 'relative' }} onClick={e => e.stopPropagation()}>
                        <button
                            onClick={() => setActiveModal(null)}
                            style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                        >
                            <X size={24} />
                        </button>

                        <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                            Configuración de Recibo
                        </h3>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label className="label">Link de Reseña de Google</label>
                            <input
                                type="text"
                                className="input"
                                placeholder="https://g.page/r/..."
                                value={reviewLink}
                                onChange={(e) => setReviewLink(e.target.value)}
                            />
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                                Este link aparecerá en el PDF del recibo para que los clientes dejen su reseña.
                            </p>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button
                                className="btn"
                                style={{ flex: 1, backgroundColor: 'var(--bg-secondary)', color: 'white' }}
                                onClick={() => setActiveModal(null)}
                            >
                                Cancelar
                            </button>
                            <button
                                className="btn btn-primary"
                                style={{ flex: 1 }}
                                onClick={async () => {
                                    const res = await handleUpdateSettings({ review_link: reviewLink });
                                    if (res.success) {
                                        alert('Configuración guardada');
                                        setActiveModal(null);
                                    }
                                }}
                            >
                                Guardar
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
                                    <th style={{ padding: '0.5rem' }}>Fecha</th>
                                    <th style={{ padding: '0.5rem' }}>Servicio / Concepto</th>
                                    <th style={{ padding: '0.5rem', textAlign: 'right' }}>Tipo</th>
                                    <th style={{ padding: '0.5rem', textAlign: 'right' }}>Monto</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(() => {
                                    // Group details by employee
                                    const detailsByEmp = {};

                                    filteredTransactions.forEach(t => {
                                        const count = t.transaction_assignments?.length || 1;
                                        const totalTxComm = (parseFloat(t.commission_amount) || 0); // Base Only
                                        const tip = parseFloat(t.tip) || 0;

                                        // Extras Logic
                                        const assignedExtras = t.extras?.filter(e => e.assignedTo) || [];
                                        const assignedExtrasSum = assignedExtras.reduce((s, e) => s + (parseFloat(e.commission) || 0), 0);

                                        // Shared Base Logic
                                        const sharedPool = Math.max(0, totalTxComm - assignedExtrasSum);
                                        const sharedBasePerPerson = sharedPool / count;
                                        const tipPerPerson = tip / count;

                                        // 1. Assign Shared Base + Tips
                                        t.transaction_assignments?.forEach(a => {
                                            if (!detailsByEmp[a.employee_id]) detailsByEmp[a.employee_id] = { items: [], totalGross: 0, totalLunch: 0 };

                                            const amount = sharedBasePerPerson + tipPerPerson;
                                            if (amount > 0) {
                                                detailsByEmp[a.employee_id].items.push({
                                                    date: t.date,
                                                    desc: getServiceName(t.service_id, servicesList),
                                                    amount: amount,
                                                    type: 'Comisión'
                                                });
                                                detailsByEmp[a.employee_id].totalGross += amount;
                                            }
                                        });

                                        // 2. Assign Specific Extras
                                        assignedExtras.forEach(e => {
                                            if (!detailsByEmp[e.assignedTo]) detailsByEmp[e.assignedTo] = { items: [], totalGross: 0, totalLunch: 0 };

                                            const amount = parseFloat(e.commission) || 0;
                                            detailsByEmp[e.assignedTo].items.push({
                                                date: t.date,
                                                desc: `Extra: ${e.name}`,
                                                amount: amount,
                                                type: 'Extra'
                                            });
                                            detailsByEmp[e.assignedTo].totalGross += amount;
                                        });
                                    });

                                    // Add Lunches
                                    filteredExpenses.forEach(e => {
                                        if (e.category === 'lunch' && e.employee_id) {
                                            if (!detailsByEmp[e.employee_id]) detailsByEmp[e.employee_id] = { items: [], totalGross: 0, totalLunch: 0 };
                                            const amount = parseFloat(e.amount) || 0;
                                            detailsByEmp[e.employee_id].items.push({
                                                date: e.date,
                                                desc: 'Almuerzo',
                                                amount: -amount, // Negative for display/logic? Or just track separate
                                                type: 'Almuerzo'
                                            });
                                            detailsByEmp[e.employee_id].totalLunch += amount;
                                        }
                                    });

                                    return Object.entries(detailsByEmp).map(([empId, stats]) => (
                                        <React.Fragment key={empId}>
                                            <tr style={{ backgroundColor: 'var(--bg-secondary)', fontWeight: 'bold' }}>
                                                <td colSpan="4" style={{ padding: '0.75rem' }}>
                                                    {getEmployeeName(empId, employeesList)}
                                                </td>
                                            </tr>
                                            {stats.items.sort((a, b) => new Date(a.date) - new Date(b.date)).map((item, idx) => (
                                                <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.9rem' }}>
                                                    <td style={{ padding: '0.5rem 0.5rem 0.5rem 1.5rem', color: 'var(--text-muted)' }}>
                                                        {new Date(item.date).toLocaleDateString('es-PR')}
                                                    </td>
                                                    <td style={{ padding: '0.5rem' }}>{item.desc}</td>
                                                    <td style={{ padding: '0.5rem', textAlign: 'right', color: item.type === 'Almuerzo' ? 'var(--danger)' : 'inherit' }}>
                                                        {item.type === 'Almuerzo' ? 'Almuerzo' : ''}
                                                    </td>
                                                    <td style={{ padding: '0.5rem', textAlign: 'right', color: item.type === 'Almuerzo' ? 'var(--danger)' : 'var(--success)' }}>
                                                        {item.type === 'Almuerzo' ? '-' : ''}${Math.abs(item.amount).toFixed(2)}
                                                    </td>
                                                </tr>
                                            ))}
                                            <tr style={{ borderTop: '2px solid var(--border-color)', fontWeight: 'bold' }}>
                                                <td colSpan="3" style={{ padding: '0.75rem 1.5rem', textAlign: 'right' }}>Total a Pagar:</td>
                                                <td style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--primary)' }}>
                                                    ${(stats.totalGross - stats.totalLunch).toFixed(2)}
                                                </td>
                                            </tr>
                                        </React.Fragment>
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

            {editingTransactionId && (
                <EditTransactionModal
                    isOpen={true}
                    transaction={allTransactions.find(t => t.id === editingTransactionId)}
                    services={servicesList}
                    employees={employeesList}
                    onClose={() => setEditingTransactionId(null)}
                    onUpdate={updateTransaction}
                    userRole={userRole}
                    reviewLink={reviewLink}
                />
            )}
        </div>
    );
};

export default Reports;
