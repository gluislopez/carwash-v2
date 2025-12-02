import React from 'react';
import { X } from 'lucide-react';

const EditTransactionModal = ({ isOpen, onClose, transactionId }) => {
    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
        }}>
            <div style={{
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-primary)',
                padding: '2rem',
                borderRadius: '0.5rem',
                minWidth: '300px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h2 style={{ margin: 0 }}>Editar Venta</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}>
                        <X size={24} />
                    </button>
                </div>

                <p>Editando ID: <strong>{transactionId}</strong></p>

                <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                        onClick={onClose}
                        className="btn"
                        style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EditTransactionModal;
