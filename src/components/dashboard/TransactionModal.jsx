import React from 'react';
import { useDashboard } from '../../context/DashboardContext';
import { X, Trash2, Car, Plus, RefreshCw, Settings, MessageCircle } from 'lucide-react';

const TransactionModal = () => {
    const {
        isModalOpen, setIsModalOpen,
        formData, setFormData,
        services, employees, customers, vehicles,
        plateSearch, setPlateSearch,
        isSubmitting, setIsSubmitting,
        error, setError,
        isRedemption, setIsRedemption,
        vipInfo, setVipInfo,
        canRedeemPoints, setCanRedeemPoints,
        handleCustomerSelect,
        handlePlateSearch,
        customerMembership, setCustomerMembership,
        isMembershipUsage, setIsMembershipUsage,
        isExtraWashUsage, setIsExtraWashUsage,
        availableExtraWashes, setAvailableExtraWashes,
        allCustomerMemberships, setAllCustomerMemberships,
        customerSearch, setCustomerSearch,
        showCustomerSearch, setShowCustomerSearch,
        customerVehicles, setCustomerVehicles,
        isAddingCustomer, setIsAddingCustomer,
        newCustomer, setNewCustomer,
        handleCreateCustomer,
        pendingExtra, setPendingExtra,
        showAssignmentModal, setShowAssignmentModal,
        memberships,
        handleSubmit,
        handleAddMembership,
        handleAutoMembershipAssign,
        handleExtraAdded,
        handleRemoveExtra,
        activeTab, setActiveTab,
        newExtra, setNewExtra,
        userRole,
        myEmployeeId,
        referrerSearch, setReferrerSearch,
        showReferrerSearch, setShowReferrerSearch,
        getServiceName,
        getTransactionCategory,
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
        
        let newTotalPrice = (services.find(s => s.id == formData.serviceId)?.price || 0) + 
                           newExtras.reduce((sum, current) => sum + current.price, 0);

        setFormData({
            ...formData,
            extras: newExtras,
            price: newTotalPrice
        });
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex justify-center items-center z-[1000] p-4 animate-fade-in overflow-y-auto">
            <div 
                className="bg-zinc-900 border border-white/10 w-full max-w-2xl rounded-3xl shadow-2xl shadow-black/50 overflow-hidden flex flex-col max-h-[90vh]" 
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b border-white/5 bg-white/5 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-black text-white tracking-tight uppercase">Registrar Nuevo Servicio</h3>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mt-1">Sigue los pasos para completar el registro</p>
                    </div>
                    <button 
                        onClick={() => setIsModalOpen(false)}
                        className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto">
                    {/* PASO 1: CLIENTE */}
                    <div className="bg-zinc-800/20 p-6 rounded-3xl border border-white/5 space-y-4">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] block mb-2">Paso 1: Identificar Cliente</label>
                        
                        {!formData.customerId && !isAddingCustomer && !showCustomerSearch ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <button
                                    type="button"
                                    onClick={() => setShowCustomerSearch(true)}
                                    className="h-32 rounded-2xl bg-black/40 border border-indigo-500/20 hover:border-indigo-500/40 hover:bg-indigo-500/5 transition-all flex flex-col items-center justify-center gap-3 group active:scale-95"
                                >
                                    <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                                        <RefreshCw size={24} />
                                    </div>
                                    <span className="text-sm font-black text-white tracking-widest uppercase">BUSCAR CLIENTE</span>
                                </button>
                                
                                <button
                                    type="button"
                                    onClick={() => setIsAddingCustomer(true)}
                                    className="h-32 rounded-2xl bg-black/40 border border-emerald-500/20 hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-all flex flex-col items-center justify-center gap-3 group active:scale-95"
                                >
                                    <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                                        <Plus size={24} />
                                    </div>
                                    <span className="text-sm font-black text-white tracking-widest uppercase">NUEVO CLIENTE</span>
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4 animate-fade-in">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                                        {isAddingCustomer ? '📝 Detalles del Nuevo Cliente' : showCustomerSearch ? '🔍 Buscar en Base de Datos' : '✅ Cliente Seleccionado'}
                                    </span>
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            setFormData({...formData, customerId: '', vehicleId: ''});
                                            setIsAddingCustomer(false);
                                            setShowCustomerSearch(false);
                                        }}
                                        className="text-[9px] font-black text-indigo-400 hover:text-indigo-300 uppercase tracking-widest underline decoration-indigo-500/30 underline-offset-4"
                                    >
                                        [Cambiar / Cancelar]
                                    </button>
                                </div>

                                {/* SEARCH INTERFACE */}
                                {showCustomerSearch && !formData.customerId && (
                                    <div className="relative">
                                        <input
                                            type="text"
                                            className="w-full h-12 bg-black/60 border border-white/10 rounded-xl px-4 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none"
                                            placeholder="Escribe nombre, modelo o placa..."
                                            value={customerSearch}
                                            onChange={(e) => setCustomerSearch(e.target.value)}
                                            autoFocus
                                        />
                                        {customerSearch.length > 0 && (
                                            <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-white/10 rounded-xl overflow-hidden z-50 max-h-60 overflow-y-auto shadow-2xl">
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
                                                        className="p-4 border-b border-white/5 hover:bg-indigo-500/5 cursor-pointer flex justify-between items-center transition-colors"
                                                    >
                                                        <div>
                                                            <div className="text-sm font-bold text-white uppercase">{c.name}</div>
                                                            <div className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">{c.vehicle_model || 'Info Incompleta'}</div>
                                                        </div>
                                                        <div className="text-xs px-2 py-1 bg-indigo-500/20 text-indigo-400 rounded-md font-black ring-1 ring-indigo-500/30">
                                                            {c.vehicle_plate || 'S.P.'}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* NEW CUSTOMER FORM */}
                                {isAddingCustomer && (
                                    <div className="grid grid-cols-2 gap-3 animate-fade-in">
                                        <input type="text" className="h-10 bg-black/40 border border-white/10 rounded-lg px-3 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-indigo-500/50" placeholder="Nombre completo" value={newCustomer.name} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} />
                                        <input type="text" className="h-10 bg-black/40 border border-white/10 rounded-lg px-3 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-indigo-500/50" placeholder="Placa" value={newCustomer.vehicle_plate} onChange={e => setNewCustomer({...newCustomer, vehicle_plate: e.target.value})} />
                                        <input type="text" className="h-10 bg-black/40 border border-white/10 rounded-lg px-3 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-indigo-500/50" placeholder="Marca" value={newCustomer.vehicle_brand} onChange={e => setNewCustomer({...newCustomer, vehicle_brand: e.target.value})} />
                                        <input type="text" className="h-10 bg-black/40 border border-white/10 rounded-lg px-3 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-indigo-500/50" placeholder="Modelo" value={newCustomer.vehicle_model} onChange={e => setNewCustomer({...newCustomer, vehicle_model: e.target.value})} />
                                        <button 
                                            type="button" 
                                            onClick={handleCreateCustomer}
                                            className="col-span-2 h-10 bg-emerald-500 text-black font-black text-[10px] uppercase tracking-[0.2em] rounded-lg hover:bg-emerald-400 transition-colors active:scale-[0.98]"
                                        >
                                            Guardar Cliente y Vehículo
                                        </button>
                                    </div>
                                )}

                                {/* SELECTED CUSTOMER INFO CARD */}
                                {formData.customerId && (
                                    <div className="flex items-center gap-4 bg-indigo-500/5 p-4 rounded-2xl border border-indigo-500/20 animate-fade-in shadow-inner">
                                        <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 ring-1 ring-indigo-500/30">
                                            <Car size={24} />
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-[10px] font-black text-indigo-400/60 uppercase tracking-widest mb-1">Cliente Activo</div>
                                            <div className="text-sm font-black text-white uppercase tracking-tight leading-none mb-1">
                                                {customers.find(c => c.id == formData.customerId)?.name}
                                            </div>
                                            <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
                                                Placa: <span className="text-zinc-300 font-black">{vehicles.find(v => v.id == formData.vehicleId)?.plate || 'SIN PLACA'}</span> • {vehicles.find(v => v.id == formData.vehicleId)?.model || ''}
                                            </div>
                                        </div>
                                        <div className="text-right px-3 py-1 bg-black/40 rounded-lg border border-white/5">
                                             <div className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Puntos</div>
                                             <div className="text-xs font-black text-indigo-400">{customers.find(c => c.id == formData.customerId)?.points || 0} pts</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* PASO 2: SERVICIOS */}
                    {(formData.customerId || isAddingCustomer) && (
                        <div className="bg-zinc-800/20 p-6 rounded-3xl border border-white/5 space-y-6 animate-scale-in">
                            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] block mb-2">Paso 2: Seleccionar Servicios</label>
                            
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {sortedServices.filter(s => !s.is_extra).map(s => (
                                    <button
                                        key={s.id}
                                        type="button"
                                        onClick={() => setFormData({...formData, serviceId: s.id, price: s.price})}
                                        className={`p-4 rounded-2xl border transition-all flex flex-col items-center justify-center gap-2 text-center group active:scale-95 ${
                                            formData.serviceId == s.id 
                                            ? 'bg-indigo-500 border-indigo-400 shadow-lg shadow-indigo-500/20' 
                                            : 'bg-black/40 border-white/5 hover:border-indigo-500/30 hover:bg-indigo-500/5'
                                        }`}
                                    >
                                        <span className={`text-[9px] font-black uppercase tracking-[0.15em] ${formData.serviceId == s.id ? 'text-white' : 'text-zinc-500'}`}>
                                            {s.name}
                                        </span>
                                        <div className="h-[1px] w-4 bg-white/20"></div>
                                        <span className={`text-base font-black ${formData.serviceId == s.id ? 'text-white' : 'text-indigo-400'}`}>
                                            ${s.price}
                                        </span>
                                    </button>
                                ))}
                            </div>

                            {/* EXTRAS */}
                            <div className="pt-4 border-t border-white/5 space-y-3">
                                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] block">Extras (Opcional)</label>
                                <div className="flex flex-wrap gap-2">
                                    {services.filter(s => s.is_extra).map(extra => (
                                        <button
                                            key={extra.id}
                                            type="button"
                                            onClick={() => addExtra(extra, myEmployeeId)}
                                            className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:border-indigo-500/30 hover:bg-indigo-500/5 text-[9px] font-black text-zinc-400 hover:text-indigo-400 uppercase tracking-widest transition-all active:scale-[0.98]"
                                        >
                                            + {extra.name} <span className="text-zinc-600 ml-1">(${extra.price})</span>
                                        </button>
                                    ))}
                                </div>
                                
                                {formData.extras?.length > 0 && (
                                    <div className="grid grid-cols-1 gap-2 mt-4">
                                        {formData.extras.map((ex, idx) => (
                                            <div key={idx} className="flex justify-between items-center bg-black/40 px-3 py-2 rounded-xl border border-white/5 animate-fade-in">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                                                    <span className="text-[9px] font-black text-white uppercase tracking-widest">{ex.description}</span>
                                                    <span className="text-[9px] font-bold text-indigo-400">${ex.price}</span>
                                                </div>
                                                <button type="button" onClick={() => handleRemoveExtra(idx)} className="w-6 h-6 flex items-center justify-center rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all">
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* TOTAL Y REGISTRAR */}
                            <div className="pt-6 border-t border-white/10 flex flex-col gap-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2 block">Empleado</label>
                                        <select
                                            className="w-full h-10 bg-black/40 border border-white/10 rounded-xl px-3 text-[10px] font-bold text-white uppercase tracking-widest outline-none focus:ring-1 focus:ring-indigo-500/50"
                                            required
                                            value={formData.employeeId}
                                            onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                                        >
                                            <option value="">LAVADOR...</option>
                                            {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2 block">Pago</label>
                                        <select
                                            className="w-full h-10 bg-black/40 border border-white/10 rounded-xl px-3 text-[10px] font-bold text-white uppercase tracking-widest outline-none focus:ring-1 focus:ring-indigo-500/50"
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

                                <div className="flex justify-between items-end gap-6">
                                    <div className="flex-1 h-20 bg-black/40 rounded-2xl border border-white/5 p-4 flex flex-col justify-center">
                                        <div className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-1">Total del Servicio</div>
                                        <div className="text-3xl font-black text-white tracking-tighter flex items-center gap-1 leading-none">
                                            <span className="text-indigo-500 text-xl font-normal opacity-70">$</span>
                                            {formData.price || 0}
                                        </div>
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting || !formData.customerId || !formData.serviceId}
                                        className="h-20 flex-1 rounded-2xl bg-indigo-500 hover:bg-indigo-400 disabled:opacity-30 disabled:grayscale text-white font-black text-[10px] uppercase tracking-[0.25em] shadow-2xl shadow-indigo-500/30 active:scale-95 transition-all outline-none ring-offset-zinc-900 ring-offset-2 focus:ring-2 focus:ring-indigo-500"
                                    >
                                        {isSubmitting ? '. . .' : 'Finalizar Registro'}
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
