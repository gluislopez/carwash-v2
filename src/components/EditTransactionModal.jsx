import React, { useState } from 'react';
import { X, Save, Plus, Trash2 } from 'lucide-react';

const EditTransactionModal = ({ isOpen, onClose, transaction, services, onUpdate }) => {
    if (!isOpen || !transaction) return null;

    const [extras, setExtras] = useState(transaction.extras || []);
    const [newExtra, setNewExtra] = useState({ description: '', price: '' });

    const [formData, setFormData] = useState({
        serviceId: transaction.service_id || '',
        price: transaction.price || '',
        paymentMethod: transaction.payment_method || 'cash',
        tip: transaction.tip || 0,
        commissionAmount: transaction.commission_amount || 0,
        status: transaction.status || 'pending'
    });

    const handleAddExtra = () => {
        if (newExtra.description && newExtra.price) {
            const price = parseFloat(newExtra.price);
            const updatedExtras = [...extras, { ...newExtra, price }];
            setExtras(updatedExtras);

            // Auto-update total price
            const currentTotal = parseFloat(formData.price) || 0;
            setFormData({ ...formData, price: currentTotal + price });

            setNewExtra({ description: '', price: '' });
        }
    };

    const handleRemoveExtra = (index) => {
        const extraToRemove = extras[index];
        const updatedExtras = extras.filter((_, i) => i !== index);
        setExtras(updatedExtras);

        // Auto-update total price
        const currentTotal = parseFloat(formData.price) || 0;
        setFormData({ ...formData, price: currentTotal - extraToRemove.price });
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        // Logic: If pending -> paid. If in_progress -> completed (which means paid & done)
        let newStatus = formData.status;
        if (formData.status === 'pending') newStatus = 'paid';
        if (formData.status === 'in_progress') newStatus = 'completed';

        onUpdate(transaction.id, {
            service_id: formData.serviceId,
            price: parseFloat(formData.price),
            payment_method: formData.paymentMethod,
            tip: parseFloat(formData.tip) || 0,
            commission_amount: parseFloat(formData.commissionAmount) || 0,
            status: newStatus,
            extras: extras // Save the extras array
        });
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000
        }}>
            <div style={{
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-primary)',
                padding: '2rem',
                borderRadius: '0.5rem',
                width: '100%',
                maxWidth: '500px',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h2 style={{ margin: 0 }}>Editar Venta</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}>
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '1rem' }}>
                        <label className="label">Servicio Base</label>
                        <select
                            className="input"
                            value={formData.serviceId}
                            onChange={(e) => {
                                const newServiceId = e.target.value;
                                const service = services.find(s => s.id === newServiceId);

                                // Calculate new price: Service Price + Current Extras
                                const servicePrice = service ? parseFloat(service.price) : 0;
                                const extrasTotal = extras.reduce((sum, ex) => sum + ex.price, 0);

                                setFormData({
                                    ...formData,
                                    serviceId: newServiceId,
                                    price: servicePrice + extrasTotal,
                                    commissionAmount: service ? service.commission : formData.commissionAmount
                                });
                            }}
                        >
                            <option value="">Seleccionar Servicio...</option>
                            {services.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* SECCIÓN DE EXTRAS */}
                    <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '0.5rem' }}>
                        <label className="label" style={{ marginBottom: '0.5rem', display: 'block' }}>Servicios Extra (Opcional)</label>

                        {/* Lista de Extras */}
                        {extras.length > 0 && (
                            <div style={{ marginBottom: '1rem' }}>
                                {extras.map((extra, index) => (
                                    <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                                        <span>{extra.description} (${extra.price})</span>
                                        <button type="button" onClick={() => handleRemoveExtra(index)} style={{ color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer' }}>
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Inputs para Nuevo Extra */}
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <input
                                type="text"
                                placeholder="Descripción (ej. Cera)"
                                className="input"
                                style={{ flex: 2 }}
                                value={newExtra.description}
                                onChange={(e) => setNewExtra({ ...newExtra, description: e.target.value })}
                            />
                            <input
                                type="number"
                                placeholder="$"
                                className="input"
                                style={{ flex: 1 }}
                                value={newExtra.price}
                                onChange={(e) => setNewExtra({ ...newExtra, price: e.target.value })}
                            />
                            <button
                                type="button"
                                onClick={handleAddExtra}
                                className="btn"
                                style={{ backgroundColor: '#10B981', padding: '0.5rem' }}
                            >
                                <Plus size={20} />
                            </button>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                        <div>
                            <label className="label">Precio Total</label>
                            <input
                                type="number"
                                className="input"
                                value={formData.price}
                                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="label">Comisión (Fija)</label>
                            <input
                                type="number"
                                className="input"
                                style={{ backgroundColor: 'var(--bg-secondary)', opacity: 0.7 }}
                                value={formData.commissionAmount}
                                readOnly
                                title="La comisión no cambia con los extras"
                            />
                        </div>
                        <div>
                            <label className="label">Propina</label>
                            <input
                                type="number"
                                className="input"
                                value={formData.tip}
                                onChange={(e) => setFormData({ ...formData, tip: e.target.value })}
                            />
                        </div>
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                        <label className="label">Método de Pago</label>
                        <select
                            className="input"
                            value={formData.paymentMethod}
                            onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                        >
                            <option value="cash">Efectivo</option>
                            <option value="card">Tarjeta</option>
                            <option value="transfer">AthMóvil</option>
                        </select>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                        <button type="button" onClick={onClose} className="btn" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                            Cancelar
                        </button>
                        <button type="submit" className="btn btn-primary">
                            <Save size={18} style={{ marginRight: '0.5rem' }} />
                            {formData.status === 'pending' ? 'Completar y Pagar' : 'Guardar Cambios'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditTransactionModal;
