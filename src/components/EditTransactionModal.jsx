import React, { useState } from 'react';
import { X, Save, Plus, Trash2, Loader2, Droplets } from 'lucide-react';
import { generateReceiptPDF } from '../utils/pdfGenerator';
import { supabase } from '../supabase'; // Import Supabase Client (Correct Path)
import { calculateSharedCommission } from '../utils/commissionRules';

const EditTransactionModal = ({ isOpen, onClose, transaction, services, employees, onUpdate, userRole, reviewLink }) => {
    if (!isOpen || !transaction) return null;

    const [extras, setExtras] = useState(transaction.extras || []);
    const [newExtra, setNewExtra] = useState({ description: '', price: '' });

    const [formData, setFormData] = useState({
        serviceId: transaction.service_id || '',
        price: transaction.price || '',
        paymentMethod: transaction.payment_method || 'cash',
        tip: transaction.tip || 0,
        commissionAmount: transaction.commission_amount || 0,
        status: transaction.status || 'pending'
    });

    const [sendReceipt, setSendReceipt] = useState(true); // WhatsApp Checkbox State (Default TRUE)
    const [isUploading, setIsUploading] = useState(false); // Upload Loading State
    const [successUrl, setSuccessUrl] = useState(null); // Success View State

    const [showAssignmentModal, setShowAssignmentModal] = useState(false);
    const [pendingExtra, setPendingExtra] = useState(null);

    const addExtraToState = (extra, empId) => {
        const item = { ...extra, assignedTo: empId };
        const updatedExtras = [...extras, item];
        setExtras(updatedExtras);

        // Auto-update total price
        const currentTotal = parseFloat(formData.price) || 0;
        setFormData({ ...formData, price: currentTotal + extra.price });

        setNewExtra({ description: '', price: '' });
        setPendingExtra(null);
        setShowAssignmentModal(false);
    };

    const handleAddExtra = () => {
        if (newExtra.description && newExtra.price) {
            const price = parseFloat(newExtra.price);
            const extraToAdd = { ...newExtra, price };

            if (selectedEmployeeIds.length > 1) {
                setPendingExtra(extraToAdd);
                setShowAssignmentModal(true);
            } else {
                addExtraToState(extraToAdd, null);
            }
        }
    };

    const handleRemoveExtra = (index) => {
        const extraToRemove = extras[index];
        const updatedExtras = extras.filter((_, i) => i !== index);
        setExtras(updatedExtras);

        // Auto-update total price
        const currentTotal = parseFloat(formData.price) || 0;
        setFormData({ ...formData, price: currentTotal - extraToRemove.price });
    };

    // Initialize selected employees
    const [selectedEmployeeIds, setSelectedEmployeeIds] = useState(() => {
        const assigned = transaction.transaction_assignments?.map(a => a.employee_id) || [];
        if (assigned.length === 0 && transaction.employee_id) {
            return [transaction.employee_id];
        }
        return assigned;
    });

    const handleToggleEmployee = (employeeId) => {
        setSelectedEmployeeIds(prev => {
            if (prev.includes(employeeId)) {
                return prev.filter(id => id !== employeeId);
            } else {
                return [...prev, employeeId];
            }
        });
    };

    // Auto-calculate commission when price/service/employees change
    React.useEffect(() => {
        if (!services || services.length === 0) return;

        const service = services.find(s => s.id === formData.serviceId);
        const baseCommission = service?.commission || 0;
        const currentPrice = parseFloat(formData.price) || 0;

        let finalCommission = calculateSharedCommission(currentPrice, selectedEmployeeIds.length, baseCommission);

        // Add Extras
        const extrasCommission = extras.reduce((sum, ex) => sum + (parseFloat(ex.commission) || 0), 0);
        finalCommission += extrasCommission;

        setFormData(prev => ({ ...prev, commissionAmount: finalCommission }));

    }, [formData.price, formData.serviceId, selectedEmployeeIds, extras, services]);

    const [showPaymentConfModal, setShowPaymentConfModal] = useState(false);

    const handlePaymentConfirm = (method) => {
        setFormData(prev => ({ ...prev, paymentMethod: method }));
        setShowPaymentConfModal(false);
        // Validar que el estado se actualice antes de procesar? 
        // Mejor pasamos el metodo directamente a processTransaction para asegurar
        processTransaction(method);
    };

    const processTransaction = async (confirmedMethod = null) => {
        const methodToUse = confirmedMethod || formData.paymentMethod;

        setIsUploading(true); // Start loading

        // 1. DETERMINE NEW STATUS FIRST
        let newStatus = formData.status;
        if (formData.status === 'pending') newStatus = 'paid';
        if (formData.status === 'ready') newStatus = 'completed';

        const isCompleting = newStatus === 'paid' || newStatus === 'completed';

        // PERMISSION CHECK: Only Admin or Manager can charge (complete/pay)
        if (isCompleting && userRole !== 'admin' && userRole !== 'manager') {
            alert("⛔️ ACCESO DENEGADO\n\nSolo los Gerentes o Administradores pueden procesar cobros.");
            setIsUploading(false);
            return;
        }

        // 2. CLOUD PDF RECEIPT LOGIC (Only if completing)
        let publicReceiptUrl = null;

        if (isCompleting && sendReceipt && transaction.customers?.phone) {
            try {
                const serviceName = services.find(s => s.id === formData.serviceId)?.name || 'Servicio';

                // Get Employee Names from current selection
                const assignedNames = employees
                    .filter(e => selectedEmployeeIds.includes(e.id))
                    .map(e => e.name)
                    .join(', ');

                // FIX: Destructure blob and fileName directly from generateReceiptPDF
                const { blob: pdfBlob, fileName: generatedFileName } = await generateReceiptPDF(
                    transaction,
                    serviceName,
                    extras,
                    formData.price,
                    formData.tip || 0,
                    assignedNames,
                    reviewLink
                );

                if (pdfBlob.size === 0) throw new Error('PDF vacío (0 bytes).');

                const fileName = generatedFileName || `recibo_${transaction.id}_${Date.now()}.pdf`;

                // STABILITY DELAY
                await new Promise(resolve => setTimeout(resolve, 500));

                // SIMPLIFIED UPLOAD (Match Test Button exactly)
                const { data, error } = await supabase.storage
                    .from('receipts')
                    .upload(fileName, pdfBlob);

                if (error) {
                    console.error('Supabase Upload Error:', error);
                    throw new Error('Supabase Upload: ' + error.message);
                }

                const { data: { publicUrl } } = supabase.storage
                    .from('receipts')
                    .getPublicUrl(fileName);

                publicReceiptUrl = publicUrl;

            } catch (error) {
                console.error('Error uploading receipt:', error);
                alert('ERROR AL SUBIR RECIBO: ' + (error.message || JSON.stringify(error)));
                // We continue to save the transaction even if receipt fails
            }
        }

        // 3. UPDATE ASSIGNMENTS & CALCULATE COMMISSION
        try {
            // A. Update Assignments
            // First delete existing assignments
            const { error: deleteError } = await supabase
                .from('transaction_assignments')
                .delete()
                .eq('transaction_id', transaction.id);

            if (deleteError) throw deleteError;

            // Then insert new assignments
            if (selectedEmployeeIds.length > 0) {
                const newAssignments = selectedEmployeeIds.map(empId => ({
                    transaction_id: transaction.id,
                    employee_id: empId
                }));

                const { error: insertError } = await supabase
                    .from('transaction_assignments')
                    .insert(newAssignments);

                if (insertError) throw insertError;
            }

            // B. Recalculate Commission -  NOW WE TRUST FORMDATA (Auto-calculated or Admin Edited)
            const finalCommission = parseFloat(formData.commissionAmount) || 0;

            // 4. UPDATE TRANSACTION
            await onUpdate(transaction.id, {
                service_id: formData.serviceId,
                price: parseFloat(formData.price),
                payment_method: methodToUse, // Use the confirmed method
                tip: parseFloat(formData.tip) || 0,
                commission_amount: finalCommission,
                status: newStatus,
                extras: extras,
                employee_id: selectedEmployeeIds[0] || null
            });

        } catch (error) {
            console.error("Error updating transaction/assignments:", error);
            alert("Error al actualizar: " + error.message);
            setIsUploading(false);
            return;
        }

        setIsUploading(false); // Stop loading

        // 5. SHOW SUCCESS STATE OR CLOSE
        if (isCompleting && publicReceiptUrl && transaction.customers?.phone) {
            const phone = transaction.customers.phone.replace(/\D/g, '');
            const message = `🧾 *RECIBO DE PAGO - EXPRESS CARWASH*\n\nGracias por su visita. Puede descargar su recibo aquí:\n${publicReceiptUrl}`;
            const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

            setSuccessUrl(url); // Trigger Success View
        } else {
            onClose(); // Close if no receipt needed or just saved
        }
    };

    const handleSaveClick = () => {
        // Check if we are completing/paying
        let nextStatus = formData.status;
        if (formData.status === 'pending') nextStatus = 'paid';
        if (formData.status === 'ready') nextStatus = 'completed';

        const isCompleting = nextStatus === 'paid' || nextStatus === 'completed';

        if (isCompleting) {
            setShowPaymentConfModal(true);
        } else {
            processTransaction();
        }
    };

    // ... (rendering continues)


    // SUCCESS VIEW (Manual WhatsApp Trigger)
    if (successUrl) {
        return (
            <div style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.8)', // Darker background
                display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000
            }}>
                <div style={{
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    padding: '2rem',
                    borderRadius: '0.5rem',
                    width: '100%',
                    maxWidth: '400px',
                    textAlign: 'center',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
                }}>
                    <div style={{ marginBottom: '1.5rem', color: '#10B981' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>✅</div>
                        <h2 style={{ margin: 0 }}>¡Pago Exitoso!</h2>
                    </div>

                    <p style={{ marginBottom: '2rem', color: 'var(--text-muted)' }}>
                        El recibo se ha generado correctamente.
                    </p>

                    <a
                        href={successUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-primary"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            width: '100%',
                            padding: '1rem',
                            fontSize: '1.1rem',
                            backgroundColor: '#25D366', // WhatsApp Green
                            color: 'white',
                            textDecoration: 'none',
                            marginBottom: '1rem'
                        }}
                        onClick={() => setTimeout(onClose, 1000)} // Close modal shortly after clicking
                    >
                        <span>📲 Enviar por WhatsApp</span>
                    </a>

                    <button
                        onClick={onClose}
                        className="btn"
                        style={{ width: '100%', backgroundColor: 'var(--bg-secondary)' }}
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000
        }}>
            <div style={{
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-primary)',
                padding: '2rem',
                borderRadius: '0.5rem',
                width: '100%',
                maxWidth: '500px',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h2 style={{ margin: 0 }}>Editar Venta</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}>
                        <X size={24} />
                    </button>
                </div>

                {/* REMOVED FORM TAG TO PREVENT SUBMIT ISSUES */}
                <div id="edit-transaction-form">

                    {/* CLIENTE ASIGNADO */}
                    {transaction.customers && (
                        <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderRadius: '0.5rem', border: '1px solid #3B82F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div style={{ fontSize: '0.8rem', color: '#3B82F6', fontWeight: 'bold' }}>CLIENTE ASIGNADO</div>
                                <div style={{ fontWeight: 'bold' }}>{transaction.customers.name}</div>
                                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                    {transaction.vehicles?.model || transaction.customers?.vehicle_model} {(transaction.vehicles?.plate || transaction.customers?.vehicle_plate) && `(${transaction.vehicles?.plate || transaction.customers?.vehicle_plate})`}
                                </div>
                            </div>
                        </div>
                    )}

                    <div style={{ marginBottom: '1rem' }}>
                        <label className="label">Servicio Base</label>
                        <select
                            className="input"
                            value={formData.serviceId}
                            onChange={(e) => {
                                const newServiceId = e.target.value;
                                const service = services.find(s => s.id === newServiceId);

                                // Calculate new price: Service Price + Current Extras
                                const servicePrice = service ? parseFloat(service.price) : 0;
                                const extrasTotal = extras.reduce((sum, ex) => sum + ex.price, 0);

                                setFormData({
                                    ...formData,
                                    serviceId: newServiceId,
                                    price: servicePrice + extrasTotal,
                                    commissionAmount: service ? service.commission : formData.commissionAmount
                                });
                            }}
                        >
                            <option value="">Seleccionar Servicio...</option>
                            {services.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* ... (rest of the form remains same until buttons) ... */}
                    {/* ... */}


                    {/* SECCIÓN DE LAVADORES (NUEVO) */}
                    <div style={{ marginBottom: '1rem' }}>
                        <label className="label">Lavadores Asignados</label>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                            gap: '0.5rem',
                            maxHeight: '150px',
                            overflowY: 'auto',
                            padding: '0.5rem',
                            border: '1px solid var(--border-color)',
                            borderRadius: '0.5rem'
                        }}>
                            {employees.map(emp => (
                                <div
                                    key={emp.id}
                                    onClick={() => handleToggleEmployee(emp.id)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        padding: '0.5rem',
                                        borderRadius: '0.25rem',
                                        cursor: 'pointer',
                                        backgroundColor: selectedEmployeeIds.includes(emp.id)
                                            ? 'rgba(99, 102, 241, 0.2)'
                                            : 'transparent',
                                        border: selectedEmployeeIds.includes(emp.id)
                                            ? '1px solid var(--primary)'
                                            : '1px solid transparent'
                                    }}
                                >
                                    <div style={{
                                        width: '16px',
                                        height: '16px',
                                        borderRadius: '4px',
                                        border: '1px solid var(--text-muted)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        backgroundColor: selectedEmployeeIds.includes(emp.id) ? 'var(--primary)' : 'transparent'
                                    }}>
                                        {selectedEmployeeIds.includes(emp.id) && <div style={{ width: '8px', height: '8px', backgroundColor: 'white', borderRadius: '2px' }} />}
                                    </div>
                                    <span style={{ fontSize: '0.9rem' }}>{emp.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* SECCIÓN DE EXTRAS */}
                    <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '0.5rem' }}>
                        <label className="label" style={{ marginBottom: '0.5rem', display: 'block' }}>Servicios Extra (Opcional)</label>

                        {/* Lista de Extras */}
                        {extras.length > 0 && (
                            <div style={{ marginBottom: '1rem' }}>
                                {extras.map((extra, index) => {
                                    const assignedEmp = employees.find(e => e.id === extra.assignedTo);
                                    return (
                                        <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                                            <span>
                                                {extra.description} (${extra.price})
                                                {assignedEmp && <span style={{ color: 'var(--primary)', fontWeight: 'bold', marginLeft: '0.5rem' }}>[{assignedEmp.name}]</span>}
                                            </span>
                                            <button type="button" onClick={() => handleRemoveExtra(index)} style={{ color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer' }}>
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Inputs para Nuevo Extra */}
                        {/* Selector de Servicio Extra */}
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <select
                                className="input"
                                style={{ flex: 1 }}
                                value=""
                                onChange={(e) => {
                                    const sId = e.target.value;
                                    if (!sId) return;
                                    const s = services.find(srv => srv.id == sId);
                                    if (s) {
                                        // TRIGGER ADD LOGIC IMMEDIATELY (Similar to Dashboard)
                                        // check if multiple employees
                                        const extraToAdd = { description: s.name, price: parseFloat(s.price), commission: s.commission || 0 };

                                        if (selectedEmployeeIds.length > 1) {
                                            setPendingExtra(extraToAdd);
                                            setShowAssignmentModal(true);
                                        } else {
                                            addExtraToState(extraToAdd, null);
                                        }
                                    }
                                }}
                            >
                                <option value="">Agregar Servicio Extra...</option>
                                {services.map(s => (
                                    <option key={s.id} value={s.id}>{s.name} - ${s.price}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                        <div>
                            <label className="label">Precio Total</label>
                            <input
                                type="number"
                                className="input"
                                value={formData.price}
                                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="label">Comisión (Fija)</label>
                            <input
                                type="number"
                                className="input"
                                style={{
                                    backgroundColor: userRole === 'admin' ? 'var(--bg-input)' : 'var(--bg-secondary)',
                                    opacity: userRole === 'admin' ? 1 : 0.7
                                }}
                                value={formData.commissionAmount}
                                onChange={(e) => setFormData({ ...formData, commissionAmount: parseFloat(e.target.value) || 0 })}
                                readOnly={userRole !== 'admin'}
                                title={userRole === 'admin' ? "Editar Comisión" : "Solo Admin puede editar"}
                            />
                        </div>
                        <div>
                            <label className="label">Propina</label>
                            <input
                                type="number"
                                className="input"
                                value={formData.tip}
                                onChange={(e) => setFormData({ ...formData, tip: e.target.value })}
                            />
                        </div>
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                        <label className="label" style={{ marginBottom: '0.5rem', display: 'block' }}>Método de Pago</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, paymentMethod: 'cash' })}
                                style={{
                                    padding: '0.75rem',
                                    borderRadius: '0.5rem',
                                    border: formData.paymentMethod === 'cash' ? '2px solid #10B981' : '1px solid var(--border-color)',
                                    backgroundColor: formData.paymentMethod === 'cash' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                                    color: formData.paymentMethod === 'cash' ? '#10B981' : 'var(--text-muted)',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                💵 Efectivo
                            </button>
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, paymentMethod: 'card' })}
                                style={{
                                    padding: '0.75rem',
                                    borderRadius: '0.5rem',
                                    border: formData.paymentMethod === 'card' ? '2px solid #3B82F6' : '1px solid var(--border-color)',
                                    backgroundColor: formData.paymentMethod === 'card' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                                    color: formData.paymentMethod === 'card' ? '#3B82F6' : 'var(--text-muted)',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                💳 Tarjeta
                            </button>
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, paymentMethod: 'transfer' })}
                                style={{
                                    padding: '0.75rem',
                                    borderRadius: '0.5rem',
                                    border: formData.paymentMethod === 'transfer' ? '2px solid #F59E0B' : '1px solid var(--border-color)',
                                    backgroundColor: formData.paymentMethod === 'transfer' ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
                                    color: formData.paymentMethod === 'transfer' ? '#F59E0B' : 'var(--text-muted)',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                📱 Ath Móvil
                            </button>
                        </div>
                    </div>

                    {/* WHATSAPP CHECKBOX */}
                    {transaction.customers?.phone && (
                        <div style={{ marginBottom: '1.5rem', padding: '0.75rem', backgroundColor: 'rgba(37, 211, 102, 0.1)', borderRadius: '0.5rem', border: '1px solid #25D366', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <input
                                type="checkbox"
                                id="sendReceipt"
                                checked={sendReceipt}
                                onChange={(e) => setSendReceipt(e.target.checked)}
                                style={{ width: '1.2rem', height: '1.2rem', cursor: 'pointer' }}
                            />
                            <label htmlFor="sendReceipt" style={{ cursor: 'pointer', color: 'var(--text-primary)', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span>☁️ Subir PDF y Enviar Link</span>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>({transaction.customers.phone})</span>
                            </label>
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2rem' }}>
                        <button
                            type="button"
                            onClick={async () => {
                                if (window.confirm('⚠️ ¿Estás seguro de ELIMINAR este servicio completo?\n\nEsta acción no se puede deshacer.')) {
                                    await onDelete(transaction.id);
                                    onClose();
                                }
                            }}
                            className="btn"
                            style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5' }}
                        >
                            <Trash2 size={18} style={{ marginRight: '0.5rem' }} /> Eliminar Servicio
                        </button>

                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button type="button" onClick={onClose} className="btn" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={async () => {
                                    try {
                                        const serviceName = services.find(s => s.id === formData.serviceId)?.name || 'Servicio';
                                        const assignedNames = employees
                                            .filter(e => selectedEmployeeIds.includes(e.id))
                                            .map(e => e.name)
                                            .join(', ');

                                        const { doc } = await generateReceiptPDF(
                                            transaction,
                                            serviceName,
                                            extras,
                                            formData.price,
                                            formData.tip || 0,
                                            assignedNames,
                                            reviewLink
                                        );
                                        doc.save(`recibo_${transaction.customers?.vehicle_plate || 'car'}.pdf`);
                                    } catch (error) {
                                        console.error("Error generating/downloading PDF:", error);
                                        alert("Error al generar PDF: " + error.message);
                                    }
                                }}
                                className="btn"
                                style={{ backgroundColor: 'var(--success)', color: 'white' }}
                            >
                                <Droplets size={18} style={{ marginRight: '0.5rem' }} /> Descargar PDF
                            </button>
                            <button type="button" onClick={handleSaveClick} className="btn btn-primary" disabled={isUploading}>
                                {isUploading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} style={{ marginRight: '0.5rem' }} />}
                                {isUploading ? ' Procesando...' : 'Guardar'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* PAYMENT CONFIRMATION MODAL (Overlay) */}
            {showPaymentConfModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.85)', // Very dark to focus attention
                    display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3500 // Higher than everything
                }}>
                    <div className="card" style={{ width: '90%', maxWidth: '500px', backgroundColor: 'var(--bg-card)', padding: '2rem', borderRadius: '1rem', textAlign: 'center' }}>
                        <h2 style={{ fontSize: '2rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>💰 Confirmar Pago</h2>
                        <p style={{ fontSize: '1.2rem', marginBottom: '2rem', color: 'var(--text-muted)' }}>
                            ¿Cómo pagó el cliente?
                        </p>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                            <button
                                onClick={() => handlePaymentConfirm('cash')}
                                className="btn"
                                style={{
                                    padding: '1.5rem',
                                    fontSize: '1.5rem',
                                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                                    color: '#10B981',
                                    border: '2px solid #10B981',
                                    justifyContent: 'center',
                                    fontWeight: 'bold'
                                }}
                            >
                                💵 EFECTIVO
                            </button>

                            <button
                                onClick={() => handlePaymentConfirm('card')}
                                className="btn"
                                style={{
                                    padding: '1.5rem',
                                    fontSize: '1.5rem',
                                    backgroundColor: 'rgba(59, 130, 246, 0.15)',
                                    color: '#3B82F6',
                                    border: '2px solid #3B82F6',
                                    justifyContent: 'center',
                                    fontWeight: 'bold'
                                }}
                            >
                                💳 TARJETA
                            </button>

                            <button
                                onClick={() => handlePaymentConfirm('transfer')}
                                className="btn"
                                style={{
                                    padding: '1.5rem',
                                    fontSize: '1.5rem',
                                    backgroundColor: 'rgba(245, 158, 11, 0.15)',
                                    color: '#F59E0B',
                                    border: '2px solid #F59E0B',
                                    justifyContent: 'center',
                                    fontWeight: 'bold'
                                }}
                            >
                                📱 ATH MÓVIL
                            </button>

                            <button
                                onClick={() => setShowPaymentConfModal(false)}
                                className="btn"
                                style={{
                                    padding: '1rem',
                                    marginTop: '1rem',
                                    backgroundColor: 'transparent',
                                    border: '1px solid var(--border-color)',
                                    justifyContent: 'center',
                                    color: 'var(--text-muted)'
                                }}
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ASSIGNMENT MODAL (Internal) */}
            {showAssignmentModal && pendingExtra && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3200
                }}>
                    <div className="card" style={{ width: '90%', maxWidth: '350px', backgroundColor: 'var(--bg-card)', padding: '1.5rem', borderRadius: '0.5rem' }}>
                        <h3 style={{ marginBottom: '1rem', marginTop: 0 }}>¿Quién realizó: {pendingExtra.description}?</h3>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                            Selecciona al empleado para asignarle la comisión.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {selectedEmployeeIds.map(empId => {
                                const emp = employees.find(e => e.id === empId);
                                return (
                                    <button
                                        key={empId}
                                        className="btn"
                                        style={{ justifyContent: 'center', padding: '0.75rem', border: '1px solid var(--border-color)' }}
                                        onClick={() => addExtraToState(pendingExtra, empId)}
                                    >
                                        {emp?.name || 'Empleado Desconocido'}
                                    </button>
                                );
                            })}
                            <button
                                className="btn"
                                style={{ justifyContent: 'center', marginTop: '1rem', backgroundColor: 'var(--bg-secondary)' }}
                                onClick={() => {
                                    setPendingExtra(null);
                                    setShowAssignmentModal(false);
                                }}
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EditTransactionModal;
