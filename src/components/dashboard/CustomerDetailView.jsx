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
        selectedTransaction, setSelectedTransaction,
        getEmployeeName,
        handleSendDebtReminder
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
                        {activeDetailModal === 'cancelled' && '🚫 Servicios Cancelados'}
                        {activeDetailModal === 'unpaid_list' && '🔴 Deudas Pendientes'}
                    </h2>
                    <button
                        onClick={() => setActiveDetailModal(null)}
                        style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                        <X size={24} />
                    </button>
                </div>

                <div style={{ padding: '0.5rem', maxHeight: '70vh', overflowY: 'auto' }}>
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

                                            const start = t.started_at ? new Date(t.started_at) : new Date(t.created_at);
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
                                                                {(vehicle?.plate || t.vehicles?.plate || t.customers?.vehicle_plate) &&
                                                                    <span style={{ color: 'var(--text-primary)', marginLeft: '0.5rem', fontWeight: 'bold' }}>
                                                                        ({vehicle?.plate || t.vehicles?.plate || t.customers?.vehicle_plate})
                                                                    </span>}
                                                            </div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                                                                <div style={{ color: 'var(--warning)', fontWeight: 'bold' }}>
                                                                    {getServiceName(t.service_id)} - ${parseFloat(t.price || 0).toFixed(2)}
                                                                </div>
                                                                <div style={{ fontSize: '0.8rem', backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B', padding: '2px 6px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                    <Clock size={12} /> {timeString}
                                                                </div>
                                                            </div>
                                                            <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.2rem' }}>
                                                                Espera: {Math.round((new Date(t.started_at || t.created_at) - new Date(t.created_at)) / 60000)}m
                                                            </div>
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
                                                                style={{ backgroundColor: '#3B82F6', color: 'white', padding: '0.5rem 1rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                                            >
                                                                <Send size={18} /> <span style={{ fontWeight: '600' }}>Listo</span>
                                                            </button>
                                                            <button onClick={() => setEditingTransactionId(t.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline' }}>
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

                    {activeDetailModal === 'ready_list' && (
                        <div>
                            {statsTransactions.filter(t => t.status === 'ready').length === 0 ? <p>No hay autos listos.</p> : (
                                <ul style={{ listStyle: 'none', padding: 0 }}>
                                    {statsTransactions.filter(t => t.status === 'ready').map(t => (
                                        <li key={t.id} style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', borderRadius: '8px', marginBottom: '0.5rem', backgroundColor: 'rgba(16, 185, 129, 0.05)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <div>
                                                    <div style={{ fontWeight: 'bold' }}>{t.vehicles?.plate || t.customers?.vehicle_plate}</div>
                                                    <div style={{ color: 'var(--text-muted)' }}>{t.customers?.name}</div>
                                                    <div style={{ color: 'var(--success)', fontWeight: 'bold' }}>{getServiceName(t.service_id)}</div>
                                                </div>
                                                <button className="btn" onClick={() => handlePayment(t)} style={{ backgroundColor: 'var(--success)', padding: '0.5rem 1rem' }}>
                                                    Pagar
                                                </button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}

                    {activeDetailModal === 'unpaid_list' && (
                        <div>
                            {statsTransactions.filter(t => t.status === 'unpaid').length === 0 ? <p>No hay deudas.</p> : (
                                <ul style={{ listStyle: 'none', padding: 0 }}>
                                    {statsTransactions.filter(t => t.status === 'unpaid').map(t => (
                                        <li key={t.id} style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', borderRadius: '8px', marginBottom: '0.5rem', backgroundColor: 'rgba(239, 68, 68, 0.05)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <div>
                                                    <div style={{ fontWeight: 'bold' }}>{t.customers?.name}</div>
                                                    <div style={{ color: '#ef4444', fontWeight: 'bold' }}>Deuda: ${calculateTxTotal(t).toFixed(2)}</div>
                                                </div>
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <button className="btn" onClick={() => handlePayment(t)} style={{ backgroundColor: 'var(--success)', padding: '0.4rem 0.8rem' }}>Cobrar</button>
                                                    <button className="btn" onClick={() => handleSendDebtReminder(t)} style={{ backgroundColor: '#25D366', padding: '0.4rem 0.8rem' }}><Phone size={14} /></button>
                                                </div>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}

                    {activeDetailModal === 'income' && (
                        <div style={{ padding: '1rem', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '0.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}><span>Efectivo:</span><b>${statsTransactions.filter(t => (t.status === 'completed' || t.status === 'paid' || t.status === 'ready') && getTransactionCategory(t) === 'cash').reduce((sum, t) => sum + calculateTxTotal(t), 0).toFixed(2)}</b></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}><span>Tarjeta:</span><b>${statsTransactions.filter(t => (t.status === 'completed' || t.status === 'paid' || t.status === 'ready') && getTransactionCategory(t) === 'card').reduce((sum, t) => sum + calculateTxTotal(t), 0).toFixed(2)}</b></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Transferencia:</span><b>${statsTransactions.filter(t => (t.status === 'completed' || t.status === 'paid' || t.status === 'ready') && getTransactionCategory(t) === 'transfer').reduce((sum, t) => sum + calculateTxTotal(t), 0).toFixed(2)}</b></div>
                            <hr style={{ margin: '1rem 0' }} />
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', color: 'var(--success)' }}><span>Total:</span><b>${totalIncome.toFixed(2)}</b></div>
                        </div>
                    )}

                    {activeDetailModal === 'commissions' && (
                        <div>
                            {userRole === 'admin' ? (
                                <ul style={{ listStyle: 'none', padding: 0 }}>
                                    {employees.map(emp => {
                                        const empCommission = statsTransactions.reduce((sum, t) => {
                                            if (t.status !== 'completed') return sum;
                                            const isAssigned = t.transaction_assignments?.some(a => a.employee_id === emp.id);
                                            const isPrimary = t.employee_id === emp.id;
                                            if (isAssigned || isPrimary) {
                                                const txTotalCommission = (parseFloat(t.commission_amount) || 0);
                                                const tip = (parseFloat(t.tip) || 0);
                                                const uniqueAssignees = new Set((t.transaction_assignments || []).map(a => a.employee_id));
                                                const count = uniqueAssignees.size > 0 ? uniqueAssignees.size : 1;
                                                const myExtras = t.extras?.filter(e => e.assignedTo === emp.id) || [];
                                                const myExtrasCommission = myExtras.reduce((s, e) => s + (parseFloat(e.commission) || 0), 0);
                                                const allAssignedCommission = (t.extras?.filter(e => e.assignedTo) || []).reduce((s, e) => s + (parseFloat(e.commission) || 0), 0);
                                                const sharedPool = Math.max(0, txTotalCommission - allAssignedCommission);
                                                return sum + (sharedPool / count) + (tip / count) + myExtrasCommission;
                                            }
                                            return sum;
                                        }, 0);
                                        const empLunches = filteredExpenses.filter(e => e.employee_id === emp.id).reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
                                        if (empCommission === 0 && empLunches === 0) return null;
                                        return (
                                            <li key={emp.id} style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                                                    <span>{emp.name}</span>
                                                    <span style={{ color: (empCommission-empLunches) >= 0 ? 'var(--success)' : 'var(--danger)' }}>${(empCommission-empLunches).toFixed(2)}</span>
                                                </div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Com: ${empCommission.toFixed(2)} | Alm: -${empLunches.toFixed(2)}</div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            ) : (
                                <div>
                                    <h4 style={{ color: 'var(--text-muted)' }}>Mis Trabajos ({formatToFraction(fractionalCount)})</h4>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--warning)', marginTop: '1rem' }}>Neto: ${netCommissions.toFixed(2)}</div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CustomerDetailView;
