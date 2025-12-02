import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';

const EditTransactionModal = ({ isOpen, onClose, transaction, onUpdate, services }) => {
    // MINIMAL DEBUG VERSION
    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(255, 0, 0, 0.8)', // RED BACKGROUND
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
            color: 'white', fontSize: '2rem'
        }}>
            <div>
                <h1>TEST MODAL</h1>
                <button onClick={onClose} style={{ padding: '1rem', fontSize: '1.5rem', color: 'black' }}>CERRAR</button>
            </div>
        </div>
    );
};

export default EditTransactionModal;
