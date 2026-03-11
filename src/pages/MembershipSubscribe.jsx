import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { CheckCircle, Download, Send, CreditCard, Car, User, Phone, Info, Award, ChevronRight } from 'lucide-react';
import { generateMembershipTermsPDF } from '../utils/pdfGenerator';

const MembershipSubscribe = () => {
    const [memberships, setMemberships] = useState([]);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        vehicleBrand: '',
        vehicleModel: '',
        vehiclePlate: ''
    });

    useEffect(() => {
        fetchMemberships();
    }, []);

    const fetchMemberships = async () => {
        const { data, error } = await supabase
            .from('memberships')
            .select('*')
            .order('price', { ascending: true });
        
        if (data) setMemberships(data);
        setLoading(false);
    };

    const handleDownloadTerms = async () => {
        if (!formData.name) return alert("Por favor, ingresa tu nombre para personalizar los términos.");
        
        const vehicleInfo = `${formData.vehicleBrand} ${formData.vehicleModel} (${formData.vehiclePlate})`.trim();
        const { blob, fileName } = await generateMembershipTermsPDF(
            formData.name, 
            selectedPlan?.name || '', 
            vehicleInfo, 
            new Date().toLocaleDateString('en-CA')
        );

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedPlan) return alert("Por favor selecciona un plan.");
        if (!formData.name || !formData.phone || !formData.vehiclePlate) return alert("Por favor completa los campos obligatorios.");

        setSubmitting(true);

        try {
            // 1. Create or find customer
            // Check if phone exists
            let customerId;
            const { data: existingCustomer } = await supabase
                .from('customers')
                .select('id')
                .eq('phone', formData.phone)
                .single();

            if (existingCustomer) {
                customerId = existingCustomer.id;
            } else {
                const { data: newCustomer, error: custError } = await supabase
                    .from('customers')
                    .insert([{ 
                        name: formData.name, 
                        phone: formData.phone,
                        vehicle_brand: formData.vehicleBrand,
                        vehicle_model: formData.vehicleModel,
                        vehicle_plate: formData.vehiclePlate
                    }])
                    .select()
                    .single();
                
                if (custError) throw custError;
                customerId = newCustomer.id;
            }

            // 2. Create vehicle if plate is new
            const { data: existingVehicle } = await supabase
                .from('vehicles')
                .select('id')
                .eq('plate', formData.vehiclePlate)
                .single();

            let vehicleId;
            if (existingVehicle) {
                vehicleId = existingVehicle.id;
            } else {
                const { data: newVehicle, error: vehError } = await supabase
                    .from('vehicles')
                    .insert([{
                        customer_id: customerId,
                        brand: formData.vehicleBrand,
                        model: formData.vehicleModel,
                        plate: formData.vehiclePlate
                    }])
                    .select()
                    .single();
                
                if (vehError) throw vehError;
                vehicleId = newVehicle.id;
            }

            // 3. Create membership (Pending status)
            const { error: subError } = await supabase
                .from('customer_memberships')
                .insert([{
                    customer_id: customerId,
                    membership_id: selectedPlan.id,
                    vehicle_id: vehicleId,
                    status: 'pending_payment', // Custom status or just insert as is
                    start_date: new Date().toISOString().split('T')[0],
                    next_billing_date: new Date().toISOString().split('T')[0] // Bills today
                }]);

            if (subError) throw subError;

            setSubmitted(true);
        } catch (error) {
            console.error("Error subscribing:", error);
            alert("Hubo un error al procesar tu solicitud: " + error.message);
        } finally {
            setSubmitting(false);
        }
    };

    if (submitted) {
        return (
            <div style={{ 
                minHeight: '100vh', 
                backgroundColor: '#0f172a', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                padding: '2rem',
                color: 'white',
                fontFamily: 'Inter, system-ui, sans-serif'
            }}>
                <div style={{ 
                    maxWidth: '500px', 
                    textAlign: 'center', 
                    backgroundColor: '#1e293b', 
                    padding: '3rem', 
                    borderRadius: '1.5rem', 
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                    border: '1px solid #334155'
                }}>
                    <div style={{ 
                        width: '80px', 
                        height: '80px', 
                        backgroundColor: '#10b981', 
                        borderRadius: '50%', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        margin: '0 auto 2rem' 
                    }}>
                        <CheckCircle size={40} color="white" />
                    </div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem' }}>¡Solicitud Enviada!</h1>
                    <p style={{ color: '#94a3b8', fontSize: '1.1rem', lineHeight: '1.6', marginBottom: '2rem' }}>
                        Gracias por unirte a nuestro programa VIP. Un agente se comunicará contigo pronto al <b>{formData.phone}</b> para completar el primer pago y activar tu membresía.
                    </p>
                    <button 
                        onClick={() => window.location.reload()}
                        style={{ 
                            padding: '0.8rem 2rem', 
                            borderRadius: '0.5rem', 
                            border: 'none', 
                            backgroundColor: '#3b82f6', 
                            color: 'white', 
                            fontWeight: 'bold', 
                            cursor: 'pointer' 
                        }}
                    >
                        Volver al Inicio
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div style={{ 
            minHeight: '100vh', 
            backgroundColor: '#0f172a', 
            color: 'white', 
            fontFamily: 'Inter, system-ui, sans-serif',
            backgroundImage: 'radial-gradient(circle at top right, #1e293b, #0f172a)',
            paddingBottom: '5rem'
        }}>
            {/* Header */}
            <header style={{ padding: '2rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem' }}>
                <img src="/logo.jpg" alt="Logo" style={{ width: '50px', borderRadius: '50%' }} />
                <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', letterSpacing: '-0.025em' }}>Express CarWash VIP</h1>
            </header>

            <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '0 1rem' }}>
                <div style={{ textAlign: 'center', marginBottom: '4rem', marginTop: '2rem' }}>
                    <h2 style={{ fontSize: '3rem', fontWeight: '900', marginBottom: '1rem', background: 'linear-gradient(to right, #60a5fa, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        Elige tu Plan VIP
                    </h2>
                    <p style={{ fontSize: '1.2rem', color: '#94a3b8', maxWidth: '600px', margin: '0 auto' }}>
                        Disfruta de lavados ilimitados o paquetes exclusivos. Ahorra tiempo y mantén tu auto impecable siempre.
                    </p>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '5rem' }}>Cargando planes increíbles...</div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginBottom: '5rem' }}>
                        {memberships.map(plan => (
                            <div 
                                key={plan.id}
                                onClick={() => setSelectedPlan(plan)}
                                style={{ 
                                    backgroundColor: selectedPlan?.id === plan.id ? '#1e293b' : '#0f172a', 
                                    padding: '2.5rem', 
                                    borderRadius: '1.5rem', 
                                    border: selectedPlan?.id === plan.id ? '2px solid #3b82f6' : '1px solid #334155',
                                    cursor: 'pointer',
                                    transition: 'all 0.3s ease',
                                    transform: selectedPlan?.id === plan.id ? 'scale(1.02)' : 'scale(1)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    position: 'relative',
                                    boxShadow: selectedPlan?.id === plan.id ? '0 20px 25px -5px rgba(59, 130, 246, 0.2)' : 'none'
                                }}
                            >
                                {selectedPlan?.id === plan.id && (
                                    <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', color: '#3b82f6' }}>
                                        <CheckCircle size={28} />
                                    </div>
                                )}
                                <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>{plan.name}</h3>
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <span style={{ fontSize: '2.5rem', fontWeight: '900' }}>${plan.price}</span>
                                    <span style={{ color: '#94a3b8', fontSize: '1.1rem' }}> /mes</span>
                                </div>
                                <p style={{ color: '#94a3b8', fontSize: '1rem', lineHeight: '1.5', flexGrow: 1, marginBottom: '2rem' }}>
                                    {plan.description || 'Beneficios exclusivos para tu vehículo.'}
                                </p>
                                <div style={{ marginTop: 'auto' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#60a5fa', fontSize: '0.9rem', fontWeight: 'bold', textTransform: 'uppercase' }}>
                                        <Award size={18} />
                                        {plan.type === 'unlimited' ? 'Lavados Ilimitados' : `${plan.limit_count} Lavados al Mes`}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {selectedPlan && (
                    <div style={{ 
                        backgroundColor: '#1e293b', 
                        padding: '3rem', 
                        borderRadius: '2rem', 
                        border: '1px solid #334155',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                    }}>
                        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                            <div style={{ flex: 1, minWidth: '300px' }}>
                                <h3 style={{ fontSize: '1.8rem', fontWeight: 'bold', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <User size={24} color="#3b82f6" /> Tus Datos
                                </h3>
                                <form onSubmit={handleSubmit} id="sub-form">
                                    <div style={{ marginBottom: '1.5rem' }}>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8', fontSize: '0.9rem' }}>Nombre Completo</label>
                                        <input 
                                            required
                                            type="text" 
                                            placeholder="Juan del Pueblo"
                                            value={formData.name}
                                            onChange={e => setFormData({...formData, name: e.target.value})}
                                            style={{ width: '100%', padding: '1rem', borderRadius: '0.75rem', backgroundColor: '#0f172a', border: '1px solid #334155', color: 'white', fontSize: '1rem' }}
                                        />
                                    </div>
                                    <div style={{ marginBottom: '1.5rem' }}>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8', fontSize: '0.9rem' }}>Teléfono (WhatsApp)</label>
                                        <input 
                                            required
                                            type="tel" 
                                            placeholder="787-000-0000"
                                            value={formData.phone}
                                            onChange={e => setFormData({...formData, phone: e.target.value})}
                                            style={{ width: '100%', padding: '1rem', borderRadius: '0.75rem', backgroundColor: '#0f172a', border: '1px solid #334155', color: 'white', fontSize: '1rem' }}
                                        />
                                    </div>

                                    <h3 style={{ fontSize: '1.8rem', fontWeight: 'bold', marginBottom: '2rem', marginTop: '3rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <Car size={24} color="#3b82f6" /> Tu Vehículo
                                    </h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8', fontSize: '0.9rem' }}>Marca</label>
                                            <input 
                                                type="text" 
                                                placeholder="Toyota"
                                                value={formData.vehicleBrand}
                                                onChange={e => setFormData({...formData, vehicleBrand: e.target.value})}
                                                style={{ width: '100%', padding: '1rem', borderRadius: '0.75rem', backgroundColor: '#0f172a', border: '1px solid #334155', color: 'white', fontSize: '1rem' }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8', fontSize: '0.9rem' }}>Modelo</label>
                                            <input 
                                                type="text" 
                                                placeholder="Corolla"
                                                value={formData.vehicleModel}
                                                onChange={e => setFormData({...formData, vehicleModel: e.target.value})}
                                                style={{ width: '100%', padding: '1rem', borderRadius: '0.75rem', backgroundColor: '#0f172a', border: '1px solid #334155', color: 'white', fontSize: '1rem' }}
                                            />
                                        </div>
                                    </div>
                                    <div style={{ marginBottom: '1.5rem' }}>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8', fontSize: '0.9rem' }}>Tablilla (Placa)</label>
                                        <input 
                                            required
                                            type="text" 
                                            placeholder="ABC 123"
                                            value={formData.vehiclePlate}
                                            onChange={e => setFormData({...formData, vehiclePlate: e.target.value})}
                                            style={{ width: '100%', padding: '1rem', borderRadius: '0.75rem', backgroundColor: '#0f172a', border: '1px solid #334155', color: 'white', fontSize: '1rem' }}
                                        />
                                    </div>
                                </form>
                            </div>

                            <div style={{ flex: 1, minWidth: '300px', backgroundColor: '#0f172a', padding: '2.5rem', borderRadius: '1.5rem', border: '1px solid #334155' }}>
                                <div style={{ marginBottom: '2rem' }}>
                                    <h4 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '1rem' }}>Resumen de Suscripción</h4>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                        <span style={{ color: '#94a3b8' }}>Plan</span>
                                        <span style={{ fontWeight: 'bold' }}>{selectedPlan.name}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                        <span style={{ color: '#94a3b8' }}>Precio</span>
                                        <span style={{ fontWeight: 'bold', color: '#3b82f6' }}>${selectedPlan.price}/mes</span>
                                    </div>
                                </div>

                                <div style={{ marginBottom: '2.5rem', padding: '1.5rem', backgroundColor: '#1e293b', borderRadius: '1rem', border: '1px solid #334155' }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                                        <Info size={20} color="#3b82f6" style={{ marginTop: '0.2rem', flexShrink: 0 }} />
                                        <p style={{ fontSize: '0.85rem', color: '#94a3b8', lineHeight: '1.5' }}>
                                            Al suscribirte, podrás ver tus lavados y puntos en el portal. No hay contratos a largo plazo, puedes cancelar cuando quieras.
                                        </p>
                                    </div>
                                </div>

                                <button 
                                    onClick={handleDownloadTerms}
                                    style={{ 
                                        width: '100%', 
                                        padding: '1rem', 
                                        borderRadius: '0.75rem', 
                                        border: '1px solid #3b82f6', 
                                        backgroundColor: 'transparent', 
                                        color: '#3b82f6', 
                                        fontWeight: 'bold', 
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.5rem',
                                        marginBottom: '1rem'
                                    }}
                                >
                                    <Download size={18} /> Descargar Términos y Condiciones
                                </button>

                                <button 
                                    form="sub-form"
                                    type="submit"
                                    disabled={submitting}
                                    style={{ 
                                        width: '100%', 
                                        padding: '1.2rem', 
                                        borderRadius: '0.75rem', 
                                        border: 'none', 
                                        backgroundColor: '#3b82f6', 
                                        color: 'white', 
                                        fontWeight: '900', 
                                        fontSize: '1.1rem',
                                        cursor: submitting ? 'not-allowed' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.75rem',
                                        boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.4)',
                                        opacity: submitting ? 0.7 : 1
                                    }}
                                >
                                    {submitting ? 'Procesando...' : (
                                        <>Unirse Ahora <ChevronRight size={20} /></>
                                    )}
                                </button>
                                <p style={{ textAlign: 'center', fontSize: '0.75rem', color: '#64748b', marginTop: '1rem' }}>
                                    Confirmarás tu suscripción pagando en el carwash.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default MembershipSubscribe;
