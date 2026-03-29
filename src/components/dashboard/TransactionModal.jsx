import React from 'react';
import { useDashboard } from '../../context/DashboardContext';
import { X, UserPlus, Search, Car, ChevronRight, CheckCircle2, CreditCard, DollarSign } from 'lucide-react';

const TransactionModal = () => {
    const {
        isModalOpen, setIsModalOpen,
        formData, setFormData,
        services, customers, vehicles,
        isSubmitting, setIsSubmitting,
        handleCustomerSelect,
        customerSearch, setCustomerSearch,
        showCustomerSearch, setShowCustomerSearch,
        isAddingCustomer, setIsAddingCustomer,
        newCustomer, setNewCustomer,
        handleCreateCustomer,
        handleSubmit,
        handleRemoveExtra,
        myEmployeeId,
    } = useDashboard();

    if (!isModalOpen) return null;

    const sortedServices = [...services].sort((a, b) => a.name.localeCompare(b.name));

    // Helper to add extra services
    const addExtra = (service) => {
        const newExtras = [...(formData.extras || []), {
            serviceId: service.id,
            description: service.name,
            price: service.price,
            assignedTo: myEmployeeId
        }];
        
        const mainService = services.find(s => String(s.id) === String(formData.serviceId));
        const mainPrice = mainService ? (parseFloat(mainService.price) || 0) : 0;
        const extrasTotal = newExtras.reduce((sum, current) => sum + (parseFloat(current.price) || 0), 0);
        
        setFormData({
            ...formData,
            extras: newExtras,
            price: mainPrice + extrasTotal
        });
    };

    return (
        <div 
            style={{ 
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
                backgroundColor: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(16px)',
                zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
                padding: '16px', overflowY: 'auto'
            }}
            onClick={() => setIsModalOpen(false)}
        >
            <div 
                style={{ 
                    backgroundColor: '#09090b', width: '100%', maxWidth: '580px', 
                    borderRadius: '28px', border: '1px solid rgba(255,255,255,0.08)', 
                    boxShadow: '0 30px 60px -12px rgba(0,0,0,1)',
                    marginTop: '40px', marginBottom: '40px',
                    position: 'relative', overflow: 'hidden'
                }} 
                onClick={e => e.stopPropagation()}
            >
                {/* Visual Accent */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, #6366f1, #a855f7)' }}></div>

                {/* Header */}
                <div style={{ padding: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900, color: 'white', letterSpacing: '-0.02em' }}>REGISTRAR SERVICIO</h2>
                        <p style={{ margin: '4px 0 0 0', fontSize: '10px', color: '#6366f1', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Versión v4.69 • Cola de Espera</p>
                    </div>
                    <button 
                        onClick={() => setIsModalOpen(false)}
                        style={{ width: '36px', height: '36px', borderRadius: '50%', border: 'none', backgroundColor: 'rgba(255,255,255,0.05)', color: '#666', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                        <X size={18} />
                    </button>
                </div>

                <div style={{ padding: '24px' }}>
                    {/* PASO 1: CLIENTE */}
                    <div style={{ marginBottom: '32px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                            <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#6366f1', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 900 }}>1</div>
                            <span style={{ fontSize: '11px', fontWeight: 900, color: 'white', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Identificar Cliente y Vehículo</span>
                        </div>

                        {!formData.customerId && !isAddingCustomer && !showCustomerSearch ? (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowCustomerSearch(true)}
                                    style={{ height: '110px', borderRadius: '20px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', color: 'white', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
                                    className="hover:bg-indigo-500/10 hover:border-indigo-500/30 transition-all active:scale-95"
                                >
                                    <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8' }}>
                                        <Search size={22} />
                                    </div>
                                    <span style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase' }}>BUSCAR CLIENTE</span>
                                </button>
                                
                                <button
                                    type="button"
                                    onClick={() => setIsAddingCustomer(true)}
                                    style={{ height: '110px', borderRadius: '20px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', color: 'white', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
                                    className="hover:bg-emerald-500/10 hover:border-emerald-500/30 transition-all active:scale-95"
                                >
                                    <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#34d399' }}>
                                        <UserPlus size={22} />
                                    </div>
                                    <span style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase' }}>NUEVO CLIENTE</span>
                                </button>
                            </div>
                        ) : (
                            <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                    <span style={{ fontSize: '10px', fontWeight: 900, color: '#444', textTransform: 'uppercase' }}>
                                        {isAddingCustomer ? 'NUEVO CLIENTE' : showCustomerSearch ? 'BUSCANDO...' : 'CLIENTE SELECCIONADO'}
                                    </span>
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            setFormData({...formData, customerId: '', vehicleId: ''});
                                            setIsAddingCustomer(false);
                                            setShowCustomerSearch(false);
                                        }}
                                        style={{ background: 'none', border: 'none', color: '#6366f1', fontSize: '9px', fontWeight: 900, cursor: 'pointer', textDecoration: 'underline' }}
                                    >
                                        CANCELAR / REGRESAR
                                    </button>
                                </div>

                                {/* SEARCH MODE */}
                                {showCustomerSearch && !formData.customerId && (
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type="text"
                                            style={{ width: '100%', height: '44px', backgroundColor: 'black', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '0 16px', color: 'white', outline: 'none', fontSize: '13px' }}
                                            placeholder="Buscar por Nombre o Placa..."
                                            value={customerSearch}
                                            onChange={(e) => setCustomerSearch(e.target.value)}
                                            autoFocus
                                        />
                                        {customerSearch.length > 0 && (
                                            <div style={{ position: 'absolute', top: '50px', left: 0, right: 0, backgroundColor: '#09090b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', overflow: 'hidden', zIndex: 100, maxHeight: '200px', overflowY: 'auto' }}>
                                                {customers.filter(c => {
                                                    const term = customerSearch.toLowerCase();
                                                    return (c.name || '').toLowerCase().includes(term) || (c.vehicle_plate || '').toLowerCase().includes(term);
                                                }).map(c => (
                                                    <div 
                                                        key={c.id} 
                                                        onClick={() => {
                                                            const vId = vehicles.find(v => v.customer_id == c.id)?.id || '';
                                                            setFormData({...formData, customerId: c.id, vehicleId: vId});
                                                            handleCustomerSelect(c.id, vId);
                                                            setShowCustomerSearch(false);
                                                        }}
                                                        style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                                        className="hover:bg-indigo-500/10"
                                                    >
                                                        <div>
                                                            <div style={{ fontSize: '13px', fontWeight: 700, color: 'white' }}>{c.name}</div>
                                                            <div style={{ fontSize: '10px', color: '#666' }}>{c.vehicle_model}</div>
                                                        </div>
                                                        <div style={{ fontSize: '10px', fontWeight: 900, color: '#818cf8', backgroundColor: 'rgba(99,102,241,0.1)', padding: '4px 8px', borderRadius: '6px' }}>
                                                            {c.vehicle_plate}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* NEW CUSTOMER MODE */}
                                {isAddingCustomer && (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                        <input type="text" style={{ height: '40px', backgroundColor: 'black', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '0 12px', color: 'white', fontSize: '13px' }} placeholder="Nombre completo" value={newCustomer.name} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} />
                                        <input type="text" style={{ height: '40px', backgroundColor: 'black', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '0 12px', color: 'white', fontSize: '13px' }} placeholder="Número de Placa" value={newCustomer.vehicle_plate} onChange={e => setNewCustomer({...newCustomer, vehicle_plate: e.target.value})} />
                                        <input type="text" style={{ height: '40px', backgroundColor: 'black', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '0 12px', color: 'white', fontSize: '13px' }} placeholder="Marca (ej. Toyota)" value={newCustomer.vehicle_brand} onChange={e => setNewCustomer({...newCustomer, vehicle_brand: e.target.value})} />
                                        <input type="text" style={{ height: '40px', backgroundColor: 'black', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '0 12px', color: 'white', fontSize: '13px' }} placeholder="Modelo (ej. Corolla)" value={newCustomer.vehicle_model} onChange={e => setNewCustomer({...newCustomer, vehicle_model: e.target.value})} />
                                        <button 
                                            type="button" 
                                            onClick={handleCreateCustomer}
                                            style={{ gridColumn: 'span 2', height: '48px', backgroundColor: '#10b981', border: 'none', borderRadius: '12px', color: 'black', fontWeight: 900, fontSize: '12px', textTransform: 'uppercase', cursor: 'pointer', marginTop: '8px' }}
                                        >
                                            Guardar Cliente y Avanzar
                                        </button>
                                    </div>
                                )}

                                {/* SELECTED STATE */}
                                {formData.customerId && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', backgroundColor: 'rgba(99,102,241,0.05)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(99,102,241,0.2)' }}>
                                        <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8' }}>
                                            <Car size={24} />
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '14px', fontWeight: 900, color: 'white' }}>{customers.find(c => String(c.id) === String(formData.customerId))?.name}</div>
                                            <div style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase', fontWeight: 900 }}>{vehicles.find(v => String(v.id) === String(formData.vehicleId))?.plate || 'S.P'} • {vehicles.find(v => String(v.id) === String(formData.vehicleId))?.model}</div>
                                        </div>
                                        <div style={{ marginLeft: 'auto' }}>
                                            <CheckCircle2 size={20} color="#10b981" />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* PASO 2: SERVICIOS */}
                    {(formData.customerId || isAddingCustomer) && (
                        <div className="animate-in slide-in-from-bottom-4 duration-500">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                                <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#6366f1', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 900 }}>2</div>
                                <span style={{ fontSize: '11px', fontWeight: 900, color: 'white', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Seleccionar Servicio Principal</span>
                            </div>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px', marginBottom: '24px' }}>
                                {sortedServices.filter(s => !s.is_extra).map(s => (
                                    <button
                                        key={s.id}
                                        type="button"
                                        onClick={() => setFormData({...formData, serviceId: s.id, price: s.price})}
                                        style={{ 
                                            padding: '16px', borderRadius: '16px', border: '2px solid',
                                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                                            cursor: 'pointer', transition: 'all 0.2s',
                                            backgroundColor: String(formData.serviceId) === String(s.id) ? 'rgba(99,102,241,0.1)' : 'black',
                                            borderColor: String(formData.serviceId) === String(s.id) ? '#6366f1' : 'rgba(255,255,255,0.05)',
                                            color: 'white'
                                        }}
                                        className="hover:border-indigo-500/30 active:scale-95"
                                    >
                                        <span style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', opacity: String(formData.serviceId) === String(s.id) ? 1 : 0.5 }}>{s.name}</span>
                                        <div style={{ fontSize: '16px', fontWeight: 900 }}>${s.price}</div>
                                    </button>
                                ))}
                            </div>

                            {/* EXTRAS */}
                            <div style={{ marginBottom: '32px' }}>
                                <div style={{ fontSize: '10px', fontWeight: 900, color: '#444', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.05em' }}>EXTRAS (OPCIONALES)</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {services.filter(s => s.is_extra).map(extra => (
                                        <button
                                            key={extra.id}
                                            type="button"
                                            onClick={() => addExtra(extra)}
                                            style={{ padding: '8px 14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.03)', color: '#999', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer' }}
                                            className="hover:text-white hover:bg-white/10 active:scale-95"
                                        >
                                            + {extra.name} (${extra.price})
                                        </button>
                                    ))}
                                </div>
                                
                                {formData.extras?.length > 0 && (
                                    <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {formData.extras.map((ex, idx) => (
                                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.01)', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#6366f1' }}></div>
                                                    <span style={{ fontSize: '11px', fontWeight: 800, color: 'white', textTransform: 'uppercase' }}>{ex.description}</span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <span style={{ fontSize: '11px', fontWeight: 900, color: '#6366f1' }}>${ex.price}</span>
                                                    <button type="button" onClick={() => handleRemoveExtra(idx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex' }}>
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* TOTAL & SUBMIT */}
                            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '24px', display: 'flex', alignItems: 'stretch', gap: '12px' }}>
                                <div style={{ flex: 1, backgroundColor: 'rgba(99,102,241,0.05)', borderRadius: '20px', padding: '12px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                    <div style={{ fontSize: '9px', fontWeight: 900, color: '#6366f1', textTransform: 'uppercase' }}>Total Estimado</div>
                                    <div style={{ fontSize: '28px', fontWeight: 900, color: 'white' }}>${formData.price || 0}</div>
                                </div>
                                
                                <form onSubmit={handleSubmit} style={{ flex: 1.5 }}>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting || !formData.customerId || !formData.serviceId}
                                        style={{ width: '100%', height: '100%', borderRadius: '20px', backgroundColor: '#6366f1', border: 'none', color: 'white', fontWeight: 900, fontSize: '14px', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.2s', opacity: (isSubmitting || !formData.customerId || !formData.serviceId) ? 0.3 : 1 }}
                                        className="hover:bg-indigo-500 shadow-xl shadow-indigo-500/20 active:scale-95"
                                    >
                                        {isSubmitting ? 'REGISTRANDO...' : 'REGISTRAR SERVICIO'}
                                    </button>
                                </form>
                            </div>
                            <p style={{ textAlign: 'center', fontSize: '9px', color: '#444', textTransform: 'uppercase', fontWeight: 900, marginTop: '16px', letterSpacing: '0.05em' }}>
                                El servicio se añadirá a la cola "En Espera". Los empleados se asignan al comenzar.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TransactionModal;
