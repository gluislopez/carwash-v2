import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit, Phone, Mail, Car, Search, QrCode, X, MessageCircle, History, ExternalLink, Share2 } from 'lucide-react';
import useSupabase from '../hooks/useSupabase';
import { supabase } from '../supabase';
import QRCode from 'react-qr-code';

const Customers = () => {
    const { data: customers, create, remove, update } = useSupabase('customers', '*', { orderBy: { column: 'name', ascending: true } });
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [userRole, setUserRole] = useState(null);
    const [editingCustomer, setEditingCustomer] = useState(null);
    const [customerVehicles, setCustomerVehicles] = useState([]); // State for vehicles in modal
    const [newVehicle, setNewVehicle] = useState({ plate: '', model: '', brand: '' });
    const [selectedQrCustomer, setSelectedQrCustomer] = useState(null); // State for QR Modal
    const [isStatsModalOpen, setIsStatsModalOpen] = useState(false); // State for Stats Modal
    const [statsFormData, setStatsFormData] = useState({ points: 0, manual_visit_count: 0 });

    // Search and Stats State
    const [searchTerm, setSearchTerm] = useState('');
    const [visitCounts, setVisitCounts] = useState({});
    const [activeMemberships, setActiveMemberships] = useState({});
    const [availablePlans, setAvailablePlans] = useState([]);

    // HISTORY MODAL STATE
    const [selectedHistoryCustomer, setSelectedHistoryCustomer] = useState(null);
    const [customerHistory, setCustomerHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    const openHistory = async (customer) => {
        setSelectedHistoryCustomer(customer);
        setLoadingHistory(true);
        setCustomerHistory([]);
        try {
            const { data, error } = await supabase
                .from('transactions')
                .select(`
                    *,
                    services(name),
                    vehicles(plate, model),
                    customers(vehicle_plate, vehicle_model)
                `)
                .eq('customer_id', customer.id)
                .order('date', { ascending: false });

            if (error) throw error;
            setCustomerHistory(data || []);
        } catch (error) {
            console.error('Error fetching history:', error);
        } finally {
            setLoadingHistory(false);
        }
    };

    // DUPLICATE DETECTION STATE
    const [duplicateGroups, setDuplicateGroups] = useState([]);
    const [isScanning, setIsScanning] = useState(false);
    const [showDuplicateResults, setShowDuplicateResults] = useState(false);

    const handleScanDuplicates = () => {
        setIsScanning(true);
        const groups = [];
        const processedIds = new Set();

        customers.forEach(c1 => {
            if (processedIds.has(c1.id)) return;

            const group = [c1];
            const cleanName1 = c1.name.trim().toLowerCase();
            const cleanPhone1 = c1.phone ? c1.phone.replace(/\D/g, '') : null;

            customers.forEach(c2 => {
                if (c1.id === c2.id || processedIds.has(c2.id)) return;

                const cleanName2 = c2.name.trim().toLowerCase();
                const cleanPhone2 = c2.phone ? c2.phone.replace(/\D/g, '') : null;

                const nameMatch = cleanName1 === cleanName2 && cleanName1 !== '';
                const phoneMatch = cleanPhone1 && cleanPhone2 && cleanPhone1 === cleanPhone2;

                if (nameMatch || phoneMatch) {
                    group.push(c2);
                    processedIds.add(c2.id);
                }
            });

            if (group.length > 1) {
                processedIds.add(c1.id);
                groups.push({
                    reason: cleanName1 === group[1].name.trim().toLowerCase() ? 'Nombre Idéntico' : 'Teléfono Idéntico',
                    customers: group
                });
            }
        });

        setDuplicateGroups(groups);
        setShowDuplicateResults(true);
        setIsScanning(false);
    };

    const handleMergeCustomers = async (keepCustomer, duplicates) => {
        const duplicateIds = duplicates.map(d => d.id);
        const confirmMsg = `¿Estás seguro de fusionar estos ${duplicates.length + 1} registros?\n\nSe mantendrá a: ${keepCustomer.name}\nSe eliminarán los otros y sus vehículos/ventas se moverán a este cliente.\n\nESTA ACCIÓN NO SE PUEDE DESHACER.`;

        if (!window.confirm(confirmMsg)) return;

        setIsScanning(true);
        try {
            // 1. Move Vehicles
            const { error: vErr } = await supabase
                .from('vehicles')
                .update({ customer_id: keepCustomer.id })
                .in('customer_id', duplicateIds);
            if (vErr) throw vErr;

            // 2. Move Transactions
            const { error: tErr } = await supabase
                .from('transactions')
                .update({ customer_id: keepCustomer.id })
                .in('customer_id', duplicateIds);
            if (tErr) throw tErr;

            // 3. Move Memberships
            await supabase
                .from('customer_memberships')
                .update({ customer_id: keepCustomer.id })
                .in('customer_id', duplicateIds);

            // 4. Move Feedback
            await supabase
                .from('customer_feedback')
                .update({ customer_id: keepCustomer.id })
                .in('customer_id', duplicateIds);

            // 5. Delete Duplicates
            const { error: dErr } = await supabase
                .from('customers')
                .delete()
                .in('id', duplicateIds);
            if (dErr) throw dErr;

            alert('✅ Fusión completada con éxito.');
            setShowDuplicateResults(false);
            window.location.reload(); // Quickest way to refresh all complex state (visit counts, memberships, etc)
        } catch (error) {
            console.error('Merge error:', error);
            alert('Error al fusionar: ' + error.message);
        } finally {
            setIsScanning(false);
        }
    };

    // Obtener el rol del usuario actual y conteo de visitas
    useEffect(() => {
        const getUserRole = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: employee } = await supabase.from('employees').select('role').eq('user_id', user.id).single();
                if (employee) setUserRole(employee.role);
            }
        };

        const getVisitCounts = async () => {
            const { data: transactions } = await supabase
                .from('transactions')
                .select('customer_id');

            if (transactions) {
                const counts = {};
                transactions.forEach(t => {
                    if (t.customer_id) {
                        counts[t.customer_id] = (counts[t.customer_id] || 0) + 1;
                    }
                });
                setVisitCounts(counts);
            }
        };

        const getMemberships = async () => {
            const { data: memberData } = await supabase
                .from('customer_memberships')
                .select('*, memberships(name, type)')
                .eq('status', 'active');

            if (memberData) {
                const map = {};
                memberData.forEach(m => {
                    map[m.customer_id] = m;
                });
                setActiveMemberships(map);
            }

            const { data: plans } = await supabase
                .from('memberships')
                .select('*')
                .eq('active', true);
            if (plans) setAvailablePlans(plans);
        };

        getUserRole();
        getVisitCounts();
        getMemberships();
    }, []);

    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        email: '',
        vehicle_plate: '',
        vehicle_model: '',
        points: 0,
        membership_id: ''
    });

    const openModal = async (customer) => {
        const activeSub = customer ? activeMemberships[customer.id] : null;

        if (customer) {
            setEditingCustomer(customer);
            // Fetch Vehicles
            const { data: vData } = await supabase.from('vehicles').select('*').eq('customer_id', customer.id);
            setCustomerVehicles(vData || []);

            setFormData({
                name: customer.name,
                phone: customer.phone || '',
                email: customer.email || '',
                vehicle_plate: '', // Reset new vehicle inputs
                vehicle_model: '',
                points: customer.points || 0,
                membership_id: activeSub ? activeSub.membership_id : ''
            });
        } else {
            setEditingCustomer(null);
            setCustomerVehicles([]);
            setFormData({ name: '', phone: '', email: '', vehicle_plate: '', vehicle_model: '', points: 0, membership_id: '' });
        }
        setIsModalOpen(true);
    };

    const handleAddVehicle = async () => {
        if (!newVehicle.plate || !newVehicle.model) return alert('Placa y Modelo son requeridos');

        try {
            const { data, error } = await supabase.from('vehicles').insert([{
                customer_id: editingCustomer.id,
                plate: newVehicle.plate.toUpperCase(),
                model: newVehicle.model,
                brand: newVehicle.brand || ''
            }]).select();

            if (error) throw error;

            setCustomerVehicles([...customerVehicles, data[0]]);
            setNewVehicle({ plate: '', model: '', brand: '' });
        } catch (error) {
            alert('Error al añadir vehículo: ' + error.message);
        }
    };

    const handleDeleteVehicle = async (id) => {
        if (!window.confirm('¿Eliminar vehículo?')) return;
        try {
            await supabase.from('vehicles').delete().eq('id', id);
            setCustomerVehicles(customerVehicles.filter(v => v.id !== id));
        } catch (error) {
            alert('Error al eliminar vehículo: ' + error.message);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const { membership_id, ...pureCustomerData } = formData;
            const customerData = {
                ...pureCustomerData,
                email: formData.email.trim() === '' ? null : formData.email.trim()
            };

            if (editingCustomer) {
                await update(editingCustomer.id, customerData);
                // Handle Membership Assignment
                if (formData.membership_id) {
                    await supabase.from('customer_memberships').upsert({
                        customer_id: editingCustomer.id,
                        membership_id: formData.membership_id,
                        status: 'active'
                    }, { onConflict: 'customer_id' }); // Assuming one active membership per customer
                } else {
                    // If empty, we could deactivate or ignore. Let's ignore for now.
                }
            } else {
                const newCustomer = await create(customerData);
                if (newCustomer && formData.membership_id) {
                    await supabase.from('customer_memberships').insert([{
                        customer_id: newCustomer.id,
                        membership_id: formData.membership_id,
                        status: 'active'
                    }]);
                }
            }
            setIsModalOpen(false);
            // Refresh memberships
            const { data: memberData } = await supabase
                .from('customer_memberships')
                .select('*, memberships(name, type)')
                .eq('status', 'active');
            if (memberData) {
                const map = {};
                memberData.forEach(m => map[m.customer_id] = m);
                setActiveMemberships(map);
            }
        } catch (error) {
            alert('Error al guardar cliente: ' + error.message);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('¿Estás seguro de eliminar este cliente?')) {
            await remove(id);
        }
    };

    const openStatsModal = (customer) => {
        setEditingCustomer(customer);
        setStatsFormData({
            points: customer.points || 0,
            manual_visit_count: customer.manual_visit_count || 0
        });
        setIsStatsModalOpen(true);
    };

    const handleStatsSubmit = async (e) => {
        e.preventDefault();
        try {
            await update(editingCustomer.id, {
                points: parseInt(statsFormData.points) || 0,
                manual_visit_count: parseInt(statsFormData.manual_visit_count) || 0
            });
            setIsStatsModalOpen(false);
            setEditingCustomer(null);
        } catch (error) {
            alert('Error al actualizar estadísticas: ' + error.message);
        }
    };

    const handleShare = async (customer) => {
        const url = `${window.location.origin}/portal/${customer.id}`;
        const shareData = {
            title: `Portal de ${customer.name}`,
            text: `Accede al portal de cliente de ${customer.name}`,
            url: url
        };

        if (navigator.share) {
            try {
                await navigator.share(shareData);
            } catch (err) {
                console.error('Error sharing:', err);
            }
        } else {
            try {
                await navigator.clipboard.writeText(url);
                alert('Enlace copiado al portapapeles');
            } catch (err) {
                console.error('Failed to copy:', err);
                alert('No se pudo copiar el enlace.');
            }
        }
    };

    // Filter customers
    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.vehicle_plate && c.vehicle_plate.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (c.phone && c.phone.includes(searchTerm))
    );

    return (
        <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1 style={{ fontSize: '1.875rem', marginBottom: '0.5rem' }}>Clientes</h1>
                        <p style={{ color: 'var(--text-muted)' }}>Directorio de clientes y vehículos</p>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {userRole === 'admin' && (
                            <button
                                className="btn"
                                onClick={handleScanDuplicates}
                                style={{ backgroundColor: 'orange', color: 'black' }}
                                disabled={isScanning}
                            >
                                {isScanning ? 'Escaneando...' : '🔍 Detectar Duplicados'}
                            </button>
                        )}
                        {/* SOLO ADMIN PUEDE CREAR */}
                        {userRole === 'admin' && (
                            <button className="btn btn-primary" onClick={() => openModal()}>
                                <Plus size={20} />
                                Nuevo Cliente
                            </button>
                        )}
                    </div>
                </div>

                {/* SEARCH BAR */}
                <div style={{ position: 'relative', maxWidth: '400px' }}>
                    <Search size={20} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, tablilla o teléfono..."
                        className="input"
                        style={{
                            paddingLeft: '3rem',
                            width: '100%',
                            backgroundColor: 'var(--bg-card)',
                            color: 'white',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-md)',
                            paddingTop: '0.75rem',
                            paddingBottom: '0.75rem'
                        }}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* DUPLICATE RESULTS ALERT */}
                {showDuplicateResults && (
                    <div style={{
                        backgroundColor: 'rgba(255, 165, 0, 0.1)',
                        border: '2px solid orange',
                        padding: '1rem',
                        borderRadius: '0.5rem',
                        animation: 'fadeIn 0.3s'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ color: 'orange', margin: 0 }}>⚠️ Posibles Duplicados Detectados ({duplicateGroups.length})</h3>
                            <button className="btn btn-sm" onClick={() => setShowDuplicateResults(false)} style={{ backgroundColor: 'transparent', color: 'white' }}>
                                <X size={20} />
                            </button>
                        </div>

                        {duplicateGroups.length === 0 ? (
                            <p>No se encontraron duplicados evidentes.</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {duplicateGroups.map((group, idx) => (
                                    <div key={idx} style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '0.4rem', borderLeft: '4px solid orange' }}>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>
                                            Razón: {group.reason}
                                        </div>
                                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                            {group.customers.map(c => (
                                                <div key={c.id} style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.5rem',
                                                    backgroundColor: 'rgba(255,255,255,0.05)',
                                                    padding: '0.4rem 0.6rem',
                                                    borderRadius: '4px'
                                                }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                        <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{c.name}</span>
                                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.phone || 'Sin tel'}</span>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                                                        <button
                                                            onClick={() => openModal(c)}
                                                            className="btn btn-sm"
                                                            style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem', backgroundColor: 'var(--bg-secondary)' }}
                                                        >
                                                            Editar
                                                        </button>
                                                        <button
                                                            onClick={() => handleMergeCustomers(c, group.customers.filter(other => other.id !== c.id))}
                                                            className="btn btn-sm"
                                                            style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem', backgroundColor: 'var(--primary)', color: 'white' }}
                                                            title="Mantener este y fusionar el resto"
                                                        >
                                                            Mantener este
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                                <p style={{ fontSize: '0.8rem', color: 'orange', marginTop: '0.5rem', fontWeight: 'bold' }}>
                                    ⚠️ Al presionar "Mantener este", el sistema moverá automáticamente todos sus vehículos y transacciones al perfil seleccionado y borrará los duplicados.
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                {filteredCustomers.map((customer) => (
                    <div key={customer.id} className="card" style={{ position: 'relative' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                            <div style={{
                                width: '50px', height: '50px', borderRadius: '50%',
                                backgroundColor: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <span style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>
                                    {customer.name.charAt(0).toUpperCase()}
                                </span>
                            </div>
                            <div>
                                <h3 style={{ fontWeight: 'bold' }}>{customer.name}</h3>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <span style={{
                                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                                        color: 'var(--primary)',
                                        padding: '0.1rem 0.5rem',
                                        borderRadius: '1rem',
                                        fontWeight: 'bold',
                                        fontSize: '0.8rem'
                                    }}>
                                        {(visitCounts[customer.id] || 0) + (customer.manual_visit_count || 0)} Visitas
                                    </span>
                                    <span style={{
                                        backgroundColor: 'rgba(255, 215, 0, 0.1)',
                                        color: '#D97706',
                                        padding: '0.1rem 0.5rem',
                                        borderRadius: '1rem',
                                        fontWeight: 'bold',
                                        fontSize: '0.8rem',
                                        border: '1px solid rgba(255, 215, 0, 0.3)'
                                    }}>
                                        🌟 {customer.points || 0} Pts
                                    </span>
                                    {(userRole === 'admin' || userRole === 'manager') && (
                                        <button
                                            onClick={() => openStatsModal(customer)}
                                            style={{
                                                background: 'none', border: 'none', cursor: 'pointer',
                                                padding: 0, display: 'flex', alignItems: 'center'
                                            }}
                                            title="Editar Estadísticas"
                                        >
                                            <Edit size={14} color="var(--text-muted)" />
                                        </button>
                                    )}
                                    {activeMemberships[customer.id] && (
                                        <span style={{
                                            backgroundColor: 'rgba(34, 197, 94, 0.1)',
                                            color: '#22C55E',
                                            padding: '0.1rem 0.5rem',
                                            borderRadius: '1rem',
                                            fontWeight: 'bold',
                                            fontSize: '0.8rem',
                                            border: '1px solid rgba(34, 197, 94, 0.3)'
                                        }}>
                                            💎 {activeMemberships[customer.id].memberships.name}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Car size={16} className="text-primary" />
                                <span style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>{customer.vehicle_model}</span>
                                <span style={{ backgroundColor: 'var(--bg-secondary)', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.8rem' }}>
                                    {customer.vehicle_plate}
                                </span>
                            </div>
                            {customer.phone && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Phone size={16} /> {customer.phone}
                                </div>
                            )}
                            {customer.email && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Mail size={16} /> {customer.email}
                                </div>
                            )}
                        </div>

                        {/* ACTIONS - Always visible (View/Share) + Restricted (Edit/Delete) */}
                        <div style={{ position: 'absolute', top: '1rem', right: '1rem', display: 'flex', gap: '0.5rem', zIndex: 10 }}>
                            <button
                                onClick={() => window.open(`/portal/${customer.id}`, '_blank')}
                                style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer' }}
                                title="Ver Portal"
                            >
                                <ExternalLink size={18} />
                            </button>
                            <button
                                onClick={() => handleShare(customer)}
                                style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer' }}
                                title="Compartir Portal"
                            >
                                <Share2 size={18} />
                            </button>

                            {(userRole === 'admin' || userRole === 'manager') && (
                                <>
                                    <button onClick={() => openHistory(customer)} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer' }} title="Ver Historial">
                                        <History size={18} />
                                    </button>
                                    <button onClick={() => setSelectedQrCustomer(customer)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} title="Ver QR">
                                        <QrCode size={18} />
                                    </button>
                                    <button onClick={() => openModal(customer)} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer' }}>
                                        <Edit size={18} />
                                    </button>
                                    {userRole === 'admin' && (
                                        <button onClick={() => handleDelete(customer.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}>
                                            <Trash2 size={18} />
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                ))}
                {
                    filteredCustomers.length === 0 && (
                        <div style={{ gridColumn: '1 / -1', padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                            {searchTerm ? 'No se encontraron clientes.' : 'No hay clientes registrados.'}
                        </div>
                    )
                }
            </div>

            {isModalOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
                }}>
                    <div className="card" style={{ width: '100%', maxWidth: '500px' }}>
                        <h3 style={{ marginBottom: '1.5rem' }}>{editingCustomer ? 'Editar Cliente' : 'Nuevo Cliente'}</h3>
                        <form onSubmit={handleSubmit}>
                            <div style={{ marginBottom: '1rem' }}>
                                <label className="label">Nombre Completo</label>
                                <input
                                    type="text"
                                    className="input"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                <div>
                                    <label className="label">Teléfono</label>
                                    <input
                                        type="tel"
                                        className="input"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="label">Email <span style={{ fontWeight: 'normal', color: 'var(--text-muted)', fontSize: '0.8rem' }}>(Opcional)</span></label>
                                    <input
                                        type="email"
                                        className="input"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    />
                                </div>
                            </div>



                            {/* VEHICLE MANAGEMENT (Only for Existing Customers) */}
                            {editingCustomer && (
                                <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '0.5rem' }}>
                                    <h4 style={{ marginBottom: '0.5rem', borderBottom: '1px solid #444', paddingBottom: '0.5rem' }}>Vehículos Registrados</h4>

                                    {/* List */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                                        {customerVehicles.map(v => (
                                            <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: '4px' }}>
                                                <div>
                                                    <div style={{ fontWeight: 'bold' }}>{v.brand} {v.model}</div>
                                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{v.plate}</div>
                                                </div>
                                                <button type="button" onClick={() => handleDeleteVehicle(v.id)} style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer' }}>
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        ))}
                                        {customerVehicles.length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Sin vehículos.</span>}
                                    </div>

                                    {/* Add New */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '0.5rem', alignItems: 'end' }}>
                                        <div>
                                            <input
                                                className="input"
                                                placeholder="Placa"
                                                value={newVehicle.plate}
                                                onChange={e => setNewVehicle({ ...newVehicle, plate: e.target.value })}
                                                style={{ fontSize: '0.8rem', padding: '0.4rem' }}
                                            />
                                        </div>
                                        <div>
                                            <input
                                                className="input"
                                                placeholder="Modelo"
                                                value={newVehicle.model}
                                                onChange={e => setNewVehicle({ ...newVehicle, model: e.target.value })}
                                                style={{ fontSize: '0.8rem', padding: '0.4rem' }}
                                            />
                                        </div>
                                        <div>
                                            <input
                                                className="input"
                                                placeholder="Marca"
                                                value={newVehicle.brand}
                                                onChange={e => setNewVehicle({ ...newVehicle, brand: e.target.value })}
                                                style={{ fontSize: '0.8rem', padding: '0.4rem' }}
                                            />
                                        </div>
                                        <button type="button" onClick={handleAddVehicle} className="btn btn-primary" style={{ padding: '0.4rem', minWidth: 'auto' }}>
                                            <Plus size={18} />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Legacy Field Warning (Hidden for UX cleanliness, or we could show inputs for New Customer Only) */}
                            {!editingCustomer && (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                    <div>
                                        <label className="label">Modelo Vehículo</label>
                                        <input
                                            type="text"
                                            className="input"
                                            placeholder="Ej. Toyota Corolla"
                                            value={formData.vehicle_model}
                                            onChange={(e) => setFormData({ ...formData, vehicle_model: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="label">Tablilla (Placa)</label>
                                        <input
                                            type="text"
                                            className="input"
                                            placeholder="ABC-123"
                                            value={formData.vehicle_plate}
                                            onChange={(e) => setFormData({ ...formData, vehicle_plate: e.target.value })}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Puntos (Solo Admin/Manager) */}
                            {(userRole === 'admin' || userRole === 'manager') && (
                                <div style={{ marginBottom: '1rem' }}>
                                </div>
                            )}

                            {/* Puntos y Membresía (Solo Admin/Manager) */}
                            {(userRole === 'admin' || userRole === 'manager') && (
                                <>
                                    <div style={{ marginBottom: '1rem' }}>
                                        <label className="label">Puntos de Lealtad</label>
                                        <input
                                            type="number"
                                            className="input"
                                            value={formData.points}
                                            onChange={(e) => setFormData({ ...formData, points: parseInt(e.target.value) || 0 })}
                                        />
                                    </div>
                                    <div style={{ marginBottom: '1rem' }}>
                                        <label className="label">Plan de Membresía</label>
                                        <select
                                            className="input"
                                            value={formData.membership_id}
                                            onChange={(e) => setFormData({ ...formData, membership_id: e.target.value })}
                                            style={{ backgroundColor: 'var(--bg-secondary)', color: 'white' }}
                                        >
                                            <option value="">-- Sin Membresía --</option>
                                            {availablePlans.map(plan => (
                                                <option key={plan.id} value={plan.id}>{plan.name} (${plan.price})</option>
                                            ))}
                                        </select>
                                    </div>
                                </>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                                <button type="button" className="btn" onClick={() => setIsModalOpen(false)} style={{ backgroundColor: 'var(--bg-secondary)', color: 'white' }}>
                                    Cancelar
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    {editingCustomer ? 'Actualizar' : 'Guardar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div >
            )}

            {/* QR CODE MODAL FOR CUSTOMERS */}
            {
                selectedQrCustomer && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 5000
                    }} onClick={() => setSelectedQrCustomer(null)}>
                        <div style={{
                            backgroundColor: 'white', padding: '2rem', borderRadius: '1rem',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem',
                            maxWidth: '90%', width: '350px'
                        }} onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                                <h2 style={{ color: 'black', margin: 0 }}>QR del Cliente</h2>
                                <button onClick={() => setSelectedQrCustomer(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                                    <X color="black" size={24} />
                                </button>
                            </div>

                            <div style={{ padding: '1rem', background: 'white', borderRadius: '0.5rem' }}>
                                {(() => {
                                    const portalUrl = `${window.location.origin}/portal/${selectedQrCustomer.id}`;
                                    const phone = selectedQrCustomer.phone ? selectedQrCustomer.phone.replace(/\D/g, '') : '';
                                    const formattedPhone = phone.length === 10 ? `1${phone}` : phone;
                                    const whatsappMsg = encodeURIComponent(`Hola ${selectedQrCustomer.name.split(' ')[0]}, aquí tienes el enlace a tu portal de cliente en Express CarWash: ${portalUrl}`);
                                    const whatsappUrl = formattedPhone
                                        ? `https://wa.me/${formattedPhone}?text=${whatsappMsg}`
                                        : `https://wa.me/?text=${whatsappMsg}`;

                                    return (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                                            <QRCode value={portalUrl} size={256} />

                                            <div style={{ textAlign: 'center', color: '#333', marginBottom: '0.5rem' }}>
                                                <strong>{selectedQrCustomer.name}</strong>
                                                <div style={{ fontSize: '0.9rem', color: '#666' }}>{selectedQrCustomer.vehicle_model}</div>
                                            </div>

                                            <a
                                                href={whatsappUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="btn btn-primary"
                                                style={{
                                                    backgroundColor: '#25D366',
                                                    border: 'none',
                                                    width: '100%',
                                                    display: 'flex',
                                                    justifyContent: 'center',
                                                    alignItems: 'center',
                                                    gap: '0.5rem',
                                                    textDecoration: 'none',
                                                    color: 'white'
                                                }}
                                            >
                                                <MessageCircle size={20} />
                                                Enviar Link por WhatsApp
                                            </a>
                                        </div>
                                    );
                                })()}
                            </div>

                            <div style={{ color: '#555', textAlign: 'center', fontSize: '0.9rem' }}>
                                <p style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Escanea o envía para acceso al portal</p>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* CUSTOMER HISTORY MODAL */}
            {
                selectedHistoryCustomer && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 5000
                    }} onClick={() => setSelectedHistoryCustomer(null)}>
                        <div className="card" style={{ width: '100%', maxWidth: '600px', maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <h3 style={{ margin: 0 }}>Historial: {selectedHistoryCustomer.name}</h3>
                                <button onClick={() => setSelectedHistoryCustomer(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)' }}>
                                    <X size={24} />
                                </button>
                            </div>

                            {loadingHistory ? (
                                <div style={{ textAlign: 'center', padding: '2rem' }}>Cargando historial...</div>
                            ) : customerHistory.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    {customerHistory.map(tx => (
                                        <div key={tx.id} style={{ padding: '0.75rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                                <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>
                                                    {tx.services?.name || 'Servicio Desconocido'}
                                                </span>
                                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                    {new Date(tx.date).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                                                <span>
                                                    🚗 {tx.vehicles?.plate
                                                        ? `${tx.vehicles.plate} (${tx.vehicles.model || ''})`
                                                        : (tx.customers?.vehicle_plate
                                                            ? `${tx.customers.vehicle_plate} (${tx.customers.vehicle_model || ''})`
                                                            : 'Sin Placa')}
                                                </span>
                                                <span style={{ fontWeight: 'bold' }}>${tx.price}</span>
                                            </div>
                                            <div style={{ marginTop: '0.5rem' }}>
                                                <span className={`badge badge-${tx.status}`} style={{ fontSize: '0.7rem' }}>
                                                    {tx.status.toUpperCase()}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                    No hay servicios registrados para este cliente.
                                </div>
                            )}
                        </div>
                    </div>
                )
            }
            {
                isStatsModalOpen && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
                    }}>
                        <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
                            <h3 style={{ marginBottom: '1.5rem' }}>Editar Estadísticas: {editingCustomer?.name}</h3>
                            <form onSubmit={handleStatsSubmit}>
                                <div style={{ marginBottom: '1rem' }}>
                                    <label className="label">Puntos de Lealtad</label>
                                    <input
                                        type="number"
                                        className="input"
                                        value={statsFormData.points}
                                        onChange={(e) => setStatsFormData({ ...statsFormData, points: e.target.value })}
                                    />
                                </div>
                                <div style={{ marginBottom: '1rem' }}>
                                    <label className="label">Ajuste Manual de Visitas (+/-)</label>
                                    <input
                                        type="number"
                                        className="input"
                                        value={statsFormData.manual_visit_count}
                                        onChange={(e) => setStatsFormData({ ...statsFormData, manual_visit_count: e.target.value })}
                                    />
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                                        Visitas Reales (Transacciones): {visitCounts[editingCustomer?.id] || 0}<br />
                                        Total Mostrado: {(visitCounts[editingCustomer?.id] || 0) + (parseInt(statsFormData.manual_visit_count) || 0)}
                                    </p>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                                    <button type="button" className="btn" onClick={() => setIsStatsModalOpen(false)} style={{ backgroundColor: 'var(--bg-secondary)', color: 'white' }}>
                                        Cancelar
                                    </button>
                                    <button type="submit" className="btn btn-primary">
                                        Guardar Cambios
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default Customers;
