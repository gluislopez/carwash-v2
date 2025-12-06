import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Plus, ShoppingBag, Utensils, Trash2, DollarSign, Edit2, Check, X, Filter, Home, Zap, Wrench, Megaphone, MoreHorizontal, Users } from 'lucide-react';
import useSupabase from '../hooks/useSupabase';

const CATEGORIES = [
    { id: 'all', label: 'Todos', icon: Filter },
    { id: 'product', label: 'Insumos', icon: ShoppingBag },
    { id: 'lunch', label: 'Almuerzos', icon: Utensils },
    { id: 'salary', label: 'Nómina', icon: Users },
    { id: 'rent', label: 'Renta', icon: Home },
    { id: 'utilities', label: 'Servicios', icon: Zap },
    { id: 'maintenance', label: 'Mantenimiento', icon: Wrench },
    { id: 'marketing', label: 'Publicidad', icon: Megaphone },
    { id: 'other', label: 'Otros', icon: MoreHorizontal },
];

const Expenses = () => {
    const { data: expenses, create: createExpense, remove: removeExpense, update: updateExpense } = useSupabase('expenses');
    const { data: employees } = useSupabase('employees');

    // UI State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [categoryFilter, setCategoryFilter] = useState('all');

    // Form State
    const [formData, setFormData] = useState({
        description: '',
        amount: '',
        category: 'product', // Default
        employeeId: '',
        date: new Date().toISOString().split('T')[0]
    });

    // Inline Editing State
    const [editingId, setEditingId] = useState(null);
    const [editDate, setEditDate] = useState('');

    const startEditing = (item) => {
        setEditingId(item.id);
        setEditDate(new Date(item.date).toISOString().split('T')[0]);
    };

    const cancelEditing = () => {
        setEditingId(null);
        setEditDate('');
    };

    const saveDate = async (id) => {
        if (!editDate) return;
        try {
            const newDate = new Date(editDate);
            const userTimezoneOffset = newDate.getTimezoneOffset() * 60000;
            const adjustedDate = new Date(newDate.getTime() + userTimezoneOffset + (12 * 60 * 60 * 1000)); // Noon local

            await updateExpense(id, { date: adjustedDate.toISOString() });
            setEditingId(null);
        } catch (error) {
            alert('Error al actualizar fecha: ' + error.message);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (formData.category === 'lunch' && !formData.employeeId) {
            alert('Debes seleccionar un empleado para el almuerzo.');
            return;
        }

        const newExpense = {
            description: formData.category === 'lunch' ? 'Almuerzo' : formData.description,
            amount: parseFloat(formData.amount),
            category: formData.category,
            employee_id: formData.category === 'lunch' || formData.category === 'salary' ? (formData.employeeId || null) : null,
            date: new Date().toISOString()
        };

        try {
            await createExpense(newExpense);
            setFormData({
                description: '',
                amount: '',
                category: 'product',
                employeeId: '',
                date: new Date().toISOString().split('T')[0]
            });
            setIsModalOpen(false);
            // alert('Gasto registrado correctamente'); // Removed for smoother UX
        } catch (error) {
            alert('Error al registrar gasto: ' + error.message);
        }
    };

    const getEmployeeName = (id) => employees.find(e => e.id === id)?.name || 'Desconocido';

    const getCategoryLabel = (catId) => CATEGORIES.find(c => c.id === catId)?.label || catId;
    const getCategoryIcon = (catId) => {
        const cat = CATEGORIES.find(c => c.id === catId);
        const Icon = cat ? cat.icon : MoreHorizontal;
        return <Icon size={16} />;
    };

    // Filter expenses
    const filteredExpenses = expenses
        .filter(e => categoryFilter === 'all' ? true : e.category === categoryFilter)
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    // Stats
    const totalAmount = filteredExpenses.reduce((sum, item) => sum + item.amount, 0);

    return (
        <div>
            <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', marginBottom: '0.5rem' }}>Control de Gastos</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Gestiona costos operativos y pagos</p>
                </div>
                <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
                    <Plus size={20} />
                    Registrar Gasto
                </button>
            </div>

            {/* FILTERS & STATS */}
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
                {/* Filter Bar */}
                <div className="card" style={{ padding: '0.5rem', display: 'flex', gap: '0.5rem', overflowX: 'auto', alignItems: 'center' }}>
                    {CATEGORIES.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setCategoryFilter(cat.id)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0.5rem 1rem',
                                borderRadius: '0.5rem',
                                border: 'none',
                                backgroundColor: categoryFilter === cat.id ? 'var(--primary)' : 'transparent',
                                color: categoryFilter === cat.id ? 'white' : 'var(--text-muted)',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                fontWeight: categoryFilter === cat.id ? 'bold' : 'normal'
                            }}
                        >
                            {cat.id === 'all' && <Filter size={16} />}
                            {cat.label}
                        </button>
                    ))}
                </div>

                {/* Total Widget */}
                <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.5rem' }}>
                    <div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Total (Filtrado)</span>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
                            ${totalAmount.toFixed(2)}
                        </div>
                    </div>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <DollarSign size={24} />
                    </div>
                </div>
            </div>

            {/* EXPENSES LIST */}
            <div className="card">
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                                <th style={{ padding: '1rem' }}>Fecha</th>
                                <th style={{ padding: '1rem' }}>Categoría</th>
                                <th style={{ padding: '1rem' }}>Descripción / Detalle</th>
                                <th style={{ padding: '1rem', textAlign: 'right' }}>Monto</th>
                                <th style={{ padding: '1rem', textAlign: 'center' }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredExpenses.map(item => (
                                <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }} className="hover-row">
                                    <td style={{ padding: '1rem' }}>
                                        {editingId === item.id ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <input
                                                    type="date"
                                                    className="input"
                                                    style={{ padding: '0.25rem', fontSize: '0.9rem' }}
                                                    value={editDate}
                                                    onChange={(e) => setEditDate(e.target.value)}
                                                />
                                                <button onClick={() => saveDate(item.id)} style={{ color: '#10B981', background: 'none', border: 'none', cursor: 'pointer' }} title="Guardar">
                                                    <Check size={18} />
                                                </button>
                                                <button onClick={cancelEditing} style={{ color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer' }} title="Cancelar">
                                                    <X size={18} />
                                                </button>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <span>{new Date(item.date).toLocaleDateString('es-PR')}</span>
                                                <button
                                                    onClick={() => startEditing(item)}
                                                    style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5 }}
                                                    title="Editar Fecha"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)' }}>
                                            {getCategoryIcon(item.category)}
                                            <span>{getCategoryLabel(item.category)}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        {item.category === 'lunch' || item.category === 'salary'
                                            ? <span style={{ fontWeight: '500' }}>{getEmployeeName(item.employee_id)}</span>
                                            : item.description
                                        }
                                        {/* Show description even for lunch if it differs from default? Usually lunch description is just 'Almuerzo' */}
                                        {item.category === 'lunch' && item.description !== 'Almuerzo' && (
                                            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginLeft: '0.5rem' }}>
                                                ({item.description})
                                            </span>
                                        )}
                                    </td>
                                    <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 'bold', color: 'var(--danger)' }}>
                                        -${item.amount.toFixed(2)}
                                    </td>
                                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                                        <button
                                            onClick={async () => {
                                                if (window.confirm('¿Borrar este gasto permanentemente?')) {
                                                    await removeExpense(item.id);
                                                }
                                            }}
                                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                                            className="delete-btn"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filteredExpenses.length === 0 && (
                                <tr>
                                    <td colSpan="5" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        No se encontraron gastos en esta categoría.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* NEW EXPENSE MODAL */}
            {isModalOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
                }}>
                    <div className="card" style={{ width: '100%', maxWidth: '500px' }}>
                        <h3 style={{ marginBottom: '1.5rem' }}>Registrar Nuevo Gasto</h3>
                        <form onSubmit={handleSubmit}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                <div>
                                    <label className="label">Categoría</label>
                                    <select
                                        className="input"
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    >
                                        {CATEGORIES.filter(c => c.id !== 'all').map(cat => (
                                            <option key={cat.id} value={cat.id}>{cat.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="label">Monto ($)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="input"
                                        placeholder="0.00"
                                        required
                                        value={formData.amount}
                                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                        autoFocus
                                    />
                                </div>
                            </div>

                            {/* Dynamic Fields based on Category */}
                            {(formData.category === 'lunch' || formData.category === 'salary') ? (
                                <div style={{ marginBottom: '1rem' }}>
                                    <label className="label">Empleado</label>
                                    <select
                                        className="input"
                                        required
                                        value={formData.employeeId}
                                        onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                                    >
                                        <option value="">Seleccionar Empleado...</option>
                                        {employees.map(emp => (
                                            <option key={emp.id} value={emp.id}>{emp.name}</option>
                                        ))}
                                    </select>
                                </div>
                            ) : (
                                <div style={{ marginBottom: '1rem' }}>
                                    <label className="label">Descripción / Concepto</label>
                                    <input
                                        type="text"
                                        className="input"
                                        placeholder="Ej. Pago de Luz Agosto"
                                        required
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    />
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                                <button type="button" className="btn" onClick={() => setIsModalOpen(false)} style={{ backgroundColor: 'var(--bg-secondary)', color: 'white' }}>
                                    Cancelar
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    Guardar Gasto
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Expenses;
