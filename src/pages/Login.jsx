import React, { useState } from 'react';
import { supabase } from '../supabase';
import { useNavigate, Link } from 'react-router-dom';
import { Car, Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showPassword, setShowPassword] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            navigate('/');
        } catch (err) {
            setError(err.message === 'Invalid login credentials'
                ? 'Correo o contraseña incorrectos.'
                : err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            minHeight: '100vh', width: '100%',
            background: 'radial-gradient(ellipse at top left, #1e1b4b 0%, #0f172a 50%, #0c0a1e 100%)',
            fontFamily: "'Outfit', sans-serif",
            padding: '1rem'
        }}>
            {/* Glow effects */}
            <div style={{
                position: 'fixed', top: '-20%', left: '-10%',
                width: '500px', height: '500px',
                background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)',
                pointerEvents: 'none'
            }} />
            <div style={{
                position: 'fixed', bottom: '-20%', right: '-10%',
                width: '500px', height: '500px',
                background: 'radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)',
                pointerEvents: 'none'
            }} />

            <div style={{
                width: '100%', maxWidth: '420px',
                background: 'rgba(15, 23, 42, 0.8)',
                backdropFilter: 'blur(24px)',
                border: '1px solid rgba(99,102,241,0.2)',
                borderRadius: '24px',
                padding: '2.5rem',
                boxShadow: '0 25px 50px rgba(0,0,0,0.8)',
                position: 'relative', zIndex: 1
            }}>
                {/* Logo & Title */}
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{
                        width: '64px', height: '64px', borderRadius: '20px',
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 1rem', boxShadow: '0 8px 32px rgba(99,102,241,0.4)'
                    }}>
                        <Car size={32} color="white" />
                    </div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'white', marginBottom: '0.25rem' }}>
                        CarWash Pro
                    </h1>
                    <p style={{ color: 'rgba(148,163,184,0.8)', fontSize: '0.9rem' }}>
                        Sistema de Gestión Profesional
                    </p>
                </div>

                {/* Error */}
                {error && (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                        color: '#fca5a5', padding: '0.75rem 1rem', borderRadius: '12px',
                        marginBottom: '1.25rem', fontSize: '0.875rem'
                    }}>
                        <AlertCircle size={16} />
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Email */}
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8', fontSize: '0.875rem', fontWeight: '500' }}>
                            Correo Electrónico
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            placeholder="tu@correo.com"
                            style={{
                                width: '100%', padding: '0.875rem 1rem',
                                borderRadius: '12px', border: '1px solid rgba(99,102,241,0.25)',
                                background: 'rgba(15,23,42,0.8)', color: 'white',
                                fontSize: '1rem', outline: 'none', boxSizing: 'border-box',
                                transition: 'border-color 0.2s'
                            }}
                            onFocus={e => e.target.style.borderColor = '#6366f1'}
                            onBlur={e => e.target.style.borderColor = 'rgba(99,102,241,0.25)'}
                        />
                    </div>

                    {/* Password */}
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8', fontSize: '0.875rem', fontWeight: '500' }}>
                            Contraseña
                        </label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                placeholder="••••••••"
                                style={{
                                    width: '100%', padding: '0.875rem 3rem 0.875rem 1rem',
                                    borderRadius: '12px', border: '1px solid rgba(99,102,241,0.25)',
                                    background: 'rgba(15,23,42,0.8)', color: 'white',
                                    fontSize: '1rem', outline: 'none', boxSizing: 'border-box',
                                    transition: 'border-color 0.2s'
                                }}
                                onFocus={e => e.target.style.borderColor = '#6366f1'}
                                onBlur={e => e.target.style.borderColor = 'rgba(99,102,241,0.25)'}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                style={{
                                    position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)',
                                    background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 0
                                }}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            marginTop: '0.5rem', padding: '1rem',
                            background: loading ? 'rgba(99,102,241,0.5)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                            color: 'white', border: 'none', borderRadius: '12px',
                            fontWeight: '700', fontSize: '1rem', cursor: loading ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                            boxShadow: loading ? 'none' : '0 4px 20px rgba(99,102,241,0.4)',
                            transition: 'all 0.2s'
                        }}
                    >
                        {loading ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Iniciando sesión...</> : 'Iniciar Sesión'}
                    </button>
                </form>

                {/* Divider */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '1.5rem 0' }}>
                    <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
                    <span style={{ color: '#475569', fontSize: '0.8rem' }}>¿Nuevo negocio?</span>
                    <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
                </div>

                {/* Register CTA */}
                <Link to="/register" style={{ textDecoration: 'none' }}>
                    <button style={{
                        width: '100%', padding: '0.875rem',
                        background: 'transparent', border: '1px solid rgba(99,102,241,0.4)',
                        color: '#818cf8', borderRadius: '12px', fontWeight: '600',
                        fontSize: '0.95rem', cursor: 'pointer', transition: 'all 0.2s'
                    }}
                        onMouseEnter={e => { e.target.style.background = 'rgba(99,102,241,0.1)'; e.target.style.borderColor = '#6366f1'; }}
                        onMouseLeave={e => { e.target.style.background = 'transparent'; e.target.style.borderColor = 'rgba(99,102,241,0.4)'; }}
                    >
                        🚀 Registrar mi CarWash gratis (14 días)
                    </button>
                </Link>

                <p style={{ textAlign: 'center', color: '#334155', fontSize: '0.75rem', marginTop: '1.5rem' }}>
                    Al continuar, aceptas los términos de servicio
                </p>
            </div>

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};

export default Login;
