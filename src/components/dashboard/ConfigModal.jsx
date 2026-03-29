import React from 'react';

const ConfigModal = ({ 
    isOpen, 
    onClose, 
    reviewLink, 
    setReviewLink, 
    stripeLink, 
    setStripeLink, 
    onSave 
}) => {
    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.8)',
            display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000
        }} onClick={onClose}>
            <div style={{
                backgroundColor: 'var(--bg-card)',
                padding: '2rem',
                borderRadius: '0.8rem',
                width: '90%',
                maxWidth: '450px',
                border: '1px solid var(--border-color)',
                boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
            }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 'bold' }}>Configuración de Recibo</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                    <label className="label" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Link de Reseña de Google</label>
                    <input
                        type="text"
                        className="input"
                        placeholder="https://g.page/r/..."
                        value={reviewLink}
                        onChange={(e) => setReviewLink(e.target.value)}
                        style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)', backgroundColor: 'rgba(255,255,255,0.05)', color: 'white' }}
                    />
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                        Este link aparecerá en el PDF del recibo para que los clientes dejen su reseña.
                    </p>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                    <label className="label" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Link de Pago Stripe</label>
                    <input
                        type="text"
                        className="input"
                        placeholder="https://buy.stripe.com/..."
                        value={stripeLink}
                        onChange={(e) => setStripeLink(e.target.value)}
                        style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)', backgroundColor: 'rgba(255,255,255,0.05)', color: 'white' }}
                    />
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                        Link de pago de Stripe antiguo (Opcional si usas el nuevo panel nativo).
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                        className="btn"
                        style={{ flex: 1, backgroundColor: 'var(--bg-secondary)', color: 'white', padding: '0.75rem', borderRadius: '0.5rem', cursor: 'pointer', border: 'none' }}
                        onClick={onClose}
                    >
                        Cancelar
                    </button>
                    <button
                        className="btn btn-primary"
                        style={{ flex: 1, backgroundColor: 'var(--primary)', color: 'white', padding: '0.75rem', borderRadius: '0.5rem', cursor: 'pointer', border: 'none', fontWeight: 'bold' }}
                        onClick={async () => {
                            const success = await onSave({ review_link: reviewLink, stripe_link: stripeLink });
                            if (success) {
                                alert('Configuración guardada');
                                onClose();
                            }
                        }}
                    >
                        Guardar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfigModal;
