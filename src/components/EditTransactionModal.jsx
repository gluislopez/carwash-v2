import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';

const EditTransactionModal = ({ isOpen, onClose, transaction, onUpdate, services }) => {
    if (!isOpen || !transaction) return null;

    return (
        <div className="modal-overlay" style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
            <div className="modal-card" style={{
                backgroundColor: 'var(--bg-card)', padding: '2rem', borderRadius: '1rem',
                width: '90%', maxWidth: '500px',
                boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border-color)'
            }}>
                <h2>Modo Seguro (Debug)</h2>
                <p>Si ves esto, el modal abre correctamente.</p>
                <p>Editando transacción ID: {transaction.id}</p>
                <button className="btn" onClick={onClose} style={{ marginTop: '1rem' }}>Cerrar</button>
            </div>
        </div>
    );
};

export default EditTransactionModal;
