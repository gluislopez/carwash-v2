import React, { useState } from 'react';
import { supabase } from '../supabase';
import { useNavigate, Link } from 'react-router-dom';
import { Car, Building2, Mail, Lock, Phone, MapPin, Loader2, AlertCircle, CheckCircle2, ArrowLeft, Eye, EyeOff } from 'lucide-react';

const STEPS = ['Tu Negocio', 'Tu Cuenta', '¡Listo!'];

const RegisterBusiness = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showPassword, setShowPassword] = useState(false);

    const [form, setForm] = useState({
        businessName: '',
        phone: '',
        address: '',
        email: '',
        password: '',
        confirmPassword: ''
    });

    const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

    const handleStep1 = (e) => {
        e.preventDefault();
        if (!form.businessName.trim()) return setError('El nombre del negocio es obligatorio.');
        setError(null);
        setStep(1);
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setError(null);

        if (form.password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres.');
        if (form.password !== form.confirmPassword) return setError('Las contraseñas no coinciden.');

        setLoading(true);
        try {
            // 1. Create auth user
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: form.email,
                password: form.password,
                options: {
                    data: { business_name: form.businessName }
                }
            });
            if (authError) throw authError;

            const userId = authData.user?.id;
            if (!userId) throw new Error('No se pudo crear el usuario. Intenta de nuevo.');

            // 2. Create organization
            const { data: orgData, error: orgError } = await supabase
                .from('organizations')
                .insert({
                    name: form.businessName,
                    owner_email: form.email,
                    phone: form.phone,
                    address: form.address,
                    plan: 'trial',
                    status: 'active'
                })
                .select()
                .single();
            if (orgError) throw orgError;

            // 3. Create user_profile linking user to org as owner
            const { error: profileError } = await supabase
                .from('user_profiles')
                .insert({
                    id: userId,
                    organization_id: orgData.id,
                    role: 'owner',
                    full_name: form.businessName
                });
            if (profileError) throw profileError;

            // 4. Create default services for this org
            const defaultServices = [
                { name: 'Lavado Básico Exterior', price: 15, organization_id: orgData.id },
                { name: 'Lavado Interior y Exterior', price: 25, organization_id: orgData.id },
                { name: 'Lavado Premium Completo', price: 40, organization_id: orgData.id },
            ];
            await supabase.from('services').insert(defaultServices);

            setStep(2);
        } catch (err) {
            console.error(err);
            setError(err.message || 'Error al crear la cuenta. Intenta de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    const inputStyle = {
        width: '100%', padding: '0.875rem 1rem 0.875rem 2.75rem',
        borderRadius: '12px', border: '1px solid rgba(99,102,241,0.25)',
        background: 'rgba(15,23,42,0.8)', color: 'white',
        fontSize: '1rem', outline: 'none', boxSizing: 'border-box'
    };

    const iconStyle = {
        position: 'absolute', left: '0.875rem', top: '50%',
        transform: 'translateY(-50%)', color: '#6366f1', pointerEvents: 'none'
    };

    return (
        <div style={{
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            minHeight: '100vh', width: '100%', padding: '1rem',
            background: 'radial-gradient(ellipse at top right, #1e1b4b 0%, #0f172a 50%, #0c0a1e 100%)',
            fontFamily: "'Outfit', sans-serif"
        }}>
            <div style={{
                width: '100%', maxWidth: '480px',
                background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(24px)',
                border: '1px solid rgba(99,102,241,0.2)', borderRadius: '24px',
                padding: '2.5rem', boxShadow: '0 25px 50px rgba(0,0,0,0.8)'
            }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{
                        width: '64px', height: '64px', borderRadius: '20px',
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 1rem', boxShadow: '0 8px 32px rgba(99,102,241,0.4)'
                    }}>
                        <Car size={32} color="white" />
                    </div>
                    <h1 style={{ fontSize: '1.6rem', fontWeight: '800', color: 'white', marginBottom: '0.25rem' }}>
                        Registra tu CarWash
                    </h1>
                    <p style={{ color: 'rgba(148,163,184,0.8)', fontSize: '0.875rem' }}>
                        14 días gratis • Sin tarjeta de crédito
                    </p>
                </div>

                {/* Progress Steps */}
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2rem' }}>
                    {STEPS.map((s, i) => (
                        <React.Fragment key={i}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                                <div style={{
                                    width: '32px', height: '32px', borderRadius: '50%',
                                    background: i < step ? '#22c55e' : i === step ? '#6366f1' : 'rgba(255,255,255,0.08)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '0.8rem', fontWeight: '700',
                                    color: i <= step ? 'white' : '#475569',
                                    transition: 'all 0.3s'
                                }}>
                                    {i < step ? '✓' : i + 1}
                                </div>
                                <span style={{ fontSize: '0.7rem', color: i === step ? '#818cf8' : '#475569', marginTop: '0.25rem' }}>
                                    {s}
                                </span>
                            </div>
                            {i < STEPS.length - 1 && (
                                <div style={{
                                    flex: 1, height: '2px', marginBottom: '1.2rem',
                                    background: i < step ? '#22c55e' : 'rgba(255,255,255,0.08)',
                                    transition: 'background 0.3s'
                                }} />
                            )}
                        </React.Fragment>
                    ))}
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

                {/* STEP 0: Business Info */}
                {step === 0 && (
                    <form onSubmit={handleStep1} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ position: 'relative' }}>
                            <Building2 size={18} style={iconStyle} />
                            <input
                                type="text"
                                placeholder="Nombre de tu CarWash *"
                                value={form.businessName}
                                onChange={e => update('businessName', e.target.value)}
                                required
                                style={inputStyle}
                            />
                        </div>
                        <div style={{ position: 'relative' }}>
                            <Phone size={18} style={iconStyle} />
                            <input
                                type="tel"
                                placeholder="Teléfono del negocio"
                                value={form.phone}
                                onChange={e => update('phone', e.target.value)}
                                style={inputStyle}
                            />
                        </div>
                        <div style={{ position: 'relative' }}>
                            <MapPin size={18} style={iconStyle} />
                            <input
                                type="text"
                                placeholder="Ciudad / Dirección"
                                value={form.address}
                                onChange={e => update('address', e.target.value)}
                                style={inputStyle}
                            />
                        </div>
                        <button type="submit" style={{
                            marginTop: '0.5rem', padding: '1rem',
                            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                            color: 'white', border: 'none', borderRadius: '12px',
                            fontWeight: '700', fontSize: '1rem', cursor: 'pointer',
                            boxShadow: '0 4px 20px rgba(99,102,241,0.4)'
                        }}>
                            Continuar →
                        </button>
                    </form>
                )}

                {/* STEP 1: Account Info */}
                {step === 1 && (
                    <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ position: 'relative' }}>
                            <Mail size={18} style={iconStyle} />
                            <input
                                type="email"
                                placeholder="Correo electrónico *"
                                value={form.email}
                                onChange={e => update('email', e.target.value)}
                                required
                                style={inputStyle}
                            />
                        </div>
                        <div style={{ position: 'relative' }}>
                            <Lock size={18} style={iconStyle} />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Contraseña (mínimo 6 caracteres) *"
                                value={form.password}
                                onChange={e => update('password', e.target.value)}
                                required
                                style={{ ...inputStyle, paddingRight: '3rem' }}
                            />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} style={{
                                position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)',
                                background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 0
                            }}>
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                        <div style={{ position: 'relative' }}>
                            <Lock size={18} style={iconStyle} />
                            <input
                                type="password"
                                placeholder="Confirmar contraseña *"
                                value={form.confirmPassword}
                                onChange={e => update('confirmPassword', e.target.value)}
                                required
                                style={inputStyle}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                            <button type="button" onClick={() => { setStep(0); setError(null); }} style={{
                                flex: 1, padding: '1rem',
                                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                color: '#94a3b8', borderRadius: '12px', fontWeight: '600',
                                fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                            }}>
                                <ArrowLeft size={16} /> Atrás
                            </button>
                            <button type="submit" disabled={loading} style={{
                                flex: 2, padding: '1rem',
                                background: loading ? 'rgba(99,102,241,0.5)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                color: 'white', border: 'none', borderRadius: '12px',
                                fontWeight: '700', fontSize: '1rem', cursor: loading ? 'not-allowed' : 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                                boxShadow: loading ? 'none' : '0 4px 20px rgba(99,102,241,0.4)'
                            }}>
                                {loading ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Creando...</> : 'Crear mi cuenta'}
                            </button>
                        </div>
                    </form>
                )}

                {/* STEP 2: Success */}
                {step === 2 && (
                    <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                        <div style={{
                            width: '80px', height: '80px', borderRadius: '50%',
                            background: 'rgba(34,197,94,0.1)', border: '2px solid rgba(34,197,94,0.4)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 1.5rem'
                        }}>
                            <CheckCircle2 size={40} color="#22c55e" />
                        </div>
                        <h2 style={{ color: 'white', fontSize: '1.5rem', fontWeight: '800', marginBottom: '0.75rem' }}>
                            ¡{form.businessName} está listo! 🎉
                        </h2>
                        <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '0.5rem' }}>
                            Revisa tu correo <strong style={{ color: '#818cf8' }}>{form.email}</strong> para confirmar tu cuenta.
                        </p>
                        <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '2rem' }}>
                            Ya tienes 3 servicios por defecto. Puedes personalizarlos desde la configuración.
                        </p>
                        <button
                            onClick={() => navigate('/login')}
                            style={{
                                width: '100%', padding: '1rem',
                                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                color: 'white', border: 'none', borderRadius: '12px',
                                fontWeight: '700', fontSize: '1rem', cursor: 'pointer',
                                boxShadow: '0 4px 20px rgba(99,102,241,0.4)'
                            }}
                        >
                            Iniciar Sesión →
                        </button>
                    </div>
                )}

                {step < 2 && (
                    <p style={{ textAlign: 'center', color: '#334155', fontSize: '0.8rem', marginTop: '1.5rem' }}>
                        ¿Ya tienes cuenta?{' '}
                        <Link to="/login" style={{ color: '#818cf8', textDecoration: 'none', fontWeight: '600' }}>
                            Iniciar sesión
                        </Link>
                    </p>
                )}
            </div>
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

export default RegisterBusiness;
