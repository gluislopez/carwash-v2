import React from 'react';
import { useDashboard } from '../../context/DashboardContext';
import { X, Trash2, Car, Plus, RefreshCw, Smartphone, Mail, UserPlus, Search, ChevronRight } from 'lucide-react';

const TransactionModal = () => {
    const {
        isModalOpen, setIsModalOpen,
        formData, setFormData,
        services, employees, customers, vehicles,
        isSubmitting, setIsSubmitting,
        error, setError,
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

    const addExtra = (service, employeeId) => {
        const newExtras = [...(formData.extras || []), {
            serviceId: service.id,
            description: service.name,
            price: service.price,
            assignedTo: employeeId
        }];
        
        const mainService = services.find(s => String(s.id) === String(formData.serviceId));
        const mainPrice = mainService ? (parseFloat(mainService.price) || 0) : 0;
        const extrasTotal = newExtras.reduce((sum, current) => sum + (parseFloat(current.price) || 0), 0);
        const newTotalPrice = mainPrice + extrasTotal;

        setFormData({
            ...formData,
            extras: newExtras,
            price: newTotalPrice
        });
    };

    return (
        <div 
            style={{ 
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
                backgroundColor: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(12px)',
                zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
                padding: '20px', overflowY: 'auto', WebkitOverflowScrolling: 'touch'
            }}
            onClick={() => setIsModalOpen(false)}
        >
            <div 
                style={{ 
                    backgroundColor: '#111111', width: '100%', maxWidth: '600px', 
                    borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)', 
                    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                    marginTop: '20px', marginBottom: '20px'
                }} 
                onClick={e => e.stopPropagation()}
                className="animate-in fade-in zoom-in duration-300"
            >
                {/* Header */}
                <div style={{ padding: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)', backgroundColor: 'rgba(255,255,255,0.02)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTopLeftRadius: '24px', borderTopRightRadius: '24px' }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: 'white', textTransform: 'uppercase', letterSpacing: '-0.025em' }}>Registrar Servicio</h3>
                        <p style={{ margin: '4px 0 0 0', fontSize: '10px', color: '#666', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>V4.68 • Paso a paso</p>
                    </div>
                    <button 
                        onClick={() => setIsModalOpen(false)}
                        style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', border: 'none', backgroundColor: 'rgba(255,255,255,0.05)', color: '#999', cursor: 'pointer' }}
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
                    {/* PASO 1: CLIENTE */}
                    <div style={{ marginBottom: '24px' }}>
                        <div style={{ fontSize: '10px', fontWeight: 900, color: '#444', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                             <div style={{ width: '20px', height: '1px', backgroundColor: '#333' }}></div>
                             PASO 1: CLIENTE
                             <div style={{ flex: 1, height: '1px', backgroundColor: '#333' }}></div>
                        </div>
                        
                        {!formData.customerId && !isAddingCustomer && !showCustomerSearch ? (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowCustomerSearch(true)}
                                    style={{ height: '120px', borderRadius: '16px', backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(99,102,241,0.2)', color: 'white', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', transition: 'all 0.2s' }}
                                    className="hover:border-indigo-500/50 hover:bg-indigo-500/5 active:scale-95"
                                >
                                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8' }}>
                                        <Search size={24} />
                                    </div>
                                    <span style={{ fontSize: '11px', fontWeight: 900, letterSpacing: '0.05em' }}>BUSCAR CLIENTE</span>
                                </button>
                                
                                <button
                                    type="button"
                                    onClick={() => setIsAddingCustomer(true)}
                                    style={{ height: '120px', borderRadius: '16px', backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(16,185,129,0.2)', color: 'white', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', transition: 'all 0.2s' }}
                                    className="hover:border-emerald-500/50 hover:bg-emerald-500/5 active:scale-95"
                                >
                                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#34d399' }}>
                                        <UserPlus size={24} />
                                    </div>
                                    <span style={{ fontSize: '11px', fontWeight: 900, letterSpacing: '0.05em' }}>NUEVO CLIENTE</span>
                                </button>
                            </div>
                        ) : (
                            <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                    <span style={{ fontSize: '12px', fontWeight: 900, color: 'white', textTransform: 'uppercase' }}>
                                        {isAddingCustomer ? 'Detalles del Nuevo Cliente' : showCustomerSearch ? 'Buscar en Base de Datos' : 'Cliente Seleccionado'}
                                    </span>
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            setFormData({...formData, customerId: '', vehicleId: ''});
                                            setIsAddingCustomer(false);
                                            setShowCustomerSearch(false);
                                        }}
                                        style={{ background: 'none', border: 'none', color: '#6366f1', fontSize: '10px', fontWeight: 900, cursor: 'pointer', textDecoration: 'underline' }}
                                    >
                                        CAMBIAR
                                    </button>
                                </div>

                                {/* SEARCH */}
                                {showCustomerSearch && !formData.customerId && (
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type="text"
                                            style={{ width: '100%', height: '48px', backgroundColor: 'black', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '0 16px', color: 'white', outline: 'none' }}
                                            placeholder="Nombre o placa..."
                                            value={customerSearch}
                                            onChange={(e) => setCustomerSearch(e.target.value)}
                                            autoFocus
                                        />
                                        {customerSearch.length > 0 && (
                                            <div style={{ position: 'absolute', top: '52px', left: 0, right: 0, backgroundColor: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', overflow: 'hidden', zIndex: 100, maxHeight: '200px', overflowY: 'auto' }}>
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
                                                        <div style={{ fontSize: '10px', fontWeight: 900, color: '#818cf8', backgroundColor: 'rgba(99,102,241,0.1)', padding: '4px 8px', borderRadius: '4px' }}>
                                                            {c.vehicle_plate}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* NEW CUSTOMER FORM */}
                                {isAddingCustomer && (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                        <input type="text" style={{ height: '40px', backgroundColor: 'black', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '0 12px', color: 'white', fontSize: '13px' }} placeholder="Nombre" value={newCustomer.name} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} />
                                        <input type="text" style={{ height: '40px', backgroundColor: 'black', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '0 12px', color: 'white', fontSize: '13px' }} placeholder="Placa" value={newCustomer.vehicle_plate} onChange={e => setNewCustomer({...newCustomer, vehicle_plate: e.target.value})} />
                                        <input type="text" style={{ height: '40px', backgroundColor: 'black', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '0 12px', color: 'white', fontSize: '13px' }} placeholder="Marca" value={newCustomer.vehicle_brand} onChange={e => setNewCustomer({...newCustomer, vehicle_brand: e.target.value})} />
                                        <input type="text" style={{ height: '40px', backgroundColor: 'black', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '0 12px', color: 'white', fontSize: '13px' }} placeholder="Modelo" value={newCustomer.vehicle_model} onChange={e => setNewCustomer({...newCustomer, vehicle_model: e.target.value})} />
                                        <button 
                                            type="button" 
                                            onClick={handleCreateCustomer}
                                            style={{ gridColumn: 'span 2', height: '44px', backgroundColor: '#10b981', border: 'none', borderRadius: '8px', color: 'black', fontWeight: 900, fontSize: '11px', textTransform: 'uppercase', cursor: 'pointer', marginTop: '8px' }}
                                        >
                                            Confirmar Nuevo Cliente
                                        </button>
                                    </div>
                                )}

                                {/* SELECTED CARD */}
                                {formData.customerId && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: 'rgba(99,102,241,0.05)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(99,102,241,0.2)' }}>
                                        <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8' }}>
                                            <Car size={24} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '14px', fontWeight: 900, color: 'white' }}>{customers.find(c => String(c.id) === String(formData.customerId))?.name}</div>
                                            <div style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase', fontWeight: 700 }}>{vehicles.find(v => String(v.id) === String(formData.vehicleId))?.plate || 'SIN PLACA'} • {vehicles.find(v => String(v.id) === String(formData.vehicleId))?.model}</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* PASO 2: SERVICIOS */}
                    {(formData.customerId || isAddingCustomer) && (
                        <div className="animate-in slide-in-from-bottom-4 duration-300">
                            <div style={{ fontSize: '10px', fontWeight: 900, color: '#444', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                 <div style={{ width: '20px', height: '1px', backgroundColor: '#333' }}></div>
                                 PASO 2: SERVICIOS
                                 <div style={{ flex: 1, height: '1px', backgroundColor: '#333' }}></div>
                            </div>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px', marginBottom: '24px' }}>
                                {sortedServices.filter(s => !s.is_extra).map(s => (
                                    <button
                                        key={s.id}
                                        type="button"
                                        onClick={() => setFormData({...formData, serviceId: s.id, price: s.price})}
                                        style={{ 
                                            padding: '16px', borderRadius: '16px', border: '1px solid',
                                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                                            cursor: 'pointer', transition: 'all 0.2s',
                                            backgroundColor: String(formData.serviceId) === String(s.id) ? '#6366f1' : 'rgba(0,0,0,0.3)',
                                            borderColor: String(formData.serviceId) === String(s.id) ? '#818cf8' : 'rgba(255,255,255,0.05)',
                                            color: 'white'
                                        }}
                                        className="active:scale-95"
                                    >
                                        <span style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', opacity: String(formData.serviceId) === String(s.id) ? 1 : 0.5 }}>{s.name}</span>
                                        <div style={{ fontSize: '16px', fontWeight: 900 }}>${s.price}</div>
                                    </button>
                                ))}
                            </div>

                            {/* EXTRAS */}
                            <div style={{ marginTop: '20px', padding: '16px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                                <div style={{ fontSize: '10px', fontWeight: 900, color: '#666', textTransform: 'uppercase', marginBottom: '12px' }}>Extras Opcionales</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {services.filter(s => s.is_extra).map(extra => (
                                        <button
                                            key={extra.id}
                                            type="button"
                                            onClick={() => addExtra(extra, myEmployeeId)}
                                            style={{ padding: '8px 12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)', backgroundColor: 'rgba(255,255,255,0.05)', color: '#999', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer' }}
                                            className="hover:bg-white/10 hover:text-white"
                                        >
                                            + {extra.name} (${extra.price})
                                        </button>
                                    ))}
                                </div>
                                
                                {formData.extras?.length > 0 && (
                                    <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {formData.extras.map((ex, idx) => (
                                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'black', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                <span style={{ fontSize: '10px', fontWeight: 700, color: 'white', textTransform: 'uppercase' }}>{ex.description} <span style={{ color: '#6366f1' }}>${ex.price}</span></span>
                                                <button type="button" onClick={() => handleRemoveExtra(idx)} style={{ background: 'none', border: 'none', color: '#ef4444', padding: '4px', cursor: 'pointer' }}>
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* TOTAL & FOOTER */}
                            <div style={{ marginTop: '32px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '24px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
                                    <div>
                                        <label style={{ fontSize: '9px', fontWeight: 900, color: '#666', display: 'block', marginBottom: '8px' }}>LAVADOR</label>
                                        <select
                                            style={{ width: '100%', height: '40px', backgroundColor: 'black', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '0 12px', color: 'white', fontSize: '11px', fontWeight: 700 }}
                                            required
                                            value={formData.employeeId}
                                            onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                                        >
                                            <option value="">SELECCIONAR...</option>
                                            {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '9px', fontWeight: 900, color: '#666', display: 'block', marginBottom: '8px' }}>MÉTODO DE PAGO</label>
                                        <select
                                            style={{ width: '100%', height: '40px', backgroundColor: 'black', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '0 12px', color: 'white', fontSize: '11px', fontWeight: 700 }}
                                            required
                                            value={formData.paymentMethod}
                                            onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                                        >
                                            <option value="cash">EFECTIVO</option>
                                            <option value="ath_movil">ATH MÓVIL</option>
                                            <option value="card">TARJETA</option>
                                        </select>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '12px', alignItems: 'stretch' }}>
                                    <div style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                        <div style={{ fontSize: '9px', fontWeight: 900, color: '#444' }}>TOTAL</div>
                                        <div style={{ fontSize: '24px', fontWeight: 900, color: 'white' }}>${formData.price || 0}</div>
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting || !formData.customerId || !formData.serviceId}
                                        style={{ flex: 2, borderRadius: '16px', backgroundColor: '#6366f1', border: 'none', color: 'white', fontWeight: 900, fontSize: '12px', textTransform: 'uppercase', cursor: 'pointer', opacity: (isSubmitting || !formData.customerId || !formData.serviceId) ? 0.3 : 1 }}
                                    >
                                        {isSubmitting ? 'REGISTRANDO...' : 'FINALIZAR REGISTRO'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
};

export default TransactionModal;
