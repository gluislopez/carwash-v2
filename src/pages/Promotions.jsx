import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Plus, Trash2, Send, MessageSquare, Search, Users, Edit2, Save, X } from 'lucide-react';

const Promotions = () => {
    const [activeTab, setActiveTab] = useState('templates'); // 'templates' | 'campaign'
    const [templates, setTemplates] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);

    // Template Form State
    const [isEditing, setIsEditing] = useState(false);
    const [currentTemplate, setCurrentTemplate] = useState({ title: '', message: '' });

    // Campaign State
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        // Fetch Templates
        const { data: templatesData } = await supabase.from('promotions').select('*').order('created_at', { ascending: false });
        if (templatesData) setTemplates(templatesData);

        // Fetch Customers for Campaign
        const { data: customersData } = await supabase.from('customers').select('*').order('name');
        if (customersData) setCustomers(customersData);
        setLoading(false);
    };

    const handleSaveTemplate = async () => {
        if (!currentTemplate.title || !currentTemplate.message) return alert("Título y mensaje requeridos.");

        if (currentTemplate.id) {
            // Update
            await supabase.from('promotions').update({
                title: currentTemplate.title,
                message: currentTemplate.message
            }).eq('id', currentTemplate.id);
        } else {
            // Create
            await supabase.from('promotions').insert([currentTemplate]);
        }

        setIsEditing(false);
        setCurrentTemplate({ title: '', message: '' });
        fetchData();
    };

    const handleDeleteTemplate = async (id) => {
        if (confirm("¿Borrar plantilla?")) {
            await supabase.from('promotions').delete().eq('id', id);
            fetchData();
        }
    };

    const handleSendWhatsApp = (customer) => {
        if (!selectedTemplateId) return alert("Selecciona una plantilla primero.");

        const template = templates.find(t => t.id === selectedTemplateId);
        if (!template) return;

        let msg = template.message;

        // Dynamic Variable Replacement
        const firstName = customer.name ? customer.name.split(' ')[0] : 'Cliente';
        msg = msg.replace('{nombre}', firstName);

        const phone = customer.phone.replace(/\D/g, '');
        if (!phone) return alert("Cliente sin teléfono válido.");

        const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(msg)}`;
        window.open(url, '_blank');
    };

    // Filter Customers
    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.phone && c.phone.includes(searchTerm))
    );

    return (
        <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', color: 'var(--text-primary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                <div style={{ padding: '0.75rem', backgroundColor: 'var(--primary)', borderRadius: '0.5rem', color: 'white' }}>
                    <MessageSquare size={24} />
                </div>
                <div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>Promociones y Marketing</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Gestiona y envía campañas por WhatsApp.</p>
                </div>
            </div>

            {/* TABS */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--border-color)' }}>
                <button
                    onClick={() => setActiveTab('templates')}
                    style={{
                        padding: '1rem', border: 'none', background: 'none', cursor: 'pointer',
                        fontWeight: 'bold', color: activeTab === 'templates' ? 'var(--primary)' : 'var(--text-muted)',
                        borderBottom: activeTab === 'templates' ? '3px solid var(--primary)' : 'none'
                    }}
                >
                    1. Plantillas
                </button>
                <button
                    onClick={() => setActiveTab('campaign')}
                    style={{
                        padding: '1rem', border: 'none', background: 'none', cursor: 'pointer',
                        fontWeight: 'bold', color: activeTab === 'campaign' ? 'var(--primary)' : 'var(--text-muted)',
                        borderBottom: activeTab === 'campaign' ? '3px solid var(--primary)' : 'none'
                    }}
                >
                    2. Enviar Campaña
                </button>
                <button
                    onClick={() => setActiveTab('portal')}
                    style={{
                        padding: '1rem', border: 'none', background: 'none', cursor: 'pointer',
                        fontWeight: 'bold', color: activeTab === 'portal' ? 'var(--primary)' : 'var(--text-muted)',
                        borderBottom: activeTab === 'portal' ? '3px solid var(--primary)' : 'none'
                    }}
                >
                    3. Anuncio en Portal 🆕
                </button>
            </div>

            {/* TAB CONTENT: PORTAL ANNOUNCEMENT */}
            {activeTab === 'portal' && <PortalAnnouncement />}

            {/* TAB CONTENT: TEMPLATES */}
            {activeTab === 'templates' && (
                <div>
                    {!isEditing ? (
                        <div>
                            <button
                                onClick={() => { setCurrentTemplate({ title: '', message: '' }); setIsEditing(true); }}
                                className="btn-primary"
                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', padding: '0.75rem 1.5rem', borderRadius: '0.5rem', backgroundColor: 'var(--primary)', color: 'white', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
                            >
                                <Plus size={20} /> Nueva Plantilla
                            </button>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                                {templates.map(t => (
                                    <div key={t.id} style={{ backgroundColor: 'var(--bg-card)', padding: '1.5rem', borderRadius: '0.75rem', border: '1px solid var(--border-color)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                            <h3 style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{t.title}</h3>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <button onClick={() => { setCurrentTemplate(t); setIsEditing(true); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><Edit2 size={18} /></button>
                                                <button onClick={() => handleDeleteTemplate(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)' }}><Trash2 size={18} /></button>
                                            </div>
                                        </div>
                                        <div style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '0.5rem', fontSize: '0.9rem', whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>
                                            {t.message}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div style={{ maxWidth: '600px', backgroundColor: 'var(--bg-card)', padding: '2rem', borderRadius: '1rem', border: '1px solid var(--border-color)' }}>
                            <h3 style={{ marginBottom: '1.5rem', fontSize: '1.2rem', fontWeight: 'bold' }}>{currentTemplate.id ? 'Editar' : 'Nueva'} Plantilla</h3>

                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Título (Interno)</label>
                                <input
                                    type="text"
                                    value={currentTemplate.title}
                                    onChange={e => setCurrentTemplate({ ...currentTemplate, title: e.target.value })}
                                    placeholder="Ej. Promo Verano"
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                                />
                            </div>

                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Mensaje</label>
                                <textarea
                                    value={currentTemplate.message}
                                    onChange={e => setCurrentTemplate({ ...currentTemplate, message: e.target.value })}
                                    placeholder="Hola {nombre}, aprovecha nuestro descuento..."
                                    rows={8}
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontFamily: 'inherit' }}
                                />
                                <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '0.5rem' }}>Tip: Usa <b>{"{nombre}"}</b> para insertar el nombre del cliente automáticamente.</small>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                <button onClick={() => setIsEditing(false)} style={{ padding: '0.75rem 1.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}>Cancelar</button>
                                <button onClick={handleSaveTemplate} style={{ padding: '0.75rem 1.5rem', borderRadius: '0.5rem', border: 'none', backgroundColor: 'var(--success)', color: 'white', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Save size={18} /> Guardar
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* TAB CONTENT: CAMPAIGN */}
            {activeTab === 'campaign' && (
                <div>
                    <div style={{ marginBottom: '2rem', padding: '1.5rem', backgroundColor: 'var(--bg-card)', borderRadius: '1rem', border: '1px solid var(--border-color)' }}>
                        <h3 style={{ marginBottom: '1rem', fontWeight: 'bold' }}>Configurar Envío</h3>
                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                            <div style={{ flex: 1, minWidth: '300px' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Selecciona Plantilla</label>
                                <select
                                    value={selectedTemplateId}
                                    onChange={e => setSelectedTemplateId(e.target.value)}
                                    style={{ width: '100%', padding: '0.8rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                                >
                                    <option value="">-- Seleccionar --</option>
                                    {templates.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                                </select>
                            </div>
                            <div style={{ flex: 1, minWidth: '300px' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Buscar Cliente</label>
                                <div style={{ position: 'relative' }}>
                                    <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    <input
                                        type="text"
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        placeholder="Nombre o teléfono..."
                                        style={{ width: '100%', padding: '0.8rem 0.8rem 0.8rem 3rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '1rem', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>
                                <tr>
                                    <th style={{ padding: '1rem', textAlign: 'left' }}>Cliente</th>
                                    <th style={{ padding: '1rem', textAlign: 'left' }}>Teléfono</th>
                                    <th style={{ padding: '1rem', textAlign: 'left' }}>Puntos</th>
                                    <th style={{ padding: '1rem', textAlign: 'right' }}>Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCustomers.slice(0, 50).map(customer => (
                                    <tr key={customer.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ fontWeight: 'bold' }}>{customer.name}</div>
                                            <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>{customer.vehicle_model || 'N/A'}</div>
                                        </td>
                                        <td style={{ padding: '1rem' }}>{customer.phone}</td>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ display: 'inline-block', padding: '0.2rem 0.5rem', borderRadius: '4px', backgroundColor: 'var(--bg-secondary)', fontSize: '0.8rem' }}>
                                                {customer.points || 0} pts
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'right' }}>
                                            <button
                                                onClick={() => handleSendWhatsApp(customer)}
                                                disabled={!selectedTemplateId}
                                                style={{
                                                    padding: '0.5rem 1rem', borderRadius: '0.5rem', border: 'none',
                                                    backgroundColor: selectedTemplateId ? '#25D366' : 'var(--bg-secondary)',
                                                    color: selectedTemplateId ? 'white' : 'var(--text-muted)',
                                                    cursor: selectedTemplateId ? 'pointer' : 'not-allowed',
                                                    display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold'
                                                }}
                                            >
                                                <Send size={16} /> Enviar
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {filteredCustomers.length === 0 && (
                                    <tr>
                                        <td colSpan="4" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No se encontraron clientes.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                        {filteredCustomers.length > 50 && (
                            <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                Mostrando primeros 50 de {filteredCustomers.length} resultados. Usa el buscador.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const PortalAnnouncement = () => {
    const [message, setMessage] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        fetchCurrentMessage();
    }, []);

    const fetchCurrentMessage = async () => {
        const { data } = await supabase
            .from('business_settings')
            .select('setting_value')
            .eq('setting_key', 'portal_message')
            .single();
        if (data) setMessage(data.setting_value);
    };

    const handleSave = async () => {
        setIsSaving(true);
        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Puerto_Rico' });

        const { error } = await supabase
            .from('business_settings')
            .upsert([
                { setting_key: 'portal_message', setting_value: message },
                { setting_key: 'portal_message_date', setting_value: today }
            ], { onConflict: 'setting_key' });

        setIsSaving(false);
        if (error) alert("Error al guardar: " + error.message);
        else alert("¡Mensaje publicado! Se borrará automáticamente al finalizar el día.");
    };

    return (
        <div style={{ maxWidth: '600px', backgroundColor: 'var(--bg-card)', padding: '2rem', borderRadius: '1rem', border: '1px solid var(--border-color)' }}>
            <h3 style={{ marginBottom: '1rem', fontWeight: 'bold' }}>Anuncio Global en Portal</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                Este mensaje aparecerá en la parte superior del portal de <b>todos</b> tus clientes.
                Ideal para avisar cambios de horario, cierres por lluvia o avisos importantes.
            </p>

            <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Ej: Hoy cerraremos a las 12:00 MD por mantenimiento."
                rows={4}
                style={{ width: '100%', padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontFamily: 'inherit', marginBottom: '1.5rem' }}
            />

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    style={{ padding: '0.75rem 2rem', borderRadius: '0.5rem', border: 'none', backgroundColor: 'var(--primary)', color: 'white', fontWeight: 'bold', cursor: 'pointer', opacity: isSaving ? 0.7 : 1 }}
                >
                    {isSaving ? 'Guardando...' : 'Publicar en Portal'}
                </button>
                <button
                    onClick={() => setMessage('')}
                    style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.9rem' }}
                >
                    Limpiar Mensaje
                </button>
            </div>

            {message && (
                <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Vista previa en el portal:</p>
                    <div style={{ backgroundColor: '#fef9c3', color: '#854d0e', padding: '1rem', borderRadius: '0.5rem', borderLeft: '5px solid #eab308', fontSize: '0.95rem', fontWeight: '500' }}>
                        📢 {message}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Promotions;
