import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabase';
import { Star, Send, CheckCircle, Car, Clock, Droplets, DollarSign } from 'lucide-react';

const CustomerFeedback = () => {
    const { transactionId } = useParams();
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');
    const [reviewPhoto, setReviewPhoto] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [viewingPhoto, setViewingPhoto] = useState(null);
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [transaction, setTransaction] = useState(null);
    const [hover, setHover] = useState(0);

    // Initial fetch and Polling for status updates
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
        const interval = setInterval(fetchTransaction, 5000); // Poll every 5 seconds
        return () => clearInterval(interval);
    }, [transactionId]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (rating === 0) {
            alert("Por favor selecciona una calificación");
            return;
        }

        setLoading(true);
        setIsUploading(true);
        try {
            let photo_url = null;
            if (reviewPhoto) {
                const fileExt = reviewPhoto.name.split('.').pop();
                const fileName = `review_${transactionId}.${fileExt}`;
                const filePath = `reviews/${fileName}`;

                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('car_photos')
                    .upload(filePath, reviewPhoto, { upsert: true });

                if (!uploadError) {
                    const { data: publicUrlData } = supabase.storage.from('car_photos').getPublicUrl(filePath);
                    photo_url = publicUrlData.publicUrl;
                }
            }

            const { error } = await supabase
                .from('customer_feedback')
                .insert([{
                    transaction_id: transactionId,
                    rating,
                    comment,
                    photo_url
                }]);

            if (error) {
                alert("Error al enviar feedback: " + error.message);
            } else {
                setSubmitted(true);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
            setIsUploading(false);
        }
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

    if (!transaction) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Cargando información...</div>;

    // TRACKING MODE: If not paid/completed, show tracking
    if (transaction.status !== 'completed' && transaction.status !== 'paid') {
        const getStatusConfig = (status) => {
            switch (status) {
                case 'waiting': return { label: 'En Cola de Espera', icon: <Clock size={64} color="#6366f1" />, color: '#6366f1', text: 'Estamos preparando todo para tu vehículo.' };
                case 'in_progress': return { label: 'En Proceso de Lavado', icon: <Droplets size={64} color="#3B82F6" />, color: '#3B82F6', text: 'Tu auto está quedando reluciente.' };
                case 'ready': return { label: '¡Listo para Retirar!', icon: <CheckCircle size={64} color="#10B981" />, color: '#10B981', text: 'Ya puedes pasar por tu vehículo.' };
                default: return { label: 'Procesando...', icon: <Car size={64} />, color: 'gray', text: 'Consultando estatus...' };
            }
        };

        const config = getStatusConfig(transaction.status);

        return (
            <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-primary)', padding: '2rem', textAlign: 'center' }}>
                <div className="card" style={{ padding: '3rem', maxWidth: '400px', width: '100%', alignItems: 'center', display: 'flex', flexDirection: 'column' }}>
                    <div style={{
                        width: '120px', height: '120px', borderRadius: '50%',
                        backgroundColor: `${config.color}20`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        marginBottom: '2rem',
                        boxShadow: `0 0 20px ${config.color}40`,
                        animation: transaction.status === 'in_progress' ? 'pulse 2s infinite' : 'none'
                    }}>
                        {config.icon}
                    </div>
                    
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold', marginBottom: '1rem', color: 'var(--text-primary)' }}>
                        {config.label}
                    </h1>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '1.1rem' }}>
                        {config.text}
                    </p>

                    {/* NEW: Show finish photo if ready */}
                    {transaction.status === 'ready' && transaction.finish_photo_url && (
                        <div style={{ marginBottom: '2rem', width: '100%', borderRadius: '1rem', overflow: 'hidden', border: '1px solid var(--border-color)', cursor: 'pointer' }} onClick={() => setViewingPhoto(transaction.finish_photo_url)}>
                            <img src={transaction.finish_photo_url} alt="Vehículo Listo" style={{ width: '100%', height: '200px', objectFit: 'cover' }} />
                            <div style={{ padding: '0.75rem', backgroundColor: '#f0fdf4', color: '#15803d', fontWeight: 'bold' }}>
                                ✨ ¡Tu auto ya está listo!
                            </div>
                        </div>
                    )}

                    <div style={{ padding: '1rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '0.5rem', width: '100%' }}>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Vehículo</p>
                        <p style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{transaction.services?.name || 'Servicio General'}</p>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Placa: {transaction.vehicle_plate || '---'}</p>
                    </div>

                    <p style={{ marginTop: '2rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Esta pantalla se actualizará automáticamente... 🔄
                    </p>
                </div>
                {/* FULLSCREEN PHOTO VIEWER */}
                {viewingPhoto && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.95)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '2rem' }} onClick={() => setViewingPhoto(null)}>
                        <img src={viewingPhoto} alt="Zoom" style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: '0.5rem' }} />
                    </div>
                )}
                <style>{`
                    @keyframes pulse {
                        0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7); }
                        70% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(59, 130, 246, 0); }
                        100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
                    }
                `}</style>
            </div>
        );
    }

    // FEEDBACK MODE (Original)
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

                {transaction.finish_photo_url && (
                    <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
                        <img src={transaction.finish_photo_url} alt="Resultado" style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '1rem', cursor: 'pointer' }} onClick={() => setViewingPhoto(transaction.finish_photo_url)} />
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>👆 Foto del resultado final</p>
                    </div>
                )}

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

                    <div style={{ marginBottom: '2rem' }}>
                        <label className="label" style={{ marginBottom: '0.75rem', display: 'block' }}>Añadir Foto del Resultado (Opcional)</label>
                        <label style={{ 
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', 
                            padding: '1.5rem', border: '2px dashed var(--border-color)', borderRadius: '0.5rem', 
                            cursor: 'pointer', transition: 'all 0.2s',
                            backgroundColor: reviewPhoto ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                            borderColor: reviewPhoto ? '#10B981' : 'var(--border-color)'
                        }}>
                            <span style={{ fontSize: '2rem' }}>📷</span>
                            <span style={{ fontWeight: '600', color: reviewPhoto ? '#10B981' : 'var(--text-muted)' }}>
                                {reviewPhoto ? '¡Foto Seleccionada!' : 'Haz clic para tomar foto o subir'}
                            </span>
                            <input 
                                type="file" 
                                accept="image/*" 
                                capture="environment" 
                                style={{ display: 'none' }} 
                                onChange={(e) => setReviewPhoto(e.target.files[0])}
                            />
                        </label>
                        {reviewPhoto && (
                            <button type="button" onClick={() => setReviewPhoto(null)} style={{ marginTop: '0.5rem', color: '#EF4444', fontSize: '0.8rem', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                                Quitar foto
                            </button>
                        )}
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={loading || rating === 0 || isUploading}
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
            {/* FULLSCREEN PHOTO VIEWER */}
            {viewingPhoto && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.95)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '2rem' }} onClick={() => setViewingPhoto(null)}>
                    <img src={viewingPhoto} alt="Zoom" style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: '0.5rem' }} />
                </div>
            )}
        </div>
    );
};

export default CustomerFeedback;
