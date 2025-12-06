import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Plus, Minus, AlertTriangle, Search, Package, History, Save, X } from 'lucide-react';

const Inventory = () => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [adjustType, setAdjustType] = useState('add'); // 'add' or 'use'

    // Form States
    const [formData, setFormData] = useState({
        name: '',
        quantity: '',
        unit: 'Unidades',
        min_threshold: 5,
        cost_per_unit: ''
    });

    const [adjustData, setAdjustData] = useState({
        amount: '',
        reason: ''
    });

    useEffect(() => {
        fetchInventory();
    }, []);

    const fetchInventory = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('inventory_items')
                .select('*')
                .order('name');

            if (error) throw error;
            setItems(data || []);
        } catch (error) {
            console.error('Error fetching inventory:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveItem = async (e) => {
        e.preventDefault();
        try {
            const newItem = {
                name: formData.name,
                quantity: parseFloat(formData.quantity) || 0,
                unit: formData.unit,
                min_threshold: parseInt(formData.min_threshold) || 5,
                cost_per_unit: parseFloat(formData.cost_per_unit) || 0
            };

            if (selectedItem) {
                const { error } = await supabase
                    .from('inventory_items')
                    .update(newItem)
                    .eq('id', selectedItem.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('inventory_items')
                    .insert([newItem]);
                if (error) throw error;
            }

            setIsModalOpen(false);
            fetchInventory();
            resetForm();
        } catch (error) {
            alert('Error al guardar: ' + error.message);
        }
    };

    const handleAdjustStock = async (e) => {
        e.preventDefault();
        if (!selectedItem) return;

        const amount = parseFloat(adjustData.amount);
        if (!amount || amount <= 0) {
            alert('Cantidad inválida');
            return;
        }

        const change = adjustType === 'add' ? amount : -amount;
        const newQuantity = (parseFloat(selectedItem.quantity) || 0) + change;

        try {
            // 1. Update Item
            const { error: updateError } = await supabase
                .from('inventory_items')
                .update({ quantity: newQuantity, updated_at: new Date() })
                .eq('id', selectedItem.id);

            if (updateError) throw updateError;

            // 2. Log Transaction
            const { data: { user } } = await supabase.auth.getUser();
            const { error: logError } = await supabase
                .from('inventory_logs')
                .insert([{
                    item_id: selectedItem.id,
                    change_amount: change,
                    reason: adjustData.reason || (adjustType === 'add' ? 'Reabastecimiento' : 'Uso'),
                    user_id: user?.id
                }]);

            if (logError) console.error('Error logging:', logError);

            setIsAdjustModalOpen(false);
            fetchInventory();
            setAdjustData({ amount: '', reason: '' });
        } catch (error) {
            alert('Error al ajustar inventario: ' + error.message);
        }
    };

    const resetForm = () => {
        setFormData({ name: '', quantity: '', unit: 'Unidades', min_threshold: 5, cost_per_unit: '' });
        setSelectedItem(null);
    };

    const openEdit = (item) => {
        setSelectedItem(item);
        setFormData({
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            min_threshold: item.min_threshold,
            cost_per_unit: item.cost_per_unit
        });
        setIsModalOpen(true);
    };

    const openAdjust = (item, type) => {
        setSelectedItem(item);
        setAdjustType(type);
        setAdjustData({ amount: '', reason: '' });
        setIsAdjustModalOpen(true);
    };

    const filteredItems = items.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="p-6 fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>📦 Inventario</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Control de insumos y materiales</p>
                </div>
                <button
                    className="btn btn-primary"
                    onClick={() => { resetForm(); setIsModalOpen(true); }}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                    <Plus size={20} /> Nuevo Artículo
                </button>
            </div>

            {/* Search Bar */}
            <div style={{ marginBottom: '1.5rem', position: 'relative', maxWidth: '400px' }}>
                <Search size={20} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                    type="text"
                    className="input"
                    placeholder="Buscar artículo..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ paddingLeft: '2.5rem', width: '100%' }}
                />
            </div>

            {/* Inventory Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                {filteredItems.map(item => {
                    const isLow = item.quantity <= item.min_threshold;
                    return (
                        <div key={item.id} className="card" style={{ position: 'relative', borderLeft: isLow ? '4px solid var(--danger)' : '4px solid var(--success)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                <div>
                                    <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0 }}>{item.name}</h3>
                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{item.unit}</span>
                                </div>
                                <button onClick={() => openEdit(item)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>✏️</button>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: isLow ? 'var(--danger)' : 'var(--text-primary)' }}>
                                    {parseFloat(item.quantity).toFixed(1)}
                                </div>
                                {isLow && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--danger)', fontSize: '0.85rem', fontWeight: 'bold', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
                                        <AlertTriangle size={14} /> STOCK BAJO
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                    className="btn"
                                    onClick={() => openAdjust(item, 'use')}
                                    style={{ flex: 1, backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', border: '1px solid transparent' }}
                                >
                                    <Minus size={16} /> Usar
                                </button>
                                <button
                                    className="btn"
                                    onClick={() => openAdjust(item, 'add')}
                                    style={{ flex: 1, backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', border: '1px solid transparent' }}
                                >
                                    <Plus size={16} /> Agregar
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {filteredItems.length === 0 && !loading && (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    <Package size={48} style={{ opacity: 0.5, marginBottom: '1rem' }} />
                    <p>No hay artículos en el inventario.</p>
                </div>
            )}

            {/* ADD/EDIT MODAL */}
            {isModalOpen && (
                <div className="modal-overlay" style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
                }}>
                    <div className="card" style={{ width: '90%', maxWidth: '500px' }}>
                        <h2 style={{ marginBottom: '1.5rem' }}>{selectedItem ? 'Editar Artículo' : 'Nuevo Artículo'}</h2>
                        <form onSubmit={handleSaveItem}>
                            <div style={{ marginBottom: '1rem' }}>
                                <label className="label">Nombre del Producto</label>
                                <input type="text" className="input" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ej. Jabón Líquido" />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                <div>
                                    <label className="label">Cantidad Inicial</label>
                                    <input type="number" step="0.1" className="input" required value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: e.target.value })} />
                                </div>
                                <div>
                                    <label className="label">Unidad</label>
                                    <select className="input" value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })}>
                                        <option value="Unidades">Unidades</option>
                                        <option value="Galones">Galones</option>
                                        <option value="Litros">Litros</option>
                                        <option value="Cajas">Cajas</option>
                                        <option value="Botellas">Botellas</option>
                                    </select>
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                                <div>
                                    <label className="label">Alerta Stock Bajo</label>
                                    <input type="number" className="input" required value={formData.min_threshold} onChange={e => setFormData({ ...formData, min_threshold: e.target.value })} />
                                </div>
                                <div>
                                    <label className="label">Costo (Opcional)</label>
                                    <input type="number" step="0.01" className="input" value={formData.cost_per_unit} onChange={e => setFormData({ ...formData, cost_per_unit: e.target.value })} placeholder="$0.00" />
                                </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                                <button type="button" className="btn" onClick={() => setIsModalOpen(false)} style={{ backgroundColor: 'var(--bg-secondary)' }}>Cancelar</button>
                                <button type="submit" className="btn btn-primary">Guardar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ADJUST STOCK MODAL */}
            {isAdjustModalOpen && selectedItem && (
                <div className="modal-overlay" style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
                }}>
                    <div className="card" style={{ width: '90%', maxWidth: '400px' }}>
                        <h2 style={{ marginBottom: '1rem', color: adjustType === 'add' ? 'var(--success)' : 'var(--danger)' }}>
                            {adjustType === 'add' ? '📥 Reabastecer' : '📤 Registrar Uso'}
                        </h2>
                        <p style={{ marginBottom: '1.5rem', fontSize: '1.1rem' }}>
                            {selectedItem.name} <span style={{ color: 'var(--text-muted)' }}>({selectedItem.unit})</span>
                        </p>
                        <form onSubmit={handleAdjustStock}>
                            <div style={{ marginBottom: '1rem' }}>
                                <label className="label">Cantidad a {adjustType === 'add' ? 'agregar' : 'restar'}</label>
                                <input type="number" step="0.1" className="input" required autoFocus value={adjustData.amount} onChange={e => setAdjustData({ ...adjustData, amount: e.target.value })} style={{ fontSize: '1.5rem', textAlign: 'center' }} />
                            </div>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label className="label">Motivo (Opcional)</label>
                                <input type="text" className="input" value={adjustData.reason} onChange={e => setAdjustData({ ...adjustData, reason: e.target.value })} placeholder={adjustType === 'add' ? "Compra semanal" : "Consumo del día"} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                                <button type="button" className="btn" onClick={() => setIsAdjustModalOpen(false)} style={{ backgroundColor: 'var(--bg-secondary)' }}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" style={{ backgroundColor: adjustType === 'add' ? 'var(--success)' : 'var(--danger)' }}>Confirmar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Inventory;
