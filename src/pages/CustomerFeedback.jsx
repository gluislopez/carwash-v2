import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabase';
import { Star, Send, CheckCircle, Car } from 'lucide-react';

const CustomerFeedback = () => {
    const { transactionId } = useParams();
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [transaction, setTransaction] = useState(null);
    const [hover, setHover] = useState(0);

    useEffect(() => {
        const fetchTransaction = async () => {
            const { data } = await supabase
                .from('transactions')
                .select('*, customers(name), services(name)')
                .eq('id', transactionId)
                .single();
            if (data) setTransaction(data);
        };
        fetchTransaction();
    }, [transactionId]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (rating === 0) {
            alert("Por favor selecciona una calificación");
            return;
        }

        setLoading(true);
        const { error } = await supabase
            .from('customer_feedback')
            .insert([{
                transaction_id: transactionId,
                rating,
                comment
            }]);

        if (error) {
            alert("Error al enviar feedback: " + error.message);
        } else {
            setSubmitted(true);
        }
        setLoading(false);
    };

    if (submitted) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '2rem',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                textAlign: 'center'
            }}>
                <div className="card" style={{ maxWidth: '400px', padding: '3rem' }}>
                    <CheckCircle size={64} color="#10B981" style={{ marginBottom: '1.5rem' }} />
                    <h2 style={{ marginBottom: '1rem' }}>¡Gracias por tu opinión!</h2>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
                        Tus comentarios nos ayudan a brindarte un mejor servicio cada día.
                    </p>
                    <div style={{
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        padding: '1.5rem',
                        borderRadius: '0.5rem',
                        border: '1px dashed var(--primary)'
                    }}>
                        <p style={{ fontWeight: 'bold', color: 'var(--primary)', marginBottom: '0.5rem' }}>
                            🎁 ¡REGALO PARA TI!
                        </p>
                        <p style={{ fontSize: '0.9rem' }}>
                            Presenta este mensaje en tu próxima visita y recibe un **10% de descuento**.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '2rem',
            backgroundColor: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            fontFamily: 'Inter, sans-serif'
        }}>
            <div style={{ maxWidth: '500px', width: '100%', marginTop: '2rem' }}>
                <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                    <div style={{
                        width: '80px',
                        height: '80px',
                        backgroundColor: 'var(--primary)',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 1.5rem auto',
                        boxShadow: '0 10px 15px -3px rgba(37, 99, 235, 0.3)'
                    }}>
                        <Car size={40} color="white" />
                    </div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: '800', marginBottom: '0.5rem' }}>Tu Opinión Cuenta</h1>
                    <p style={{ color: 'var(--text-muted)' }}>
                        {transaction?.customers?.name ? `Hola ${transaction.customers.name}, ` : ''}
                        cuéntanos qué tal quedó tu {transaction?.services?.name || 'vehículo'}.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="card" style={{ padding: '2rem' }}>
                    <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
                        <p style={{ fontWeight: '600', marginBottom: '1rem' }}>¿Qué tan satisfecho estás?</p>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    type="button"
                                    onClick={() => setRating(star)}
                                    onMouseEnter={() => setHover(star)}
                                    onMouseLeave={() => setHover(0)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', transition: 'transform 0.1s' }}
                                    onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.9)'}
                                    onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                >
                                    <Star
                                        size={40}
                                        fill={(hover || rating) >= star ? '#FBBF24' : 'none'}
                                        color={(hover || rating) >= star ? '#FBBF24' : 'var(--text-muted)'}
                                        style={{ transition: 'all 0.2s' }}
                                    />
                                </button>
                            ))}
                        </div>
                    </div>

                    <div style={{ marginBottom: '2rem' }}>
                        <label className="label" style={{ marginBottom: '0.75rem', display: 'block' }}>¿Algún comentario adicional?</label>
                        <textarea
                            className="input"
                            rows="4"
                            placeholder="Escribe aquí tu experiencia..."
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            style={{ resize: 'none', padding: '1rem' }}
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={loading || rating === 0}
                        style={{ width: '100%', height: '54px', fontSize: '1.1rem', fontWeight: 'bold' }}
                    >
                        {loading ? 'Enviando...' : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
                                <Send size={20} />
                                Enviar Reseña Privada
                            </div>
                        )}
                    </button>

                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '1.5rem' }}>
                        🔒 Tu reseña es privada y solo será vista por la administración.
                    </p>
                </form>
            </div>
        </div>
    );
};

export default CustomerFeedback;
