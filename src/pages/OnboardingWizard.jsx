import React, { useState } from 'react';
import { supabase } from '../supabase';
import { useNavigate } from 'react-router-dom';
import {
    Car, Users, Wrench, CheckCircle2, ArrowRight, ArrowLeft,
    Plus, Trash2, Loader2, DollarSign, Palette
} from 'lucide-react';

const STEPS = [
    { icon: <Car size={24} />, label: 'Bienvenida' },
    { icon: <Wrench size={24} />, label: 'Servicios' },
    { icon: <Users size={24} />, label: 'Empleados' },
    { icon: <CheckCircle2 size={24} />, label: '¡Listo!' },
];

const DEFAULT_SERVICES = [
    { name: 'Lavado Básico Exterior', price: '15' },
    { name: 'Lavado Interior y Exterior', price: '25' },
    { name: 'Lavado Premium Completo', price: '40' },
];

const OnboardingWizard = ({ organizationId, businessName, onComplete }) => {
    const navigate = useNavigate();
    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Services state
    const [services, setServices] = useState(DEFAULT_SERVICES);

    // Employees state
    const [employees, setEmployees] = useState([
        { name: '', role: 'empleado' }
    ]);

    // ─── Helpers ───────────────────────────────────────────────
    const addService = () => setServices(prev => [...prev, { name: '', price: '' }]);
    const removeService = (i) => setServices(prev => prev.filter((_, idx) => idx !== i));
    const updateService = (i, field, value) =>
        setServices(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s));

    const addEmployee = () => setEmployees(prev => [...prev, { name: '', role: 'empleado' }]);
    const removeEmployee = (i) => setEmployees(prev => prev.filter((_, idx) => idx !== i));
    const updateEmployee = (i, field, value) =>
        setEmployees(prev => prev.map((e, idx) => idx === i ? { ...e, [field]: value } : e));

    // ─── Save Services ─────────────────────────────────────────
    const handleSaveServices = async () => {
        setLoading(true);
        setError(null);
        try {
            const valid = services.filter(s => s.name.trim() && parseFloat(s.price) > 0);
            if (valid.length === 0) throw new Error('Agrega al menos un servicio con nombre y precio.');

            // Delete any auto-created defaults first (to avoid duplicates)
            await supabase.from('services').delete().eq('organization_id', organizationId);

            // Insert the user's services
            const rows = valid.map(s => ({
                name: s.name.trim(),
                price: parseFloat(s.price),
                organization_id: organizationId
            }));
            const { error: insErr } = await supabase.from('services').insert(rows);
            if (insErr) throw insErr;

            setStep(2);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // ─── Save Employees ────────────────────────────────────────
    const handleSaveEmployees = async () => {
        setLoading(true);
        setError(null);
        try {
            const valid = employees.filter(e => e.name.trim());
            if (valid.length > 0) {
                const rows = valid.map(e => ({
                    name: e.name.trim(),
                    role: e.role,
                    is_active: true,
                    organization_id: organizationId
                }));
                const { error: insErr } = await supabase.from('employees').insert(rows);
                if (insErr) throw insErr;
            }

            // Mark onboarding as complete
            await supabase
                .from('organizations')
                .update({ onboarding_completed: true })
                .eq('id', organizationId);

            setStep(3);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // ─── Styles ────────────────────────────────────────────────
    const card = {
        background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(24px)',
        border: '1px solid rgba(99,102,241,0.2)', borderRadius: '24px',
        padding: '2rem', width: '100%', maxWidth: '560px',
        boxShadow: '0 25px 50px rgba(0,0,0,0.8)'
    };

    const inputStyle = {
        flex: 1, padding: '0.75rem 1rem', borderRadius: '10px',
        border: '1px solid rgba(99,102,241,0.25)',
        background: 'rgba(15,23,42,0.9)', color: 'white',
        fontSize: '0.95rem', outline: 'none', minWidth: 0
    };

    const btnPrimary = {
        padding: '0.875rem 1.5rem',
        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
        color: 'white', border: 'none', borderRadius: '12px',
        fontWeight: '700', fontSize: '1rem', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        boxShadow: '0 4px 20px rgba(99,102,241,0.35)'
    };

    return (
        <div style={{
            minHeight: '100vh', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', padding: '1.5rem',
            background: 'radial-gradient(ellipse at center, #1e1b4b 0%, #0f172a 60%, #0c0a1e 100%)',
            fontFamily: "'Outfit', sans-serif"
        }}>
            {/* Progress bar */}
            <div style={{ width: '100%', maxWidth: '560px', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    {STEPS.map((s, i) => (
                        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                            <div style={{
                                width: '40px', height: '40px', borderRadius: '50%',
                                background: i < step ? '#22c55e' : i === step ? '#6366f1' : 'rgba(255,255,255,0.06)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: i <= step ? 'white' : '#475569', transition: 'all 0.3s',
                                border: i === step ? '2px solid rgba(99,102,241,0.5)' : '2px solid transparent'
                            }}>
                                {i < step ? <CheckCircle2 size={20} /> : s.icon}
                            </div>
                            <span style={{ fontSize: '0.65rem', color: i === step ? '#818cf8' : '#475569', marginTop: '0.25rem', textAlign: 'center' }}>
                                {s.label}
                            </span>
                        </div>
                    ))}
                </div>
                <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                        height: '100%', width: `${(step / (STEPS.length - 1)) * 100}%`,
                        background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                        transition: 'width 0.5s ease', borderRadius: '4px'
                    }} />
                </div>
            </div>

            <div style={card}>
                {/* Error */}
                {error && (
                    <div style={{
                        background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                        color: '#fca5a5', padding: '0.75rem 1rem', borderRadius: '10px',
                        marginBottom: '1.25rem', fontSize: '0.875rem'
                    }}>
                        ⚠️ {error}
                    </div>
                )}

                {/* ── STEP 0: Welcome ── */}
                {step === 0 && (
                    <div style={{ textAlign: 'center' }}>
                        <div style={{
                            width: '80px', height: '80px', borderRadius: '24px',
                            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 1.5rem', boxShadow: '0 8px 32px rgba(99,102,241,0.4)'
                        }}>
                            <Car size={40} color="white" />
                        </div>
                        <h1 style={{ color: 'white', fontSize: '1.75rem', fontWeight: '800', marginBottom: '0.75rem' }}>
                            ¡Bienvenido, {businessName}! 🎉
                        </h1>
                        <p style={{ color: '#94a3b8', lineHeight: '1.7', marginBottom: '0.5rem' }}>
                            Vamos a configurar tu sistema en <strong style={{ color: '#818cf8' }}>menos de 2 minutos</strong>. Solo necesitas:
                        </p>
                        <div style={{ textAlign: 'left', background: 'rgba(99,102,241,0.06)', borderRadius: '12px', padding: '1rem 1.25rem', margin: '1rem 0 1.75rem' }}>
                            {['✅ Definir tus servicios y precios', '✅ Agregar tus empleados', '✅ ¡Empezar a recibir clientes!'].map((item, i) => (
                                <p key={i} style={{ color: '#cbd5e1', margin: '0.4rem 0', fontSize: '0.95rem' }}>{item}</p>
                            ))}
                        </div>
                        <button onClick={() => setStep(1)} style={{ ...btnPrimary, width: '100%', justifyContent: 'center', padding: '1rem' }}>
                            Comenzar <ArrowRight size={18} />
                        </button>
                    </div>
                )}

                {/* ── STEP 1: Services ── */}
                {step === 1 && (
                    <div>
                        <h2 style={{ color: 'white', fontSize: '1.4rem', fontWeight: '800', marginBottom: '0.4rem' }}>
                            🛠️ Tus Servicios
                        </h2>
                        <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
                            Personaliza los servicios que ofrece tu carwash.
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '320px', overflowY: 'auto', paddingRight: '4px' }}>
                            {services.map((s, i) => (
                                <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <input
                                        type="text"
                                        placeholder="Nombre del servicio"
                                        value={s.name}
                                        onChange={e => updateService(i, 'name', e.target.value)}
                                        style={{ ...inputStyle, flex: 2 }}
                                    />
                                    <div style={{ position: 'relative', flex: 1 }}>
                                        <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#6366f1', fontSize: '0.9rem', fontWeight: '700' }}>$</span>
                                        <input
                                            type="number"
                                            placeholder="0"
                                            value={s.price}
                                            onChange={e => updateService(i, 'price', e.target.value)}
                                            style={{ ...inputStyle, paddingLeft: '1.75rem', flex: 1 }}
                                        />
                                    </div>
                                    {services.length > 1 && (
                                        <button onClick={() => removeService(i)} style={{ background: 'rgba(239,68,68,0.1)', border: 'none', borderRadius: '8px', padding: '0.6rem', cursor: 'pointer', color: '#ef4444', flexShrink: 0 }}>
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>

                        <button onClick={addService} style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(99,102,241,0.08)', border: '1px dashed rgba(99,102,241,0.3)', color: '#818cf8', padding: '0.6rem 1rem', borderRadius: '10px', cursor: 'pointer', fontSize: '0.875rem', width: '100%', justifyContent: 'center' }}>
                            <Plus size={16} /> Añadir otro servicio
                        </button>

                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                            <button onClick={() => setStep(0)} style={{ padding: '0.875rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <ArrowLeft size={16} />
                            </button>
                            <button onClick={handleSaveServices} disabled={loading} style={{ ...btnPrimary, flex: 1, justifyContent: 'center' }}>
                                {loading ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Guardando...</> : <>Guardar y continuar <ArrowRight size={18} /></>}
                            </button>
                        </div>
                    </div>
                )}

                {/* ── STEP 2: Employees ── */}
                {step === 2 && (
                    <div>
                        <h2 style={{ color: 'white', fontSize: '1.4rem', fontWeight: '800', marginBottom: '0.4rem' }}>
                            👥 Tu Equipo
                        </h2>
                        <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
                            Agrega tus empleados. Puedes agregar más después desde "Empleados".
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '300px', overflowY: 'auto', paddingRight: '4px' }}>
                            {employees.map((emp, i) => (
                                <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <input
                                        type="text"
                                        placeholder="Nombre del empleado"
                                        value={emp.name}
                                        onChange={e => updateEmployee(i, 'name', e.target.value)}
                                        style={{ ...inputStyle, flex: 2 }}
                                    />
                                    <select
                                        value={emp.role}
                                        onChange={e => updateEmployee(i, 'role', e.target.value)}
                                        style={{ ...inputStyle, flex: 1, padding: '0.75rem 0.5rem' }}
                                    >
                                        <option value="empleado">Empleado</option>
                                        <option value="admin">Admin</option>
                                        <option value="cajero">Cajero</option>
                                    </select>
                                    {employees.length > 1 && (
                                        <button onClick={() => removeEmployee(i)} style={{ background: 'rgba(239,68,68,0.1)', border: 'none', borderRadius: '8px', padding: '0.6rem', cursor: 'pointer', color: '#ef4444' }}>
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>

                        <button onClick={addEmployee} style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(99,102,241,0.08)', border: '1px dashed rgba(99,102,241,0.3)', color: '#818cf8', padding: '0.6rem 1rem', borderRadius: '10px', cursor: 'pointer', fontSize: '0.875rem', width: '100%', justifyContent: 'center' }}>
                            <Plus size={16} /> Añadir otro empleado
                        </button>

                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                            <button onClick={() => setStep(1)} style={{ padding: '0.875rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <ArrowLeft size={16} />
                            </button>
                            <button onClick={handleSaveEmployees} disabled={loading} style={{ ...btnPrimary, flex: 1, justifyContent: 'center' }}>
                                {loading ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Guardando...</> : <>Finalizar configuración <ArrowRight size={18} /></>}
                            </button>
                        </div>

                        <button onClick={() => { setStep(2); handleSaveEmployees(); }} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '0.8rem', marginTop: '0.75rem', width: '100%', textAlign: 'center' }}>
                            Saltar por ahora →
                        </button>
                    </div>
                )}

                {/* ── STEP 3: Done ── */}
                {step === 3 && (
                    <div style={{ textAlign: 'center' }}>
                        <div style={{
                            width: '80px', height: '80px', borderRadius: '50%',
                            background: 'rgba(34,197,94,0.1)', border: '2px solid rgba(34,197,94,0.4)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 1.5rem'
                        }}>
                            <CheckCircle2 size={40} color="#22c55e" />
                        </div>
                        <h2 style={{ color: 'white', fontSize: '1.6rem', fontWeight: '800', marginBottom: '0.75rem' }}>
                            ¡Todo listo! 🚀
                        </h2>
                        <p style={{ color: '#94a3b8', lineHeight: '1.7', marginBottom: '2rem' }}>
                            Tu sistema está configurado y listo para recibir clientes. Puedes agregar más servicios, empleados y personalizar desde el panel de configuración.
                        </p>
                        <button
                            onClick={() => { if (onComplete) onComplete(); else navigate('/dashboard'); }}
                            style={{ ...btnPrimary, width: '100%', justifyContent: 'center', padding: '1rem', fontSize: '1.1rem' }}
                        >
                            Ir a mi Dashboard <ArrowRight size={20} />
                        </button>
                    </div>
                )}
            </div>

            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

export default OnboardingWizard;
