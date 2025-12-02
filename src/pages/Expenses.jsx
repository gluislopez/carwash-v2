import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Plus, ShoppingBag, Utensils, Trash2, DollarSign } from 'lucide-react';
import useSupabase from '../hooks/useSupabase';

const Expenses = () => {
    const [activeTab, setActiveTab] = useState('product'); // 'product' | 'lunch'
    const { data: expenses, create: createExpense, remove: removeExpense } = useSupabase('expenses');
    const { data: employees } = useSupabase('employees');

    const [formData, setFormData] = useState({
        description: '',
        amount: '',
        employeeId: '',
        date: new Date().toISOString().split('T')[0]
    });

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (activeTab === 'lunch' && !formData.employeeId) {
            alert('Debes seleccionar un empleado para el almuerzo.');
            return;
        }

        const newExpense = {
            description: activeTab === 'lunch' ? 'Almuerzo' : formData.description,
            amount: parseFloat(formData.amount),
            category: activeTab,
            employee_id: activeTab === 'lunch' ? formData.employeeId : null,
            date: new Date().toISOString() // Use current time for simplicity, or add time picker
        };

        try {
            await createExpense(newExpense);
            setFormData({ ...formData, description: '', amount: '', employeeId: '' });
            alert('Gasto registrado correctamente');
        } catch (error) {
            alert('Error al registrar gasto: ' + error.message);
        }
    };

    const getEmployeeName = (id) => employees.find(e => e.id === id)?.name || 'Desconocido';

    // Filter expenses by tab
    const filteredExpenses = expenses
        .filter(e => e.category === activeTab)
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    return (
        <div>
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.875rem', marginBottom: '0.5rem' }}>Control de Gastos</h1>
                <p style={{ color: 'var(--text-muted)' }}>Registra compras y almuerzos</p>
            </div>

            {/* TABS */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
                <button
                    className={`btn ${activeTab === 'product' ? 'btn-primary' : ''}`}
                    onClick={() => setActiveTab('product')}
                    style={{ flex: 1, justifyContent: 'center', backgroundColor: activeTab === 'product' ? 'var(--primary)' : 'var(--bg-card)', color: activeTab === 'product' ? 'white' : 'var(--text-main)' }}
                >
                    <ShoppingBag size={20} />
                    Compras
                </button>
                <button
                    className={`btn ${activeTab === 'lunch' ? 'btn-primary' : ''}`}
                    onClick={() => setActiveTab('lunch')}
                    style={{ flex: 1, justifyContent: 'center', backgroundColor: activeTab === 'lunch' ? 'var(--primary)' : 'var(--bg-card)', color: activeTab === 'lunch' ? 'white' : 'var(--text-main)' }}
                >
                    <Utensils size={20} />
                    Almuerzos
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
                {/* FORM */}
                <div className="card" style={{ height: 'fit-content' }}>
                    <h3 className="label" style={{ marginBottom: '1rem' }}>
                        {activeTab === 'product' ? 'Registrar Compra' : 'Registrar Almuerzo'}
                    </h3>
                    <form onSubmit={handleSubmit}>
                        {activeTab === 'product' && (
                            <div style={{ marginBottom: '1rem' }}>
                                <label className="label">Descripción</label>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="Ej. Jabón, Cera, Paños..."
                                    required
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>
                        )}

                        {activeTab === 'lunch' && (
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
                        )}

                        <div style={{ marginBottom: '1rem' }}>
                            <label className="label">Monto ($)</label>
                            <input
                                type="number"
                                step="0.01"
                                className="input"
                                placeholder="0.00"
                                required
                                value={formData.amount}
                                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                            />
                        </div>

                        <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                            <Plus size={20} />
                            Registrar
                        </button>
                    </form>
                </div>

                {/* LIST */}
                <div className="card">
                    <h3 className="label" style={{ marginBottom: '1rem' }}>Historial Reciente</h3>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                                    <th style={{ padding: '1rem' }}>Fecha</th>
                                    <th style={{ padding: '1rem' }}>Descripción</th>
                                    <th style={{ padding: '1rem' }}>Monto</th>
                                    <th style={{ padding: '1rem' }}>Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredExpenses.map(item => (
                                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '1rem' }}>
                                            {new Date(item.date).toLocaleDateString('es-PR')}
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            {activeTab === 'lunch'
                                                ? `Almuerzo - ${getEmployeeName(item.employee_id)}`
                                                : item.description}
                                        </td>
                                        <td style={{ padding: '1rem', fontWeight: 'bold', color: 'var(--danger)' }}>
                                            -${item.amount.toFixed(2)}
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <button
                                                onClick={async () => {
                                                    if (window.confirm('¿Borrar este gasto?')) {
                                                        await removeExpense(item.id);
                                                    }
                                                }}
                                                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {filteredExpenses.length === 0 && (
                                    <tr>
                                        <td colSpan="4" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                            No hay registros recientes.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Expenses;
