// CustomerDetailView.jsx - Extracted from DashboardPanel.jsx
import React from 'react';
import { useDashboard } from '../../context/DashboardContext';
import { X, Star, DollarSign, Play, Edit2, QrCode, Send, Clock, RefreshCw, Phone } from 'lucide-react';

const CustomerDetailView = () => {
    const {
        activeDetailModal, setActiveDetailModal,
        filteredFeedbacks,
        setViewingPhoto,
        transactions,
        handleDeleteTransactionV2,
        getServiceName,
        statsTransactions,
        dateFilter,
        todayStr,
        getPRDateString,
        getPaymentMethodLabel,
        handlePayment,
        userRole,
        vehicles,
        handleStartService,
        setEditingTransactionId,
        setQrTransactionId,
        handleOpenVerification,
        handleMarkAsUnpaid,
        handleRevertToInProgress,
        getTransactionCategory,
        calculateTxTotal,
        totalIncome,
        employees,
        formatToFraction,
        filteredExpenses,
        myUserId,
        myEmployeeId,
        netCommissions,
        totalLunches,
        fractionalCount,
        selectedTransaction, setSelectedTransaction
    } = useDashboard();

    if (!activeDetailModal) return null;

    return (
                            <div style={{
                                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                                backgroundColor: 'rgba(0,0,0,0.8)',
                                display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000
                            }} onClick={() => setActiveDetailModal(null)}>
                                <div style={{
                                    backgroundColor: 'var(--bg-card)',
                                    padding: '2rem',
                                    borderRadius: '0.5rem',
                                    width: '90%',
                                    maxWidth: '600px',
                                    maxHeight: '80vh',
                                    overflowY: 'auto'
                                }} onClick={e => e.stopPropagation()}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                        <h2 style={{ margin: 0 }}>
                                            {activeDetailModal === 'cars' && '🚗 Detalle de Autos'}
                                            {activeDetailModal === 'waiting_list' && '⏳ Cola de Espera'}
                                            {activeDetailModal === 'in_progress_list' && '🚿 Autos en Proceso'}
                                            {activeDetailModal === 'ready_list' && '✅ Listos para Recoger'}
                                            {activeDetailModal === 'income' && '💰 Desglose de Ingresos'}
                                            {activeDetailModal === 'commissions' && '👥 Desglose de Comisiones'}
                                            {activeDetailModal === 'feedback' && '💬 Feedback Privado de Clientes'}
                                        </h2>
                                        <button
                                            onClick={() => setActiveDetailModal(null)}
                                            style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
                                        >
                                            <X size={24} />
                                        </button>
                                    </div>

                                    <div style={{ padding: '1.5rem', maxHeight: '70vh', overflowY: 'auto' }}>
                                        {activeDetailModal === 'feedback' && (
                                            <div style={{ display: 'grid', gap: '1rem' }}>
                                                {filteredFeedbacks.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No hay feedbacks en este rango de fechas.</p>}
                                                {filteredFeedbacks.map(f => (
                                                    <div key={f.id} className="card" style={{ padding: '1rem', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                                            <span style={{ fontWeight: 'bold' }}>{f.transactions?.customers?.name || 'Cliente Anónimo'}</span>
                                                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{new Date(f.created_at).toLocaleDateString()}</span>
                                                        </div>
                                                        <div style={{ display: 'flex', gap: '0.2rem', marginBottom: '0.75rem' }}>
                                                            {[1, 2, 3, 4, 5].map(star => (
                                                                <Star key={star} size={16} fill={star <= f.rating ? '#FBBF24' : 'none'} color={star <= f.rating ? '#FBBF24' : 'var(--text-muted)'} />
                                                            ))}
                                                        </div>
                                                        <p style={{ fontSize: '0.95rem', fontStyle: f.comment ? 'normal' : 'italic' }}>
                                                            {f.comment || '(Sin comentario)'}
                                                        </p>
                                                        <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                            Servicio: {f.transactions?.services?.name || 'N/A'}
                                                        </div>

                                                        {f.photo_url && (
                                                            <div style={{ marginTop: '0.75rem', borderRadius: '0.5rem', overflow: 'hidden', border: '1px solid var(--border-color)', width: '80px', height: '80px', cursor: 'pointer' }} onClick={() => setViewingPhoto(f.photo_url)}>
                                                                <img src={f.photo_url} alt="Feedback" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}



                                        {activeDetailModal === 'cancelled' && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                                                {/* SECTION 1: ACTIVE SERVICES (CANCEL HERE) */}
                                                <div>
                                                    <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)', borderBottom: '2px solid var(--primary)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
                                                        ⚠️ Cancelar Servicios Activos
                                                    </h3>
                                                    {transactions.filter(t => ['waiting', 'in_progress', 'ready'].includes(t.status)).length === 0 ?
                                                        <p style={{ color: 'var(--text-muted)' }}>No hay servicios activos para cancelar.</p> : (
                                                            <ul style={{ listStyle: 'none', padding: 0 }}>
                                                                {transactions
                                                                    .filter(t => ['waiting', 'in_progress', 'ready'].includes(t.status))
                                                                    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
                                                                    .map(t => (
                                                                        <li key={t.id} style={{
                                                                            padding: '1rem',
                                                                            backgroundColor: 'var(--bg-secondary)',
                                                                            borderRadius: '0.5rem',
                                                                            marginBottom: '0.75rem',
                                                                            display: 'flex',
                                                                            justifyContent: 'space-between',
                                                                            alignItems: 'center',
                                                                            border: '1px solid var(--border-color)'
                                                                        }}>
                                                                            <div>
                                                                                <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                                                                                    {t.vehicles?.plate || t.customers?.vehicle_plate || 'Sin Placa'}
                                                                                    <span style={{ fontSize: '0.9rem', fontWeight: 'normal', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                                                                                        ({t.vehicles?.model || t.customers?.vehicle_model || 'Modelo?'} - {t.customers?.name})
                                                                                    </span>
                                                                                </div>
                                                                                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem', fontSize: '0.9rem' }}>
                                                                                    <span style={{
                                                                                        backgroundColor: t.status === 'waiting' ? '#F59E0B' : t.status === 'in_progress' ? '#3B82F6' : '#10B981',
                                                                                        color: 'white', padding: '0.1rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem'
                                                                                    }}>
                                                                                        {t.status === 'waiting' ? 'En Cola' : t.status === 'in_progress' ? 'Lavando' : 'Listo'}
                                                                                    </span>
                                                                                    <span style={{ color: 'var(--text-muted)' }}>{getServiceName(t.service_id)}</span>
                                                                                </div>
                                                                            </div>
                                                                            <button
                                                                                className="btn"
                                                                                onClick={() => handleDeleteTransactionV2(t.id)}
                                                                                style={{
                                                                                    backgroundColor: '#EF4444',
                                                                                    color: 'white',
                                                                                    fontWeight: 'bold',
                                                                                    padding: '0.5rem 1rem'
                                                                                }}
                                                                            >
                                                                                CANCELAR
                                                                            </button>
                                                                        </li>
                                                                    ))}
                                                            </ul>
                                                        )}
                                                </div>

                                                {/* SECTION 2: HISTORY */}
                                                <div>
                                                    <h3 style={{ fontSize: '1rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
                                                        🕒 Historial de Cancelados (Hoy)
                                                    </h3>
                                                    {transactions.filter(t => t.status === 'cancelled').length === 0 ? <p style={{ color: 'var(--text-muted)' }}>No hay servicios cancelados hoy.</p> : (
                                                        <ul style={{ listStyle: 'none', padding: 0 }}>
                                                            {[...transactions]
                                                                .filter(t => t.status === 'cancelled')
                                                                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                                                                .map(t => (
                                                                    <li key={t.id} style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.8 }}>
                                                                        <div>
                                                                            <div style={{ fontWeight: 'bold', color: '#EF4444' }}>
                                                                                {new Date(t.created_at).toLocaleTimeString('es-PR', { timeZone: 'America/Puerto_Rico', hour: '2-digit', minute: '2-digit' })}
                                                                                <span style={{ margin: '0 0.5rem', color: 'var(--text-primary)' }}>-</span>
                                                                                <span style={{ textDecoration: 'line-through', color: 'var(--text-muted)' }}>
                                                                                    {t.customers?.vehicle_plate || 'Sin Placa'}
                                                                                </span>
                                                                            </div>
                                                                            <div style={{ fontSize: '0.8rem', marginTop: '0.2rem', color: 'var(--text-primary)' }}>
                                                                                🚫 Cancelado por: <strong>{t.cancelled_by || 'Usuario'}</strong>
                                                                            </div>
                                                                        </div>
                                                                    </li>
                                                                ))}
                                                        </ul>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {activeDetailModal === 'cars' && (
                                            <div>
                                                {statsTransactions.filter(t =>
                                                    getTransactionCategory(t) !== 'membership_sale' &&
                                                    t.status !== 'unpaid' &&
                                                    (dateFilter !== 'today' || getPRDateString(t.date) === todayStr)
                                                ).length === 0 ? <p>No hay autos registrados hoy.</p> : (
                                                    <ul style={{ listStyle: 'none', padding: 0 }}>
                                                        {[...statsTransactions]
                                                            .filter(t =>
                                                                getTransactionCategory(t) !== 'membership_sale' &&
                                                                t.status !== 'unpaid' &&
                                                                (dateFilter !== 'today' || getPRDateString(t.date) === todayStr)
                                                            )
                                                            .sort((a, b) => {
                                                                const dateA = new Date(a.date);
                                                                const dateB = new Date(b.date);
                                                                if (dateB - dateA !== 0) return dateB - dateA;
                                                                return new Date(b.created_at) - new Date(a.created_at);
                                                            })
                                                            .map(t => (
                                                                <li key={t.id} style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                    <div>
                                                                        <div style={{ fontWeight: 'bold' }}>
                                                                            {new Date(t.date).toLocaleTimeString('es-PR', { timeZone: 'America/Puerto_Rico', hour: '2-digit', minute: '2-digit' })}
                                                                            <span style={{ margin: '0 0.5rem' }}>-</span>
                                                                            {t.vehicles?.plate || t.customers?.vehicle_plate || 'Sin Placa'}
                                                                            <span style={{ color: 'var(--text-muted)', fontWeight: 'normal', marginLeft: '0.5rem' }}>
                                                                                ({t.vehicles?.model || t.customers?.vehicle_model || 'Modelo?'} - {t.customers?.name})
                                                                            </span>
                                                                        </div>
                                                                        {t.finished_at && (
                                                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                                                Esperó: {Math.round((new Date(t.finished_at) - new Date(t.created_at)) / 60000)} min
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <div style={{ textAlign: 'right' }}>
                                                                        <span style={{
                                                                            fontSize: '0.75rem',
                                                                            padding: '0.1rem 0.4rem',
                                                                            borderRadius: '4px',
                                                                            marginRight: '0.5rem',
                                                                            backgroundColor: t.payment_method === 'cash' ? 'rgba(16, 185, 129, 0.2)' : t.payment_method === 'card' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                                                                            color: t.payment_method === 'cash' ? '#10B981' : t.payment_method === 'card' ? '#3B82F6' : '#F59E0B',
                                                                            border: `1px solid ${t.payment_method === 'cash' ? '#10B981' : t.payment_method === 'card' ? '#3B82F6' : '#F59E0B'}`
                                                                        }}>
                                                                            {getPaymentMethodLabel(t.payment_method)}
                                                                        </span>
                                                                        <span style={{ color: 'var(--primary)' }}>{getServiceName(t.service_id)}</span>
                                                                        {(userRole === 'admin' || userRole === 'manager') && (
                                                                            <button
                                                                                onClick={() => handlePayment(t)}
                                                                                style={{
                                                                                    marginLeft: '1rem',
                                                                                    background: 'none',
                                                                                    border: 'none',
                                                                                    color: 'var(--success)',
                                                                                    cursor: 'pointer',
                                                                                    display: 'inline-flex',
                                                                                    alignItems: 'center',
                                                                                    gap: '0.2rem',
                                                                                    fontSize: '0.8rem',
                                                                                    fontWeight: 'bold'
                                                                                }}
                                                                            >
                                                                                <DollarSign size={14} /> Recibo
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </li>
                                                            ))}
                                                    </ul>
                                                )}
                                            </div>
                                        )}

                                        {activeDetailModal === 'waiting_list' && (
                                            <div>
                                                {statsTransactions.filter(t => t.status === 'waiting').length === 0 ? (
                                                    <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No hay autos en espera.</p>
                                                ) : (
                                                    <ul className="mobile-card-list" style={{ listStyle: 'none', padding: 0 }}>
                                                        {statsTransactions.filter(t => t.status === 'waiting').map(t => {
                                                            const vehicle = vehicles.find(v => v.id === t.vehicle_id);
                                                            let vehicleDisplayName = 'Modelo N/A';

                                                            const brand = (vehicle?.brand && vehicle.brand !== 'Generico' && vehicle.brand !== 'Generic' && vehicle.brand !== 'null') ? vehicle.brand : (t.customers?.vehicle_brand || '');
                                                            const model = vehicle?.model || t.customers?.vehicle_model || (Array.isArray(t.extras) ? t.extras.find(e => e.vehicle_model)?.vehicle_model : t.extras?.vehicle_model) || 'Modelo N/A';
                                                            vehicleDisplayName = `${brand} ${model}`.trim();

                                                            return (
                                                                <li key={t.id} className="mobile-card-item" style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(255,255,255,0.02)', marginBottom: '0.5rem', borderRadius: '8px' }}>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                                        <div>
                                                                            <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{vehicleDisplayName}</div>
                                                                            <div style={{ color: 'var(--text-muted)' }}>
                                                                                {t.customers?.name}
                                                                                {(t.vehicles?.plate || t.customers?.vehicle_plate || t.extras?.vehicle_plate) && <span style={{ color: 'var(--text-primary)', marginLeft: '0.5rem', fontWeight: 'bold' }}>({t.vehicles?.plate || t.customers?.vehicle_plate || t.extras?.vehicle_plate})</span>}
                                                                            </div>
                                                                            <div style={{ color: 'var(--primary)', fontWeight: 'bold', marginTop: '0.2rem' }}>{getServiceName(t.service_id)}</div>
                                                                            <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.2rem' }}>
                                                                                Llegada: {new Date(t.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                            </div>
                                                                            <div style={{ fontSize: '0.8rem', color: '#F59E0B', marginTop: '0.2rem', fontWeight: 'bold' }}>
                                                                                Espera: {Math.round((new Date() - new Date(t.created_at)) / 60000)} min
                                                                            </div>
                                                                        </div>
                                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                                            <button
                                                                                className="btn btn-primary"
                                                                                onClick={() => handleStartService(t.id)}
                                                                                style={{ padding: '0.5rem 1rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                                                            >
                                                                                <Play size={18} style={{ minWidth: '18px' }} /> <span style={{ fontWeight: '600' }}>Comenzar</span>
                                                                            </button>
                                                                            <button
                                                                                onClick={() => setEditingTransactionId(t.id)}
                                                                                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline', display: 'flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'flex-end' }}
                                                                            >
                                                                                <Edit2 size={14} /> Editar
                                                                            </button>
                                                                            <button
                                                                                onClick={() => setQrTransactionId(t.id)}
                                                                                style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'flex-end' }}
                                                                            >
                                                                                <QrCode size={14} /> Ver QR
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                </li>
                                                            );
                                                        })}
                                                    </ul>
                                                )}
                                            </div>
                                        )}



                                        {activeDetailModal === 'in_progress_list' && (
                                            <div>
                                                {statsTransactions.filter(t => t.status === 'in_progress').length === 0 ? <p>No hay autos lavándose.</p> : (
                                                    <ul className="mobile-card-list" style={{ listStyle: 'none', padding: 0 }}>
                                                        {statsTransactions
                                                            .filter(t => t.status === 'in_progress')
                                                            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                                                            .map(t => {
                                                                const vehicle = vehicles.find(v => v.id === t.vehicle_id);
                                                                let vehicleDisplayName = 'Modelo N/A';

                                                                const brand = (vehicle?.brand && vehicle.brand !== 'Generico' && vehicle.brand !== 'Generic' && vehicle.brand !== 'null') ? vehicle.brand : (t.customers?.vehicle_brand || '');
                                                                const model = vehicle?.model || t.customers?.vehicle_model || (Array.isArray(t.extras) ? t.extras.find(e => e.vehicle_model)?.vehicle_model : t.extras?.vehicle_model) || 'Modelo N/A';
                                                                vehicleDisplayName = `${brand} ${model}`.trim();

                                                                // Calculate Wash Time (Current - Started)
                                                                const start = t.started_at ? new Date(t.started_at) : new Date(t.created_at); // Fallback to created_at if started_at missing
                                                                const now = new Date();
                                                                const diffMs = now - start;
                                                                const diffMins = Math.floor(diffMs / 60000);
                                                                const hours = Math.floor(diffMins / 60);
                                                                const mins = diffMins % 60;
                                                                const timeString = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

                                                                return (
                                                                    <li key={t.id} className="mobile-card-item" style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(255,255,255,0.02)', marginBottom: '0.5rem', borderRadius: '8px' }}>
                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                                            <div>
                                                                                <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{vehicleDisplayName}</div>
                                                                                <div style={{ color: 'var(--text-muted)' }}>
                                                                                    {t.customers?.name}
                                                                                    {(vehicle?.plate || t.vehicles?.plate || t.customers?.vehicle_plate || (Array.isArray(t.extras) ? t.extras.find(e => e.vehicle_plate)?.vehicle_plate : t.extras?.vehicle_plate)) &&
                                                                                        <span style={{ color: 'var(--text-primary)', marginLeft: '0.5rem', fontWeight: 'bold' }}>
                                                                                            ({vehicle?.plate || t.vehicles?.plate || t.customers?.vehicle_plate || (Array.isArray(t.extras) ? t.extras.find(e => e.vehicle_plate)?.vehicle_plate : t.extras?.vehicle_plate)})
                                                                                        </span>}
                                                                                </div>
                                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                                                                                    <div style={{ color: 'var(--warning)', fontWeight: 'bold' }}>
                                                                                        {getServiceName(t.service_id)} - Total: ${parseFloat(t.price || 0).toFixed(2)}
                                                                                    </div>
                                                                                    <div style={{
                                                                                        fontSize: '0.8rem',
                                                                                        backgroundColor: 'rgba(245, 158, 11, 0.15)',
                                                                                        color: '#F59E0B',
                                                                                        padding: '2px 6px',
                                                                                        borderRadius: '4px',
                                                                                        display: 'flex',
                                                                                        alignItems: 'center',
                                                                                        gap: '4px'
                                                                                    }}>
                                                                                        <Clock size={12} />
                                                                                        {timeString}
                                                                                    </div>
                                                                                </div>
                                                                                {/* Show Wait Time for context */}
                                                                                <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.2rem' }}>
                                                                                    Espera: {Math.round((new Date(t.started_at || t.created_at) - new Date(t.created_at)) / 60000)}m
                                                                                </div>

                                                                                {/* Assigned Employees */}
                                                                                <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                                                                                    {t.transaction_assignments?.map(a => (
                                                                                        <span key={a.employee_id} style={{ fontSize: '0.75rem', backgroundColor: '#333', padding: '2px 6px', borderRadius: '4px' }}>
                                                                                            {getEmployeeName(a.employee_id)}
                                                                                        </span>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
                                                                                <button
                                                                                    className="btn"
                                                                                    onClick={() => handleOpenVerification(t)}
                                                                                    title="Verificar y Notificar"
                                                                                    style={{ backgroundColor: '#3B82F6', color: 'white', padding: '0.5rem 1rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                                                                >
                                                                                    <Send size={18} style={{ minWidth: '18px' }} /> <span style={{ fontWeight: '600' }}>Listo</span>
                                                                                </button>
                                                                                <button
                                                                                    onClick={() => setEditingTransactionId(t.id)}
                                                                                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                                                                >
                                                                                    <Edit2 size={14} /> Editar

                                                                                </button>
                                                                                <button
                                                                                    onClick={() => setQrTransactionId(t.id)}
                                                                                    style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                                                                >
                                                                                    <QrCode size={14} /> Ver QR
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    </li>
                                                                );
                                                            })}
                                                    </ul>
                                                )}
                                            </div>
                                        )}

                                        {activeDetailModal === 'ready_list' && (
                                            <div>
                                                {statsTransactions.filter(t => t.status === 'ready').length === 0 ? <p>No hay autos listos para recoger.</p> : (
                                                    <ul className="mobile-card-list" style={{ listStyle: 'none', padding: 0 }}>
                                                        {statsTransactions
                                                            .filter(t => t.status === 'ready')
                                                            .sort((a, b) => new Date(b.finished_at) - new Date(a.finished_at))
                                                            .map(t => {
                                                                const vehicle = vehicles.find(v => v.id === t.vehicle_id);
                                                                const brand = (vehicle?.brand && vehicle.brand !== 'null' && vehicle.brand !== 'Generico') ? vehicle.brand : (t.customers?.vehicle_brand || '');
                                                                const model = vehicle?.model || t.customers?.vehicle_model || (Array.isArray(t.extras) ? t.extras.find(e => e.vehicle_model)?.vehicle_model : t.extras?.vehicle_model) || 'Modelo N/A';
                                                                const vehicleModel = `${brand} ${model}`.trim();
                                                                return (
                                                                    <li key={t.id} className="mobile-card-item" style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(16, 185, 129, 0.05)', marginBottom: '0.5rem', borderRadius: '8px', borderLeft: '4px solid #10B981' }}>
                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                                            <div>
                                                                                <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--text-primary)' }}>{vehicleModel}</div>
                                                                                <div style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                                                                                    ({vehicle?.plate || t.vehicles?.plate || t.customers?.vehicle_plate || (Array.isArray(t.extras) ? t.extras.find(e => e.vehicle_plate)?.vehicle_plate : t.extras?.vehicle_plate) || 'Sin Placa'})
                                                                                </div>
                                                                                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{t.customers?.name}</div>

                                                                                {/* NEW: Show finish photo in ready list */}
                                                                                {t.finish_photo_url && (
                                                                                    <div style={{ marginTop: '1.5rem', marginBottom: '1rem', borderRadius: '0.5rem', overflow: 'hidden', border: '1px solid var(--border-color)', width: '120px', height: '120px', cursor: 'pointer' }} onClick={() => setViewingPhoto(t.finish_photo_url)}>
                                                                                        <img src={t.finish_photo_url} alt="Recoger" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                                    </div>
                                                                                )}

                                                                                <div style={{ color: 'var(--success)', fontWeight: 'bold', marginTop: '0.2rem' }}>
                                                                                    {getServiceName(t.service_id)} - Total: ${parseFloat(t.price || 0).toFixed(2)}
                                                                                </div>

                                                                                {t.finished_at && (
                                                                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                                                                        <div>Llegada: {new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                                                                        <div>Espera: {Math.round((new Date(t.started_at || t.created_at) - new Date(t.created_at)) / 60000)} min</div>
                                                                                        <div>Lavado: {Math.round((new Date(t.finished_at) - new Date(t.started_at || t.created_at)) / 60000)} min</div>
                                                                                        <div style={{ fontWeight: 'bold', color: 'var(--success)' }}>Listo hace: {Math.round((new Date() - new Date(t.finished_at)) / 60000)} min</div>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
                                                                                <button
                                                                                    className="btn"
                                                                                    onClick={() => handlePayment(t)}
                                                                                    style={{ backgroundColor: 'var(--success)', color: 'white', padding: '0.5rem 1rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                                                                >
                                                                                    <DollarSign size={18} style={{ minWidth: '18px' }} /> <span style={{ fontWeight: '600' }}>Pagar</span>
                                                                                </button>

                                                                                <button
                                                                                    className="btn"
                                                                                    onClick={() => handleMarkAsUnpaid(t)}
                                                                                    style={{ backgroundColor: '#ef4444', color: 'white', padding: '0.4rem 0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                                                                                >
                                                                                    <Clock size={14} /> <span>A Deudores</span>
                                                                                </button>

                                                                                <button
                                                                                    className="btn"
                                                                                    onClick={() => handleRevertToInProgress(t)}
                                                                                    title="Devolver a En Proceso"
                                                                                    style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', padding: '0.4rem 0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                                                                                >
                                                                                    <RefreshCw size={14} /> <span>En Proceso</span>
                                                                                </button>

                                                                                <button
                                                                                    onClick={() => setEditingTransactionId(t.id)}
                                                                                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                                                                >
                                                                                    <Edit2 size={14} /> Editar
                                                                                </button>
                                                                                <button
                                                                                    onClick={() => setQrTransactionId(t.id)}
                                                                                    style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                                                                >
                                                                                    <QrCode size={14} /> Ver QR
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    </li>
                                                                );
                                                            })}
                                                    </ul>
                                                )}
                                            </div>
                                        )}

                                        {activeDetailModal === 'unpaid_list' && (
                                            <div>
                                                {statsTransactions.filter(t => t.status === 'unpaid').length === 0 ? <p>No hay deudas pendientes.</p> : (
                                                    <ul className="mobile-card-list" style={{ listStyle: 'none', padding: 0 }}>
                                                        {statsTransactions
                                                            .filter(t => t.status === 'unpaid')
                                                            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                                                            .map(t => {
                                                                const vehicle = vehicles.find(v => v.id === t.vehicle_id);
                                                                const brand = (vehicle?.brand && vehicle.brand !== 'null' && vehicle.brand !== 'Generico') ? vehicle.brand : (t.customers?.vehicle_brand || '');
                                                                const model = vehicle?.model || t.customers?.vehicle_model || (Array.isArray(t.extras) ? t.extras.find(e => e.vehicle_model)?.vehicle_model : t.extras?.vehicle_model) || 'Modelo N/A';
                                                                const vehicleModel = `${brand} ${model}`.trim();
                                                                const extrasTotal = t.extras?.reduce((sum, e) => sum + e.price, 0) || 0;
                                                                const totalToPay = (parseFloat(t.price) + extrasTotal).toFixed(2);

                                                                return (
                                                                    <li key={t.id} className="mobile-card-item" style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(239, 68, 68, 0.05)', marginBottom: '0.5rem', borderRadius: '8px', borderLeft: '4px solid #ef4444' }}>
                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                                            <div>
                                                                                <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--text-primary)' }}>{vehicleModel}</div>
                                                                                <div style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                                                                                    ({vehicle?.plate || t.vehicles?.plate || 'Sin Placa'})
                                                                                </div>
                                                                                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{t.customers?.name}</div>
                                                                                <div style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '1.1rem', marginTop: '0.5rem' }}>DEUDA: ${totalToPay}</div>
                                                                            </div>
                                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
                                                                                <button
                                                                                    className="btn"
                                                                                    onClick={() => handlePayment(t)}
                                                                                    style={{ backgroundColor: 'var(--success)', color: 'white', padding: '0.4rem 0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                                                                >
                                                                                    <DollarSign size={18} /> <span style={{ fontWeight: '600' }}>Cobrar</span>
                                                                                </button>

                                                                                <button
                                                                                    className="btn"
                                                                                    onClick={() => handleSendDebtReminder(t)}
                                                                                    style={{ backgroundColor: '#25D366', color: 'white', padding: '0.4rem 0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                                                                >
                                                                                    <Phone size={16} /> <span>Recordar</span>
                                                                                </button>

                                                                                <button
                                                                                    onClick={() => setEditingTransactionId(t.id)}
                                                                                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem' }}
                                                                                >
                                                                                    Editar
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    </li>
                                                                );
                                                            })}
                                                    </ul>
                                                )}
                                            </div>
                                        )}

                                        {
                                            activeDetailModal === 'income' && (
                                                <div>
                                                    <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '0.5rem' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                                            <span>Efectivo:</span>
                                                            <span style={{ fontWeight: 'bold' }}>${statsTransactions.filter(t => (t.status === 'completed' || t.status === 'paid' || t.status === 'ready') && getTransactionCategory(t) === 'cash').reduce((sum, t) => sum + calculateTxTotal(t), 0).toFixed(2)}</span>
                                                        </div>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                                            <span>Tarjeta:</span>
                                                            <span style={{ fontWeight: 'bold' }}>${statsTransactions.filter(t => (t.status === 'completed' || t.status === 'paid' || t.status === 'ready') && getTransactionCategory(t) === 'card').reduce((sum, t) => sum + calculateTxTotal(t), 0).toFixed(2)}</span>
                                                        </div>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                            <span>Ath Móvil:</span>
                                                            <span style={{ fontWeight: 'bold' }}>${statsTransactions.filter(t => (t.status === 'completed' || t.status === 'paid' || t.status === 'ready') && getTransactionCategory(t) === 'transfer').reduce((sum, t) => sum + calculateTxTotal(t), 0).toFixed(2)}</span>
                                                        </div>
                                                        <hr style={{ borderColor: 'var(--border-color)', margin: '1rem 0' }} />
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', color: 'var(--success)' }}>
                                                            <span>Total:</span>
                                                            <span>${totalIncome.toFixed(2)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        }

                                        {
                                            activeDetailModal === 'commissions' && (
                                                <div>
                                                    {userRole === 'admin' ? (
                                                        // VISTA DE ADMIN: LISTA DE EMPLEADOS
                                                        <ul style={{ listStyle: 'none', padding: 0 }}>
                                                            {employees.map(emp => {
                                                                // Calculate commission for this employee
                                                                const empCommission = statsTransactions.reduce((sum, t) => {
                                                                    // SOLO contar si está completado
                                                                    if (t.status !== 'completed') return sum;

                                                                    const isAssigned = t.transaction_assignments?.some(a => a.employee_id === emp.id);
                                                                    const isPrimary = t.employee_id === emp.id;

                                                                    if (isAssigned || isPrimary) {
                                                                        const txTotalCommission = (parseFloat(t.commission_amount) || 0);
                                                                        const tip = (parseFloat(t.tip) || 0);
                                                                        const uniqueAssignees = new Set((t.transaction_assignments || []).map(a => a.employee_id));
                                                                        const count = uniqueAssignees.size > 0 ? uniqueAssignees.size : 1;

                                                                        // Calculate Extras assigned to THIS employee
                                                                        const myExtras = t.extras?.filter(e => e.assignedTo === emp.id) || [];
                                                                        const myExtrasCommission = myExtras.reduce((s, e) => s + (parseFloat(e.commission) || 0), 0);

                                                                        // Calculate Total Assigned Extras (to subtract from pool)
                                                                        const allAssignedExtras = t.extras?.filter(e => e.assignedTo) || [];
                                                                        const allAssignedCommission = allAssignedExtras.reduce((s, e) => s + (parseFloat(e.commission) || 0), 0);

                                                                        // Shared Pool
                                                                        const sharedPool = Math.max(0, txTotalCommission - allAssignedCommission);
                                                                        const sharedShare = sharedPool / count;
                                                                        const tipShare = tip / count;

                                                                        return sum + sharedShare + tipShare + myExtrasCommission;
                                                                    }
                                                                    return sum;
                                                                }, 0);

                                                                // Calculate lunches
                                                                const empLunches = filteredExpenses
                                                                    .filter(e => e.employee_id === emp.id)
                                                                    .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

                                                                const empNet = empCommission - empLunches;

                                                                if (empCommission === 0 && empLunches === 0) return null;

                                                                // Calculate fractional car count for this employee
                                                                const empFractionalCount = statsTransactions
                                                                    .filter(t => t.status === 'completed' || t.status === 'paid')
                                                                    .reduce((sum, t) => {
                                                                        const isAssigned = t.transaction_assignments?.some(a => a.employee_id === emp.id);
                                                                        const isPrimary = t.employee_id === emp.id;

                                                                        if (isAssigned || isPrimary) {
                                                                            const uniqueAssignees = new Set((t.transaction_assignments || []).map(a => a.employee_id));
                                                                            const count = uniqueAssignees.size > 0 ? uniqueAssignees.size : 1;
                                                                            return sum + (1 / count);
                                                                        }
                                                                        return sum;
                                                                    }, 0);

                                                                return (
                                                                    <li key={emp.id} style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginBottom: '0.25rem' }}>
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                                <span>{emp.name}</span>
                                                                                <span style={{ fontSize: '0.8rem', backgroundColor: 'var(--bg-secondary)', padding: '0.1rem 0.4rem', borderRadius: '4px', color: 'var(--primary)' }}>
                                                                                    {formatToFraction(empFractionalCount)} Autos
                                                                                </span>
                                                                            </div>
                                                                            <span style={{ color: empNet >= 0 ? 'var(--success)' : 'var(--danger)' }}>${empNet.toFixed(2)}</span>
                                                                        </div>
                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                                                            <span>Comisión: ${empCommission.toFixed(2)}</span>
                                                                            <span>Almuerzos: -${empLunches.toFixed(2)}</span>
                                                                        </div>
                                                                    </li>
                                                                );
                                                            })}
                                                        </ul>
                                                    ) : (
                                                        // VISTA DE EMPLEADO: LISTA DE SUS TRANSACCIONES
                                                        <div>
                                                            <h4 style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>
                                                                Mis Trabajos de Hoy ({formatToFraction(fractionalCount)})
                                                            </h4>
                                                            <ul style={{ listStyle: 'none', padding: 0 }}>
                                                                {statsTransactions
                                                                    .filter(t => t.status === 'completed') // SOLO completados
                                                                    .map(t => {
                                                                        // Calcular mi parte de esta transacción
                                                                        const txTotalCommission = (parseFloat(t.commission_amount) || 0); // Base commission
                                                                        const tip = (parseFloat(t.tip) || 0);

                                                                        // 1. Separate Assigned vs Shared Commissions
                                                                        let myAssignedCommission = 0;
                                                                        let totalAssignedCommission = 0;

                                                                        if (t.extras && Array.isArray(t.extras)) {
                                                                            t.extras.forEach(extra => {
                                                                                if (extra.assignedTo) {
                                                                                    const extraComm = parseFloat(extra.commission || 0);
                                                                                    totalAssignedCommission += extraComm;
                                                                                    if (extra.assignedTo === myUserId || extra.assignedTo === myEmployeeId) { // Check both ID types just in case
                                                                                        myAssignedCommission += extraComm;
                                                                                    }
                                                                                    // Also check if assignedTo matches the current iteration employee 'emp' (for Admin View) or 'myself'
                                                                                    // Fix: simpler iteration below
                                                                                }
                                                                            });
                                                                        }

                                                                        const sharedCommissionPool = Math.max(0, txTotalCommission - totalAssignedCommission);
                                                                        const uniqueAssignees = new Set((t.transaction_assignments || []).map(a => a.employee_id));
                                                                        const count = uniqueAssignees.size > 0 ? uniqueAssignees.size : 1;

                                                                        // 2. Logic: (Shared / Count) + MyAssigned + (Tip / Count)
                                                                        // Usage: This block is inside the 'admin' map OR 'employee' map.
                                                                        // We need to know 'who' we are calculating for.
                                                                        // Since this replacement block targets the 'employee' view (lines 1353+),
                                                                        // we are iterating 't' but we are the logged-in user.

                                                                        // Wait, for the 'employee' view, we need to filter assigned extras for THIS user.
                                                                        // Detailed logic:
                                                                        const myExtras = t.extras?.filter(e => e.assignedTo === myEmployeeId) || [];
                                                                        const myExtrasCommission = myExtras.reduce((sum, e) => sum + (parseFloat(e.commission) || 0), 0);

                                                                        // Re-calculate Total Assigned to subtract from pool
                                                                        const allAssignedExtras = t.extras?.filter(e => e.assignedTo) || [];
                                                                        const allAssignedCommission = allAssignedExtras.reduce((sum, e) => sum + (parseFloat(e.commission) || 0), 0);

                                                                        const sharedPool = Math.max(0, txTotalCommission - allAssignedCommission);
                                                                        const sharedShare = sharedPool / count;
                                                                        const tipShare = tip / count;

                                                                        const myShare = sharedShare + tipShare + myExtrasCommission;

                                                                        return (
                                                                            <li key={t.id} style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                                <div>
                                                                                    <div style={{ fontWeight: 'bold' }}>{t.customers?.name || 'Cliente Casual'}</div>
                                                                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                                                                        {getServiceName(t.service_id)}
                                                                                        {count > 1 && (
                                                                                            <span style={{ marginLeft: '0.5rem', color: 'var(--warning)', fontWeight: 'bold' }}>
                                                                                                (1/{count})
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                    {myExtras.length > 0 && (
                                                                                        <div style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>
                                                                                            + {myExtras.length} Extras Propios
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                                <div style={{ textAlign: 'right' }}>
                                                                                    <div style={{ color: 'var(--success)', fontWeight: 'bold' }}>+${myShare.toFixed(2)}</div>
                                                                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                                                                        Base: ${sharedShare.toFixed(2)} | Extras: ${myExtrasCommission.toFixed(2)} | Tip: ${tipShare.toFixed(2)}
                                                                                    </div>
                                                                                </div>
                                                                            </li>
                                                                        );
                                                                    })}
                                                            </ul>

                                                            {totalLunches > 0 && (
                                                                <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: '0.5rem' }}>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--danger)', fontWeight: 'bold' }}>
                                                                        <span>Descuento Almuerzos</span>
                                                                        <span>-${totalLunches.toFixed(2)}</span>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '2px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem', fontWeight: 'bold' }}>
                                                                <span>Total Neto</span>
                                                                <span style={{ color: 'var(--warning)' }}>${netCommissions.toFixed(2)}</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                    </div>
                                </div>
                            </div >
                        )
    );
};

export default CustomerDetailView;
