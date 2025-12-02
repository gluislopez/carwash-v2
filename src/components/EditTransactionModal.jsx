import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';

const EditTransactionModal = ({ isOpen, onClose, transaction, onUpdate, services }) => {
    const [formData, setFormData] = useState({
        service_id: '',
        payment_method: '',
        total_price: '',
        commission_amount: '',
        tip_amount: ''
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (transaction) {
            setFormData({
                service_id: transaction.service_id || '',
                payment_method: transaction.payment_method || 'cash',
                total_price: transaction.total_price || '',
                commission_amount: transaction.commission_amount || '',
                tip_amount: transaction.tip_amount || ''
            });
        }
    }, [transaction]);

    if (!isOpen || !transaction) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await onUpdate(transaction.id, formData);
            onClose();
        } catch (error) {
            console.error("Error updating transaction:", error);
            alert("Error al actualizar la venta");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
            <div className="modal-card" style={{
                backgroundColor: 'var(--bg-card)', padding: '2rem', borderRadius: '1rem',
                width: '90%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto',
                boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border-color)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Editar Venta</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '1rem' }}>
                        <label className="label">Servicio</label>
                        <select
                            className="input"
                            value={formData.service_id || ''}
                            onChange={(e) => setFormData({ ...formData, service_id: e.target.value })}
                            required
                        >
                            <option value="" disabled>Seleccionar servicio</option>
                            {(services || []).map(s => (
                                <option key={s.id} value={s.id}>{s.name} - ${s.price}</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                        <label className="label">Método de Pago</label>
                        <select
                            className="input"
                            value={formData.payment_method}
                            onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                            required
                        >
                            <option value="cash">Efectivo</option>
                            <option value="card">Tarjeta</option>
                            <option value="transfer">AthMóvil</option>
                        </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                            <label className="label">Precio Total ($)</label>
                            <input
                                type="number"
                                step="0.01"
                                className="input"
                                value={formData.total_price || ''}
                                onChange={(e) => setFormData({ ...formData, total_price: e.target.value })}
                                required
                            />
                        </div>
                        <div>
                            <label className="label">Comisión Total ($)</label>
                            <input
                                type="number"
                                step="0.01"
                                className="input"
                                value={formData.commission_amount || ''}
                                onChange={(e) => setFormData({ ...formData, commission_amount: e.target.value })}
                            />
                        </div>
                    </div>

                    <div style={{ marginBottom: '1.5rem' }}>
                        <label className="label">Propina Total ($)</label>
                        <input
                            type="number"
                            step="0.01"
                            className="input"
                            value={formData.tip_amount || ''}
                            onChange={(e) => setFormData({ ...formData, tip_amount: e.target.value })}
                        />
                    </div>

                    <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                        <button type="button" className="btn" onClick={onClose} style={{ backgroundColor: 'var(--bg-secondary)', color: 'white' }}>
                            Cancelar
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? 'Guardando...' : 'Guardar Cambios'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditTransactionModal;
