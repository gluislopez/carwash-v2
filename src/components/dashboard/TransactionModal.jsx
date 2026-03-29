// TransactionModal.jsx - Extracted from DashboardPanel.jsx
import React from 'react';
import { useDashboard } from '../../context/DashboardContext';

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
    } = useDashboard();

    if (!isModalOpen) return null;

    return (
                        isModalOpen && (
                            <div className="modal-overlay" style={{
                                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                                backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000,
                                overflowY: 'auto'
                            }}>
                                <div className="card modal-card" style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
                                    <h3 style={{ marginBottom: '1.5rem' }}>Registrar Nuevo Servicio</h3>
                                    <form onSubmit={handleSubmit}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                            <div style={{ marginBottom: '1rem' }}>
                                                <label className="label">Cliente</label>
                                                {!isAddingCustomer ? (

                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                        {/* SEARCH MODE OR SELECT MODE */}
                                                        {showCustomerSearch ? (
                                                            <div style={{ position: 'relative' }}>
                                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                                    <input
                                                                        type="text"
                                                                        className="input"
                                                                        placeholder="🔍 Escribe nombre, modelo o placa..."
                                                                        value={customerSearch}
                                                                        onChange={(e) => setCustomerSearch(e.target.value)}
                                                                        autoFocus
                                                                        style={{ flex: 1 }}
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        className="btn"
                                                                        onClick={() => {
                                                                            setShowCustomerSearch(false);
                                                                            setCustomerSearch('');
                                                                        }}
                                                                        style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                                                                    >
                                                                        ✕
                                                                    </button>
                                                                </div>

                                                                {/* RESULTS LIST */}
                                                                {customerSearch.length > 0 && (
                                                                    <div style={{
                                                                        position: 'absolute',
                                                                        top: '100%',
                                                                        left: 0,
                                                                        right: 0,
                                                                        backgroundColor: 'var(--bg-card)',
                                                                        border: '1px solid var(--border-color)',
                                                                        borderRadius: '0.5rem',
                                                                        maxHeight: '200px',
                                                                        overflowY: 'auto',
                                                                        zIndex: 10,
                                                                        marginTop: '0.25rem',
                                                                        boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
                                                                    }}>
                                                                        {customers
                                                                            .filter(c => {
                                                                                const term = customerSearch.toLowerCase();
                                                                                const matchesLegacy = (c.name || '').toLowerCase().includes(term) ||
                                                                                    (c.phone || '').toLowerCase().includes(term) ||
                                                                                    (c.vehicle_model || '').toLowerCase().includes(term) ||
                                                                                    (c.vehicle_plate || '').toLowerCase().includes(term);

                                                                                if (matchesLegacy) return true;

                                                                                // Check Multi-vehicle Table
                                                                                const matchInVehicles = vehicles.some(v =>
                                                                                    v.customer_id == c.id &&
                                                                                    (v.plate || '').toLowerCase().includes(term)
                                                                                );
                                                                                return matchInVehicles;
                                                                            })
                                                                            .map(c => {
                                                                                const term = customerSearch.toLowerCase();
                                                                                // Find if specific vehicle matched
                                                                                const matchedVehicle = vehicles.find(v =>
                                                                                    v.customer_id == c.id &&
                                                                                    (v.plate || '').toLowerCase().includes(term)
                                                                                );

                                                                                return (
                                                                                    <div
                                                                                        key={c.id}
                                                                                        onClick={() => {
                                                                                            // Select matched vehicle OR first vehicle OR legacy info
                                                                                            const custVehicle = matchedVehicle || vehicles.find(v => v.customer_id == c.id);
                                                                                            setFormData({
                                                                                                ...formData,
                                                                                                customerId: c.id,
                                                                                                vehicleId: custVehicle ? custVehicle.id : ''
                                                                                            });
                                                                                            handleCustomerSelect(c.id, custVehicle ? custVehicle.id : null);
                                                                                            setIsEditingVisits(false);
                                                                                            setShowCustomerSearch(false);
                                                                                            setCustomerSearch('');
                                                                                        }}
                                                                                        style={{
                                                                                            padding: '0.75rem',
                                                                                            borderBottom: '1px solid var(--border-color)',
                                                                                            cursor: 'pointer',
                                                                                            display: 'flex',
                                                                                            justifyContent: 'space-between',
                                                                                            alignItems: 'center'
                                                                                        }}
                                                                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                                                                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                                                                    >
                                                                                        <div>
                                                                                            <div style={{ fontWeight: 'bold' }}>{c.name}</div>
                                                                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.phone || ''}</div>
                                                                                        </div>
                                                                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'right' }}>
                                                                                            {matchedVehicle ? (
                                                                                                <><span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>Matched: </span>{matchedVehicle.brand || ''} {matchedVehicle.model || ''} ({matchedVehicle.plate})</>
                                                                                            ) : (
                                                                                                <>
                                                                                                    {c.vehicle_model ? `${c.vehicle_model} ` : ''}
                                                                                                    ({c.vehicle_plate || 'Sin Placa'})
                                                                                                </>
                                                                                            )}
                                                                                        </span>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        {customers.filter(c => {
                                                                            const term = (customerSearch || '').toLowerCase();
                                                                            const matchesLegacy = (c.name || '').toLowerCase().includes(term) || (c.phone || '').toLowerCase().includes(term) || (c.vehicle_model || '').toLowerCase().includes(term) || (c.vehicle_plate || '').toLowerCase().includes(term);
                                                                            const matchesVehicle = vehicles.some(v => v.customer_id == c.id && (v.plate || '').toLowerCase().includes(term));
                                                                            return matchesLegacy || matchesVehicle;
                                                                        }).length === 0 && (
                                                                                <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                                                                    No se encontraron resultados
                                                                                </div>
                                                                            )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                                    <select
                                                                        className="input"
                                                                        required
                                                                        value={formData.customerId}
                                                                        onChange={(e) => {
                                                                            const cId = e.target.value;
                                                                            const custVehicle = vehicles.find(v => v.customer_id == cId);
                                                                            const vId = custVehicle ? custVehicle.id : '';
                                                                            setFormData({
                                                                                ...formData,
                                                                                customerId: cId,
                                                                                vehicleId: vId
                                                                            });
                                                                            handleCustomerSelect(cId, vId);
                                                                        }}
                                                                        style={{ flex: 1 }}
                                                                    >
                                                                        <option value="">Seleccionar Cliente...</option>
                                                                        {customers.map(c => (
                                                                            <option key={c.id} value={c.id}>
                                                                                {c.name} - {c.vehicle_model ? `${c.vehicle_model} ` : ''}({c.vehicle_plate})
                                                                            </option>
                                                                        ))}
                                                                    </select>

                                                                    {/* SEARCH TOGGLE BUTTON */}
                                                                    <button
                                                                        type="button"
                                                                        className="btn"
                                                                        onClick={() => setShowCustomerSearch(true)}
                                                                        title="Buscar Cliente"
                                                                        style={{
                                                                            flexShrink: 0,
                                                                            width: '48px',
                                                                            padding: 0,
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center',
                                                                            backgroundColor: 'var(--bg-secondary)',
                                                                            color: 'white',
                                                                            fontSize: '1.5rem'
                                                                        }}
                                                                    >
                                                                        🔍
                                                                    </button>

                                                                    {/* ADD CUSTOMER BUTTON */}
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-primary"
                                                                        onClick={() => setIsAddingCustomer(true)}
                                                                        title="Nuevo Cliente"
                                                                        style={{
                                                                            flexShrink: 0,
                                                                            width: '48px',
                                                                            padding: 0,
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center',
                                                                            fontSize: '2rem',
                                                                            lineHeight: '1'
                                                                        }}
                                                                    >
                                                                        +
                                                                    </button>
                                                                </div>

                                                                {/* VEHICLE SELECTOR ROW */}
                                                                {formData.customerId && (
                                                                    <>
                                                                        <div style={{
                                                                            display: 'flex',
                                                                            justifyContent: 'space-between',
                                                                            alignItems: 'center',
                                                                            padding: '0.75rem 1rem',
                                                                            backgroundColor: 'var(--bg-secondary)',
                                                                            borderRadius: '0.8rem',
                                                                            marginBottom: '1rem',
                                                                            border: '1px solid var(--border-color)'
                                                                        }}>
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                                                <span style={{ fontSize: '1.2rem' }}>📊</span>
                                                                                <div>
                                                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Estadísticas Totales</div>
                                                                                    <div style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>
                                                                                        {(() => {
                                                                                            const c = customers.find(cust => cust.id == formData.customerId);
                                                                                            // Count only services, excluding membership sales
                                                                                            const visits = transactions.filter(tx =>
                                                                                                tx.customer_id == formData.customerId &&
                                                                                                tx.status !== 'cancelled' &&
                                                                                                getTransactionCategory(tx) !== 'membership_sale'
                                                                                            ).length;
                                                                                            const manual = c?.manual_visit_count || 0;
                                                                                            return `${visits + manual} Visitas`;
                                                                                        })()}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                            {(userRole === 'admin' || userRole === 'manager') && (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        const c = customers.find(cust => cust.id == formData.customerId);
                                                                                        setManualVisits(c?.manual_visit_count || 0);
                                                                                        setIsEditingVisits(!isEditingVisits);
                                                                                    }}
                                                                                    style={{
                                                                                        padding: '0.4rem 0.8rem',
                                                                                        fontSize: '0.75rem',
                                                                                        backgroundColor: isEditingVisits ? 'var(--error-color)' : 'var(--bg-card)',
                                                                                        color: isEditingVisits ? 'white' : 'var(--text-primary)',
                                                                                        border: '1px solid var(--border-color)',
                                                                                        borderRadius: '0.5rem',
                                                                                        cursor: 'pointer',
                                                                                        fontWeight: 'bold'
                                                                                    }}
                                                                                >
                                                                                    {isEditingVisits ? 'Cancelar' : 'Editar Visitas'}
                                                                                </button>
                                                                            )}
                                                                        </div>

                                                                        {isEditingVisits && (
                                                                            <div style={{
                                                                                padding: '1rem',
                                                                                backgroundColor: 'rgba(59, 130, 246, 0.05)',
                                                                                border: '1px solid var(--primary)',
                                                                                borderRadius: '0.8rem',
                                                                                marginBottom: '1.5rem',
                                                                                display: 'flex',
                                                                                flexDirection: 'column',
                                                                                gap: '0.75rem'
                                                                            }}>
                                                                                <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Ajustar Visitas Manuales:</label>
                                                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                                                    <input
                                                                                        type="number"
                                                                                        className="input"
                                                                                        value={manualVisits}
                                                                                        onChange={(e) => setManualVisits(e.target.value)}
                                                                                        style={{ flex: 1, backgroundColor: 'var(--bg-card)' }}
                                                                                        placeholder="Ej: 5"
                                                                                    />
                                                                                    <button
                                                                                        type="button"
                                                                                        className="btn btn-primary"
                                                                                        onClick={() => handleUpdateManualVisits(formData.customerId)}
                                                                                        style={{ padding: '0.5rem 1rem' }}
                                                                                    >
                                                                                        Guardar
                                                                                    </button>
                                                                                </div>
                                                                                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0 }}>
                                                                                    * Este valor se suma a las visitas reales registradas en el sistema.
                                                                                </p>
                                                                            </div>
                                                                        )}
                                                                    </>
                                                                )}
                                                                {formData.customerId && (
                                                                    <div style={{ marginBottom: '1.5rem' }}>
                                                                        <label className="label" style={{ fontSize: '0.85rem', marginBottom: '0.75rem', display: 'block' }}>
                                                                            {customerVehicles.length > 1 ? 'Selecciona el vehículo (Varios detectados):' : 'Vehículo a lavar:'}
                                                                            <span style={{ fontSize: '0.75rem', marginLeft: '0.5rem', opacity: 0.7, fontWeight: 'normal' }}>(Total: {customerVehicles?.length || 0})</span>
                                                                        </label>

                                                                        {customerVehicles.length > 1 ? (
                                                                            <div style={{
                                                                                display: 'grid',
                                                                                gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                                                                                gap: '0.75rem'
                                                                            }}>
                                                                                {customerVehicles.map(v => (
                                                                                    <div
                                                                                        key={v.id}
                                                                                        onClick={() => {
                                                                                            setFormData({ ...formData, vehicleId: v.id });
                                                                                            handleCustomerSelect(formData.customerId, v.id);
                                                                                        }}
                                                                                        style={{
                                                                                            padding: '0.75rem',
                                                                                            borderRadius: '0.8rem',
                                                                                            border: formData.vehicleId == v.id ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                                                                                            backgroundColor: formData.vehicleId == v.id ? 'var(--primary-light)' : 'var(--bg-card)',
                                                                                            cursor: 'pointer',
                                                                                            transition: 'all 0.2s',
                                                                                            textAlign: 'center',
                                                                                            position: 'relative',
                                                                                            display: 'flex',
                                                                                            flexDirection: 'column',
                                                                                            gap: '0.25rem'
                                                                                        }}
                                                                                    >
                                                                                        <div style={{ fontSize: '1.1rem' }}>🚗</div>
                                                                                        <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: formData.vehicleId == v.id ? 'white' : 'var(--text-primary)' }}>
                                                                                            {(() => {
                                                                                                // 1. Try Vehicle Data
                                                                                                if (v.brand || v.model) return `${v.brand || ''} ${v.model || ''}`;
                                                                                                // 2. Try Customer Legacy Data (if plate matches)
                                                                                                const selectedCustomer = customers.find(c => c.id == formData.customerId);
                                                                                                if (selectedCustomer && (v.plate === selectedCustomer.vehicle_plate)) {
                                                                                                    if (selectedCustomer.vehicle_brand || selectedCustomer.vehicle_model) {
                                                                                                        return `${selectedCustomer.vehicle_brand || ''} ${selectedCustomer.vehicle_model || ''}`;
                                                                                                    }
                                                                                                }
                                                                                                // 3. Fallback
                                                                                                return 'Vehículo';
                                                                                            })()}
                                                                                        </div>
                                                                                        <div style={{ fontSize: '0.75rem', color: formData.vehicleId == v.id ? 'rgba(255,255,255,0.8)' : 'var(--text-muted)' }}>{v.plate || 'Sin Placa'}</div>
                                                                                        <div style={{
                                                                                            marginTop: '0.25rem',
                                                                                            padding: '0.2rem 0.5rem',
                                                                                            borderRadius: '1rem',
                                                                                            backgroundColor: formData.vehicleId == v.id ? 'rgba(255,255,255,0.2)' : 'var(--bg-secondary)',
                                                                                            fontSize: '0.8rem',
                                                                                            fontWeight: '800',
                                                                                            color: formData.vehicleId == v.id ? 'white' : 'var(--success-color)'
                                                                                        }}>
                                                                                            {v.points || 0} pts
                                                                                        </div>
                                                                                    </div>
                                                                                ))}
                                                                                <div
                                                                                    onClick={() => {
                                                                                        const customer = customers.find(c => c.id == formData.customerId);
                                                                                        if (customer) {
                                                                                            setNewCustomer({
                                                                                                ...newCustomer,
                                                                                                name: customer.name,
                                                                                                phone: customer.phone,
                                                                                                email: customer.email,
                                                                                                vehicle_plate: '',
                                                                                                vehicle_brand: '',
                                                                                                vehicle_model: ''
                                                                                            });
                                                                                            setIsAddingCustomer(true);
                                                                                        }
                                                                                    }}
                                                                                    style={{
                                                                                        padding: '0.75rem',
                                                                                        borderRadius: '0.8rem',
                                                                                        border: '1px dashed var(--border-color)',
                                                                                        display: 'flex',
                                                                                        flexDirection: 'column',
                                                                                        alignItems: 'center',
                                                                                        justifyContent: 'center',
                                                                                        cursor: 'pointer',
                                                                                        color: 'var(--text-muted)',
                                                                                        fontSize: '0.8rem'
                                                                                    }}
                                                                                >
                                                                                    <span>+ Nuevo</span>
                                                                                    <span>Auto</span>
                                                                                </div>
                                                                            </div>
                                                                        ) : (
                                                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                                                <select
                                                                                    className="input"
                                                                                    required
                                                                                    value={formData.vehicleId}
                                                                                    onChange={(e) => {
                                                                                        if (e.target.value === 'new_vehicle') {
                                                                                            const customer = customers.find(c => c.id == formData.customerId);
                                                                                            if (customer) {
                                                                                                setNewCustomer({
                                                                                                    ...newCustomer,
                                                                                                    name: customer.name,
                                                                                                    phone: customer.phone,
                                                                                                    email: customer.email,
                                                                                                    vehicle_plate: '',
                                                                                                    vehicle_brand: '',
                                                                                                    vehicle_model: ''
                                                                                                });
                                                                                                setIsAddingCustomer(true);
                                                                                            }
                                                                                        } else {
                                                                                            const vId = e.target.value;
                                                                                            setFormData(prev => ({ ...prev, vehicleId: vId }));

                                                                                            // RE-CALCULATE MEMBERSHIP FOR THIS VEHICLE
                                                                                            const vehicleSub = allCustomerMemberships.find(m => m.vehicle_id === vId || m.vehicle_id === null);
                                                                                            if (vehicleSub) {
                                                                                                setCustomerMembership(vehicleSub);
                                                                                                // Re-check if current service is included
                                                                                                if (formData.serviceId) {
                                                                                                    const service = services.find(s => s.id === formData.serviceId);
                                                                                                    if (service) {
                                                                                                        const included = vehicleSub.memberships.included_services || [];
                                                                                                        const isIncluded = (included.length === 0) ? true : (included.includes(service.name) || included.includes(service.id));
                                                                                                        if (isIncluded) {
                                                                                                            const lastUsed = vehicleSub.last_used ? new Date(vehicleSub.last_used) : null;
                                                                                                            const isUsedToday = lastUsed && lastUsed.toDateString() === new Date().toDateString();
                                                                                                            if (vehicleSub.memberships?.type === 'unlimited') {
                                                                                                                setIsMembershipUsage(!isUsedToday);
                                                                                                            } else {
                                                                                                                setIsMembershipUsage((vehicleSub.usage_count || 0) < (vehicleSub.memberships?.limit_count || 0));
                                                                                                            }
                                                                                                        } else {
                                                                                                            setIsMembershipUsage(false);
                                                                                                        }
                                                                                                    }
                                                                                                }
                                                                                            } else {
                                                                                                setCustomerMembership(null);
                                                                                                setIsMembershipUsage(false);
                                                                                            }

                                                                                            // DETECT EXTRA WASHES FOR THIS VEHICLE
                                                                                            handleCustomerSelect(formData.customerId, vId);
                                                                                        }
                                                                                    }}
                                                                                    style={{ flex: 1, backgroundColor: 'var(--bg-secondary)', fontWeight: 'bold' }}
                                                                                >
                                                                                    {customerVehicles.map(v => (
                                                                                        <option key={v.id} value={v.id}>
                                                                                            🚗 {v.brand} {v.model} ({v.plate}) — {v.points || 0} pts
                                                                                        </option>
                                                                                    ))}
                                                                                    <option value="new_vehicle">+ Agregar Otro Vehículo</option>
                                                                                </select>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}

                                                                {/* MEMBERSHIP BADGE */}
                                                                {customerMembership && (
                                                                    <div style={{
                                                                        padding: '1rem',
                                                                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                                                                        border: '1px solid #6366f1',
                                                                        borderRadius: '0.8rem',
                                                                        marginBottom: '1.5rem'
                                                                    }}>
                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                            <div>
                                                                                <div style={{ color: '#6366f1', fontWeight: 'bold', fontSize: '0.9rem' }}>
                                                                                    Membresía Activa
                                                                                </div>
                                                                                <div style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>
                                                                                    {customerMembership.memberships.name}
                                                                                </div>
                                                                            </div>
                                                                            <div style={{ textAlign: 'right' }}>
                                                                                {(() => {
                                                                                    const lastUsed = customerMembership.last_used ? new Date(customerMembership.last_used) : null;
                                                                                    const now = new Date();
                                                                                    const isUsedToday = lastUsed && lastUsed.toDateString() === now.toDateString();

                                                                                    if (isUsedToday) {
                                                                                        return (
                                                                                            <span style={{
                                                                                                display: 'inline-block',
                                                                                                padding: '0.2rem 0.8rem',
                                                                                                backgroundColor: '#fbbf24',
                                                                                                color: 'black',
                                                                                                fontWeight: 'bold',
                                                                                                borderRadius: '2rem',
                                                                                                fontSize: '0.8rem'
                                                                                            }}>
                                                                                                Usado Hoy ⚠️
                                                                                            </span>
                                                                                        );
                                                                                    } else {
                                                                                        return (
                                                                                            <span style={{
                                                                                                display: 'inline-block',
                                                                                                padding: '0.2rem 0.8rem',
                                                                                                backgroundColor: '#10b981',
                                                                                                color: 'white',
                                                                                                fontWeight: 'bold',
                                                                                                borderRadius: '2rem',
                                                                                                fontSize: '0.8rem'
                                                                                            }}>
                                                                                                Disponible ✅
                                                                                            </span>
                                                                                        );
                                                                                    }
                                                                                })()}
                                                                            </div>
                                                                        </div>
                                                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                                                                            Incluye: <strong>{(customerMembership.memberships.included_services || []).join(', ')}</strong>
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* REFERRER SEARCH FIELD (Moved to be side-by-side with vehicle or full width) */}
                                                                <div style={{ flex: 1, position: 'relative' }}>
                                                                    <label className="label" style={{ fontSize: '0.75rem', marginBottom: '0.25rem', color: 'var(--text-muted)' }}>¿Quién lo refirió? (Opcional)</label>
                                                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                                        <input
                                                                            type="text"
                                                                            className="input"
                                                                            placeholder="🔍 Buscar..."
                                                                            value={referrerSearch}
                                                                            onChange={(e) => {
                                                                                setReferrerSearch(e.target.value);
                                                                                setShowReferrerSearch(true);
                                                                            }}
                                                                            style={{ fontSize: '0.85rem', flex: 1 }}
                                                                        />
                                                                        {formData.referrerId && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    setFormData({ ...formData, referrerId: '' });
                                                                                    setReferrerSearch('');
                                                                                }}
                                                                                className="btn"
                                                                                style={{ backgroundColor: 'var(--danger)', color: 'white', padding: '0 0.5rem' }}
                                                                            >
                                                                                ✕
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                    {showReferrerSearch && referrerSearch.length > 0 && (
                                                                        <div style={{
                                                                            position: 'absolute', top: '100%', left: 0, right: 0,
                                                                            backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)',
                                                                            borderRadius: '0.5rem', maxHeight: '150px', overflowY: 'auto', zIndex: 100,
                                                                            boxShadow: '0 4px 6px rgba(0,0,0,0.2)'
                                                                        }}>
                                                                            {customers
                                                                                .filter(c => c.name.toLowerCase().includes(referrerSearch.toLowerCase()) && c.id != formData.customerId)
                                                                                .slice(0, 10)
                                                                                .map(c => (
                                                                                    <div
                                                                                        key={c.id}
                                                                                        onClick={() => {
                                                                                            setFormData({ ...formData, referrerId: c.id });
                                                                                            setReferrerSearch(c.name);
                                                                                            setShowReferrerSearch(false);
                                                                                        }}
                                                                                        style={{ padding: '0.75rem', cursor: 'pointer', borderBottom: '1px solid var(--border-color)', fontSize: '0.9rem' }}
                                                                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                                                                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                                                                    >
                                                                                        {c.name}
                                                                                    </div>
                                                                                ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div style={{ padding: '1rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
                                                        <h4 style={{ marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Nuevo Cliente Rápido</h4>
                                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '0.5rem' }}>
                                                            <input
                                                                type="text"
                                                                className="input"
                                                                placeholder="Nombre"
                                                                value={newCustomer.name}
                                                                onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                                                            />
                                                            <input
                                                                type="text"
                                                                className="input"
                                                                placeholder="Teléfono"
                                                                value={newCustomer.phone}
                                                                onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                                                            />
                                                            <input
                                                                type="text"
                                                                className="input"
                                                                placeholder="Placa"
                                                                value={newCustomer.vehicle_plate}
                                                                onChange={(e) => setNewCustomer({ ...newCustomer, vehicle_plate: e.target.value })}
                                                            />
                                                            <input
                                                                type="text"
                                                                className="input"
                                                                placeholder="Marca"
                                                                value={newCustomer.vehicle_brand}
                                                                onChange={(e) => setNewCustomer({ ...newCustomer, vehicle_brand: e.target.value })}
                                                            />
                                                            <input
                                                                type="text"
                                                                className="input"
                                                                placeholder="Modelo"
                                                                value={newCustomer.vehicle_model}
                                                                onChange={(e) => setNewCustomer({ ...newCustomer, vehicle_model: e.target.value })}
                                                            />
                                                        </div>

                                                        {/* REFERRER SEARCH FIELD */}
                                                        <div style={{ marginTop: '0.75rem', position: 'relative' }}>
                                                            <label className="label" style={{ fontSize: '0.75rem', marginBottom: '0.25rem', color: 'var(--text-muted)' }}>¿Quién lo refirió? (Opcional)</label>
                                                            <input
                                                                type="text"
                                                                className="input"
                                                                placeholder="🔍 Buscar cliente referente..."
                                                                value={referrerSearch}
                                                                onChange={(e) => {
                                                                    setReferrerSearch(e.target.value);
                                                                    setShowReferrerSearch(true);
                                                                }}
                                                                style={{ fontSize: '0.85rem', height: '36px' }}
                                                            />
                                                            {showReferrerSearch && referrerSearch.length > 0 && (
                                                                <div style={{
                                                                    position: 'absolute', bottom: '100%', left: 0, right: 0,
                                                                    backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)',
                                                                    borderRadius: '0.5rem', maxHeight: '150px', overflowY: 'auto', zIndex: 100,
                                                                    boxShadow: '0 -4px 6px rgba(0,0,0,0.2)'
                                                                }}>
                                                                    {customers
                                                                        .filter(c => c.name.toLowerCase().includes(referrerSearch.toLowerCase()))
                                                                        .slice(0, 10)
                                                                        .map(c => (
                                                                            <div
                                                                                key={c.id}
                                                                                onClick={() => {
                                                                                    setNewCustomer({ ...newCustomer, referrer_id: c.id });
                                                                                    setReferrerSearch(c.name);
                                                                                    setShowReferrerSearch(false);
                                                                                }}
                                                                                style={{ padding: '0.75rem', cursor: 'pointer', borderBottom: '1px solid var(--border-color)', fontSize: '0.9rem' }}
                                                                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                                                                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                                                            >
                                                                                {c.name}
                                                                            </div>
                                                                        ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                                            <button
                                                                type="button"
                                                                className="btn"
                                                                onClick={() => setIsAddingCustomer(false)}
                                                                style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}
                                                            >
                                                                Cancelar
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="btn btn-primary"
                                                                onClick={handleCreateCustomer}
                                                                disabled={!newCustomer.name || !newCustomer.vehicle_plate}
                                                                style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}
                                                            >
                                                                Guardar Cliente
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>


                                                {/* MEMBERSHIP INDICATOR / MANAGER */}
                                                {formData.customerId && !customerMembership && (
                                                    <div style={{
                                                        backgroundColor: 'var(--bg-secondary)',
                                                        border: '1px dashed var(--border-color)',
                                                        padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem'
                                                    }}>
                                                        <div style={{ fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                                                            💎 Añadir Membresía
                                                        </div>
                                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                            <select id="new-membership-select" className="input" style={{ flex: 1, padding: '0.5rem' }}>
                                                                <option value="">Seleccionar plan...</option>
                                                                {memberships.map(m => (
                                                                    <option key={m.id} value={m.id}>{m.name} - ${m.price}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        {formData.vehicleId && (
                                                            <div style={{ marginTop: '0.4rem', fontSize: '0.75rem', color: '#1e40af', backgroundColor: '#eff6ff', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 'bold' }}>
                                                                🔗 Vincular a: {customerVehicles.find(v => v.id === formData.vehicleId) ? getVehicleDisplayName(customerVehicles.find(v => v.id === formData.vehicleId), customers.find(c => c.id === formData.customerId)) : 'Vehículo'} ({customerVehicles.find(v => v.id === formData.vehicleId)?.plate || 'Sin Placa'})
                                                            </div>
                                                        )}
                                                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                                            <button
                                                                type="button"
                                                                className="btn btn-primary"
                                                                onClick={() => {
                                                                    const sel = document.getElementById('new-membership-select');
                                                                    if (sel && sel.value) handleAssignMembership(sel.value);
                                                                }}
                                                            >
                                                                Asignar
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}

                                                {customerMembership && (
                                                    <div style={{
                                                        gridColumn: 'span 2',
                                                        backgroundColor: 'rgba(34, 197, 94, 0.1)',
                                                        border: '1px solid #22C55E',
                                                        padding: '0.75rem',
                                                        borderRadius: '0.5rem',
                                                        marginBottom: '1rem',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        gap: '0.75rem'
                                                    }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                            <div>
                                                                <div style={{ color: '#22C55E', fontWeight: 'bold' }}>💎 Membresía Activa: {customerMembership.memberships?.name || 'Cargando...'}</div>
                                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                                    {customerMembership.memberships?.type === 'unlimited'
                                                                        ? 'Lavados Ilimitados'
                                                                        : `Lavados: ${customerMembership.usage_count} / ${customerMembership.memberships?.limit_count || 0}`}
                                                                </div>
                                                            </div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                <button
                                                                    type="button"
                                                                    onClick={handleRemoveMembership}
                                                                    style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline' }}
                                                                >
                                                                    Cancelar Plan
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(34, 197, 94, 0.2)', paddingTop: '0.5rem' }}>
                                                            {(customerMembership.memberships?.type === 'unlimited' || customerMembership.usage_count < (customerMembership.memberships?.limit_count || 0)) ? (
                                                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isMembershipUsage}
                                                                        onChange={(e) => {
                                                                            setIsMembershipUsage(e.target.checked);
                                                                            if (e.target.checked) setIsExtraWashUsage(false);
                                                                        }}
                                                                        style={{ width: '20px', height: '20px' }}
                                                                    />
                                                                    <span style={{ fontWeight: 'bold' }}>Saldar con Membresía</span>
                                                                </label>
                                                            ) : (
                                                                <span style={{ fontSize: '0.8rem', color: '#EF4444' }}>Límite de lavados alcanzado</span>
                                                            )}

                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                <select
                                                                    className="input"
                                                                    style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem', width: 'auto' }}
                                                                    onChange={(e) => {
                                                                        if (e.target.value) {
                                                                            if (window.confirm("¿Cambiar el plan de membresía?")) {
                                                                                handleAssignMembership(e.target.value);
                                                                            }
                                                                            e.target.value = "";
                                                                        }
                                                                    }}
                                                                >
                                                                    <option value="">Cambiar Plan...</option>
                                                                    {memberships.map(m => (
                                                                        <option key={m.id} value={m.id}>{m.name}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* EXTRA WASH REDEMPTION */}
                                                {availableExtraWashes.length > 0 && (
                                                    <div style={{
                                                        backgroundColor: 'rgba(56, 189, 248, 0.1)',
                                                        border: '1px solid #38bdf8',
                                                        padding: '1rem',
                                                        borderRadius: '0.8rem',
                                                        marginBottom: '1rem'
                                                    }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', flex: 1 }}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isExtraWashUsage}
                                                                    onChange={(e) => {
                                                                        setIsExtraWashUsage(e.target.checked);
                                                                        if (e.target.checked) setIsMembershipUsage(false); // Mutually exclusive for clarity
                                                                    }}
                                                                    style={{ width: '22px', height: '22px' }}
                                                                />
                                                                <div>
                                                                    <div style={{ fontWeight: 'bold', color: '#0369a1' }}>🎁 Usar Lavada Extra (Cortesía)</div>
                                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                                                        Disponibles: <strong>{availableExtraWashes.length}</strong>
                                                                    </div>
                                                                </div>
                                                            </label>
                                                            <div style={{ fontSize: '1.2rem' }}>✨</div>
                                                        </div>
                                                    </div>
                                                )}

                                                <div style={{ marginBottom: '1rem' }}>
                                                    <label className="label">Servicio Principal</label>
                                                    <select
                                                        className="input"
                                                        required
                                                        value={formData.serviceId}
                                                        onChange={handleServiceChange}
                                                    >
                                                        <option value="">Seleccionar Servicio...</option>
                                                        {sortedServices.map(s => (
                                                            <option key={s.id} value={s.id}>{s.name} - ${s.price}</option>
                                                        ))}
                                                    </select>
                                                </div>

                                                {/* SECONDARY SERVICES (EXTRAS) */}
                                                <div style={{ marginBottom: '1rem' }}>
                                                    <label className="label">Servicios Secundarios</label>
                                                    <select
                                                        className="input"
                                                        value=""
                                                        onChange={(e) => {
                                                            const sId = e.target.value;
                                                            if (!sId) return;
                                                            const s = services.find(srv => srv.id == sId);
                                                            if (s) {
                                                                // CHECK FOR MULTI-EMPLOYEE ASSIGNMENT
                                                                if (formData.selectedEmployees && formData.selectedEmployees.length > 1) {
                                                                    setPendingExtra(s);
                                                                    setShowAssignmentModal(true);
                                                                } else {
                                                                    // Single employee or none: Add directly
                                                                    addExtra(s, null);
                                                                }
                                                            }
                                                        }}
                                                    >
                                                        <option value="">Seleccionar Servicio Secundario...</option>
                                                        {sortedServices.map(s => (
                                                            <option key={s.id} value={s.id}>{s.name} - ${s.price}</option>
                                                        ))}
                                                    </select>
                                                </div>

                                                {/* LIST OF ADDED EXTRAS */}
                                                {formData.extras && formData.extras.length > 0 && (
                                                    <div style={{ marginBottom: '1rem', padding: '0.5rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '0.5rem' }}>
                                                        <label className="label" style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>Servicios Agregados:</label>
                                                        {formData.extras.map((extra, index) => (
                                                            <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem', fontSize: '0.9rem', padding: '0.25rem 0.5rem', backgroundColor: 'var(--bg-card)', borderRadius: '0.25rem' }}>
                                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                                    <span>{extra.description} (${extra.price})</span>
                                                                    {extra.assignedTo && (
                                                                        <span style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>
                                                                            Hecho por: {employees.find(e => e.id === extra.assignedTo)?.name || 'Desconocido'}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <button type="button" onClick={() => handleRemoveExtra(index)} style={{ color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer' }}>
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                <div style={{ marginBottom: '1rem' }}>
                                                    <label className="label">Hora del Servicio</label>
                                                    <input
                                                        type="time"
                                                        className="input"
                                                        required
                                                        value={formData.serviceTime}
                                                        onChange={(e) => setFormData({ ...formData, serviceTime: e.target.value })}
                                                    />
                                                </div>
                                            </div>
                                        </div>



                                        {/* TOTAL PRICE DISPLAY */}
                                        <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'rgba(99, 102, 241, 0.1)', borderRadius: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontWeight: 'bold' }}>Total Estimado:</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary)' }}>$</span>
                                                <input
                                                    type="number"
                                                    className="input"
                                                    value={formData.price || 0}
                                                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                                                    style={{ 
                                                        width: '100px', 
                                                        fontSize: '1.5rem', 
                                                        fontWeight: 'bold', 
                                                        color: 'var(--primary)',
                                                        backgroundColor: 'transparent',
                                                        border: '1px solid var(--primary)',
                                                        textAlign: 'right',
                                                        padding: '0.2rem 0.5rem'
                                                    }}
                                                    step="0.01"
                                                    min="0"
                                                />
                                            </div>
                                        </div>



                                        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                                            <button type="button" className="btn" onClick={() => setIsModalOpen(false)} style={{ backgroundColor: 'var(--bg-secondary)', color: 'white' }}>
                                                Cancelar
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-primary"
                                                onClick={handleSubmit}
                                                disabled={isSubmitting}
                                                style={{ opacity: isSubmitting ? 0.7 : 1 }}
                                            >
                                                {isSubmitting ? 'Registrando...' : 'Registrar Venta'}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div >
                        )
    );
};

export default TransactionModal;
