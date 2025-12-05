import React, { useState } from 'react';
import { X, Save, Plus, Trash2, Loader2 } from 'lucide-react';
import { generateReceiptPDF } from '../utils/pdfGenerator';
import { supabase } from '../supabase'; // Import Supabase Client (Correct Path)

const EditTransactionModal = ({ isOpen, onClose, transaction, services, employees, onUpdate }) => {
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

    const handleAddExtra = () => {
        if (newExtra.description && newExtra.price) {
            const price = parseFloat(newExtra.price);
            const updatedExtras = [...extras, { ...newExtra, price }];
            setExtras(updatedExtras);

            // Auto-update total price
            const currentTotal = parseFloat(formData.price) || 0;
            setFormData({ ...formData, price: currentTotal + price });

            setNewExtra({ description: '', price: '' });
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

    const handleSubmit = async () => {
        setIsUploading(true); // Start loading

        // 1. DETERMINE NEW STATUS FIRST
        let newStatus = formData.status;
        if (formData.status === 'pending') newStatus = 'paid';
        if (formData.status === 'ready') newStatus = 'completed';
        // if (formData.status === 'in_progress') newStatus = 'completed'; // REMOVED: Don't auto-complete in-progress

        const isCompleting = newStatus === 'paid' || newStatus === 'completed';

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
                    assignedNames
                );

                if (pdfBlob.size === 0) throw new Error('PDF vacío (0 bytes).');

                const fileName = generatedFileName || `recibo_${transaction.id}_${Date.now()}.pdf`;

                // STABILITY DELAY
                await new Promise(resolve => setTimeout(resolve, 500));

                // SIMPLIFIED UPLOAD (Match Test Button exactly)
                const { data, error } = await supabase.storage
                    .from('receipts')
                    .upload(fileName, pdfBlob); // Removed options (upsert, contentType) to match Test Button

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

            // B. Recalculate Commission
            // Logic: If $35 service & >1 employee => $12 total commission. Else standard.
            const service = services.find(s => s.id === formData.serviceId);
            const baseCommission = service?.commission || 0;
            const currentPrice = parseFloat(formData.price);

            let finalCommission = baseCommission;
            // Check for the specific $35 condition (adjust if price logic changes)
            if (currentPrice === 35 && selectedEmployeeIds.length > 1) {
                finalCommission = 12;
            }

            // 4. UPDATE TRANSACTION
            await onUpdate(transaction.id, {
                service_id: formData.serviceId,
                price: parseFloat(formData.price),
                payment_method: formData.paymentMethod,
                tip: parseFloat(formData.tip) || 0,
                commission_amount: finalCommission, // Updated commission
                status: newStatus,
                extras: extras, // Save the extras array
                employee_id: selectedEmployeeIds[0] || null // Update primary employee (legacy)
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
                                {extras.map((extra, index) => (
                                    <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                                        <span>{extra.description} (${extra.price})</span>
                                        <button type="button" onClick={() => handleRemoveExtra(index)} style={{ color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer' }}>
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Inputs para Nuevo Extra */}
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <input
                                type="text"
                                placeholder="Descripción (ej. Cera)"
                                className="input"
                                style={{ flex: 2 }}
                                value={newExtra.description}
                                onChange={(e) => setNewExtra({ ...newExtra, description: e.target.value })}
                            />
                            <input
                                type="number"
                                placeholder="$"
                                className="input"
                                style={{ flex: 1 }}
                                value={newExtra.price}
                                onChange={(e) => setNewExtra({ ...newExtra, price: e.target.value })}
                            />
                            <button
                                type="button"
                                onClick={handleAddExtra}
                                className="btn"
                                style={{ backgroundColor: '#10B981', padding: '0.5rem' }}
                            >
                                <Plus size={20} />
                            </button>
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
                                style={{ backgroundColor: 'var(--bg-secondary)', opacity: 0.7 }}
                                value={formData.commissionAmount}
                                readOnly
                                title="La comisión se recalcula al guardar"
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
                        <label className="label">Método de Pago</label>
                        <select
                            className="input"
                            value={formData.paymentMethod}
                            onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                        >
                            <option value="cash">Efectivo</option>
                            <option value="card">Tarjeta</option>
                            <option value="transfer">AthMóvil</option>
                        </select>
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

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                        <button type="button" onClick={onClose} className="btn" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                            Cancelar
                        </button>
                        <button type="button" onClick={handleSubmit} className="btn btn-primary" disabled={isUploading}>
                            {isUploading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} style={{ marginRight: '0.5rem' }} />}
                            {isUploading ? ' Procesando...' : 'Guardar'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EditTransactionModal;
