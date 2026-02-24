import React, { useState } from 'react';
import { X, Save, Plus, Trash2, Loader2, Droplets } from 'lucide-react';
import { generateReceiptPDF } from '../utils/pdfGenerator';
import { supabase } from '../supabase'; // Import Supabase Client (Correct Path)
import { calculateSharedCommission } from '../utils/commissionRules';

const EditTransactionModal = ({ isOpen, onClose, transaction, services, employees, vehicles = [], onUpdate, userRole, reviewLink }) => {
    if (!isOpen || !transaction) return null;

    const [extras, setExtras] = useState(transaction.extras || []);
    const [newExtra, setNewExtra] = useState({ description: '', price: '' });

    const [formData, setFormData] = useState({
        serviceId: transaction.service_id || '',
        price: transaction.price || '',
        paymentMethod: transaction.payment_method || 'cash',
        tip: transaction.tip || 0,
        commissionAmount: transaction.commission_amount || 0,
        status: transaction.status || 'pending',
        vehicleId: transaction.vehicle_id || ''
    });

    // NEW: State for Quick Vehicle Creation
    const [newVehicle, setNewVehicle] = useState({ brand: '', model: '', plate: '' });

    const [sendReceipt, setSendReceipt] = useState(true); // WhatsApp Checkbox State (Default TRUE)
    const [isUploading, setIsUploading] = useState(false); // Upload Loading State
    const [successUrl, setSuccessUrl] = useState(null); // Success View State

    const [showAssignmentModal, setShowAssignmentModal] = useState(false);
    const [pendingExtra, setPendingExtra] = useState(null);

    // NEW MEMBERSHIP STATES
    const [memberships, setMemberships] = useState([]);
    const [customerMembership, setCustomerMembership] = useState(null);
    const [isMembershipUsage, setIsMembershipUsage] = useState(false);

    // Load memberships and current customer membership
    React.useEffect(() => {
        const fetchMemberships = async () => {
            const { data, error } = await supabase.from('memberships').select('*');
            if (data) setMemberships(data);
            if (error) console.error("Error fetching memberships", error);
        };
        fetchMemberships();
    }, []);

    React.useEffect(() => {
        // Find the customer ID, it might be heavily nested or missing if the object is weird
        const cId = transaction?.customer_id || (transaction?.customers && transaction.customers.id);
        if (!cId) return;

        const fetchCustomerMembership = async () => {
            // First, trigger automatic renewal if needed
            await supabase.rpc('check_and_renew_membership', { p_customer_id: cId });

            const { data, error } = await supabase
                .from('customer_memberships')
                .select('*, memberships(*)')
                .eq('customer_id', cId)
                .eq('status', 'active')
                .single();

            console.log("DEBUG: Fetched customer membership for cId", cId, data, error);

            if (data) {
                setCustomerMembership(data);
                // Si la membresía es válida, por default preparamos para usarla (a menos que no quieran)
                if (data.memberships?.type === 'unlimited' || data.usage_count < data.memberships?.limit_count) {
                    setIsMembershipUsage(true);
                }
            }
            if (error && error.code !== 'PGRST116') console.error("Error fetching customer membership", error); // Ignore no rows error
        };
        fetchCustomerMembership();
    }, [transaction]);

    // SYNC PRICE: Recalculate anytime membership usage, service, or extras change
    React.useEffect(() => {
        if (!formData.serviceId) return;
        const service = services.find(s => s.id === formData.serviceId);
        if (!service) return;

        const basePrice = isMembershipUsage ? 0 : (parseFloat(service.price) || 0);
        const extrasTotal = (extras || []).reduce((sum, ex) => sum + (parseFloat(ex.price) || 0), 0);

        setFormData(prev => ({
            ...prev,
            price: basePrice + extrasTotal
        }));
    }, [isMembershipUsage, formData.serviceId, extras, services]);

    const handleAssignMembership = async (membershipId) => {
        const cId = transaction?.customer_id || (transaction?.customers && transaction.customers.id);
        if (!cId || !membershipId) return;

        try {
            // Check if exists first to avoid onConflict unique constraint issues
            const { data: existing } = await supabase
                .from('customer_memberships')
                .select('id')
                .eq('customer_id', cId)
                .maybeSingle();

            let opError;
            if (existing) {
                const { error } = await supabase
                    .from('customer_memberships')
                    .update({
                        membership_id: membershipId,
                        status: 'active',
                        usage_count: 0,
                        last_reset_at: new Date().toISOString()
                    })
                    .eq('id', existing.id);
                opError = error;
            } else {
                const { error } = await supabase
                    .from('customer_memberships')
                    .insert({ customer_id: cId, membership_id: membershipId, status: 'active' });
                opError = error;
            }

            if (opError) throw opError;

            const { data: updatedMembership } = await supabase
                .from('customer_memberships')
                .select('*, memberships(*)')
                .eq('customer_id', cId)
                .single();

            setCustomerMembership(updatedMembership);
            setIsMembershipUsage(true);

            // FINANCIAL RECORD: Create a transaction for the membership sale
            const membership = memberships.find(m => m.id === membershipId);
            if (membership) {
                await supabase.from('transactions').insert([{
                    customer_id: cId,
                    price: membership.price,
                    total_price: membership.price, // Required by DB constraint
                    payment_method: 'cash', // Default to cash, user can edit in reports
                    status: 'paid',
                    date: new Date().toISOString(),
                    service_id: null,
                    extras: [{ description: `VENTA MEMBRESÍA: ${membership.name}`, price: membership.price }]
                }]);
            }

            alert("Membresía asignada correctamente y registrada en finanzas.");

        } catch (error) {
            console.error("Error asignando membresía:", error);
            alert("Error al asignar membresía: " + error.message);
        }
    };

    const handleRemoveMembership = async () => {
        const cId = transaction?.customer_id || (transaction?.customers && transaction.customers.id);
        if (!cId) return;
        if (!window.confirm("¿Seguro que deseas eliminar/cancelar la membresía de este cliente?")) return;

        const { error } = await supabase.from('customer_memberships').delete().eq('customer_id', cId);
        if (error) {
            console.error("Error removing membership:", error);
            alert("Error al cancelar la membresía");
            return;
        }

        setCustomerMembership(null);
        setIsMembershipUsage(false);
        alert("Membresía cancelada.");
    };

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

    // Auto-calculate total price when membership/extras/service change
    React.useEffect(() => {
        if (!services || services.length === 0) return;

        const service = services.find(s => s.id === formData.serviceId);
        const servicePrice = service ? parseFloat(service.price) : 0;
        const extrasTotal = extras.reduce((sum, ex) => sum + ex.price, 0);

        // If membership is used, base service is $0. Only charge extras.
        const newPrice = isMembershipUsage ? extrasTotal : (servicePrice + extrasTotal);

        setFormData(prev => {
            if (parseFloat(prev.price) !== newPrice) {
                return { ...prev, price: newPrice };
            }
            return prev;
        });
    }, [isMembershipUsage, formData.serviceId, extras, services]);

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

        // 0. QUICK VEHICLE CREATION
        let finalVehicleId = formData.vehicleId;
        if (finalVehicleId === 'other') {
            if (!newVehicle.brand || !newVehicle.model || !newVehicle.plate) {
                alert('⚠️ Por favor completa los datos del nuevo vehículo (Marca, Modelo, Placa).');
                setIsUploading(false);
                return;
            }

            try {
                const { data: vData, error: vError } = await supabase
                    .from('vehicles')
                    .insert([{
                        customer_id: transaction.customer_id,
                        brand: newVehicle.brand,
                        model: newVehicle.model,
                        plate: newVehicle.plate
                    }])
                    .select()
                    .single();

                if (vError) throw vError;
                finalVehicleId = vData.id; // Use the new ID
                console.log("New vehicle created:", vData);

            } catch (err) {
                console.error("Error creating vehicle:", err);
                alert("Error al guardar el nuevo vehículo: " + err.message);
                setIsUploading(false);
                return;
            }
        }

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

            let finalPaymentMethod = methodToUse;
            let currentPrice = parseFloat(formData.price);

            // C. Proceso de Membresía
            // Solo si isMembershipUsage es Válido y estamos cobrando
            if (isCompleting && isMembershipUsage && customerMembership && transaction.payment_method !== 'membership') {
                finalPaymentMethod = 'membership';

                // Incrementar uso de membresía en Supabase
                const newUsageCount = (customerMembership.usage_count || 0) + 1;
                const { error: mError } = await supabase
                    .from('customer_memberships')
                    .update({
                        usage_count: newUsageCount,
                        last_used: new Date().toISOString() // Unified column name
                    })
                    .eq('id', customerMembership.id)
                    .eq('customer_id', transaction.customer_id);

                if (mError) {
                    console.error("Error al descontar membresía:", mError);
                    alert("No se pudo actualizar el contador de la membresía. Continúe con precaución.");
                }

                // Generalmente si usa membresía, el costo base se hace \$0, pero pagaría extras
                // Aquí usamos su valor actual ingresado en UI
            }

            // 4. UPDATE TRANSACTION
            await onUpdate(transaction.id, {
                service_id: formData.serviceId,
                price: currentPrice,
                payment_method: finalPaymentMethod, // Use adapted method
                tip: parseFloat(formData.tip) || 0,
                commission_amount: finalCommission,
                status: newStatus,
                extras: extras,
                employee_id: selectedEmployeeIds[0] || null,
                vehicle_id: finalVehicleId || null
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
            // If membership covers everything (price is 0), skip payment modal
            if (isMembershipUsage && parseFloat(formData.price || 0) === 0) {
                processTransaction('membership');
            } else {
                setShowPaymentConfModal(true);
            }
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

                    {/* CLIENTE Y VEHÍCULO */}
                    {transaction.customers && (
                        <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderRadius: '0.5rem', border: '1px solid #3B82F6' }}>
                            <div style={{ fontSize: '0.8rem', color: '#3B82F6', fontWeight: 'bold', marginBottom: '0.25rem' }}>CLIENTE ASIGNADO</div>
                            <div style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '0.5rem' }}>{transaction.customers.name}</div>

                            {/* VEHICLE SELECTOR (Admin/Manager) */}
                            {(userRole === 'admin' || userRole === 'manager') ? (
                                <div style={{ marginTop: '0.5rem' }}>
                                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Vehículo (Editar)</label>
                                    <select
                                        className="input"
                                        style={{ width: '100%', fontSize: '0.9rem', padding: '0.4rem' }}
                                        value={formData.vehicleId}
                                        onChange={(e) => setFormData({ ...formData, vehicleId: e.target.value })}
                                    >
                                        <option value="">-- Sin Vehículo --</option>
                                        {vehicles
                                            .filter(v => v.customer_id === transaction.customer_id)
                                            .map(v => (
                                                <option key={v.id} value={v.id}>
                                                    {v.brand} {v.model} ({v.plate})
                                                </option>
                                            ))
                                        }
                                        <option disabled>──────</option>
                                        <option value="other">Otro (Gestión manual requerida)</option>
                                    </select>
                                    {(!formData.vehicleId || formData.vehicleId === '') && (
                                        <div style={{ color: 'red', fontSize: '0.8rem', marginTop: '0.25rem' }}>⚠️ Advertencia: Guardar sin vehículo puede causar pérdida de datos.</div>
                                    )}

                                    {/* Quick Vehicle Inputs */}
                                    {formData.vehicleId === 'other' && (
                                        <div style={{ marginTop: '0.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', backgroundColor: 'rgba(255, 255, 255, 0.05)', padding: '0.5rem', borderRadius: '0.25rem' }}>
                                            <input
                                                placeholder="Marca (Toyota)"
                                                className="input"
                                                style={{ fontSize: '0.8rem', padding: '0.3rem' }}
                                                value={newVehicle.brand}
                                                onChange={(e) => setNewVehicle({ ...newVehicle, brand: e.target.value })}
                                            />
                                            <input
                                                placeholder="Modelo (Yaris)"
                                                className="input"
                                                style={{ fontSize: '0.8rem', padding: '0.3rem' }}
                                                value={newVehicle.model}
                                                onChange={(e) => setNewVehicle({ ...newVehicle, model: e.target.value })}
                                            />
                                            <input
                                                placeholder="Placa (ABC-123)"
                                                className="input"
                                                style={{ fontSize: '0.8rem', padding: '0.3rem' }}
                                                value={newVehicle.plate}
                                                onChange={(e) => setNewVehicle({ ...newVehicle, plate: e.target.value })}
                                            />
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                    {transaction.vehicles?.model || transaction.customers?.vehicle_model} {(transaction.vehicles?.plate || transaction.customers?.vehicle_plate) && `(${transaction.vehicles?.plate || transaction.customers?.vehicle_plate})`}
                                </div>
                            )}
                        </div>
                    )}

                    {/* MEMBERSHIP ASSIGNMENT (Only for in_progress/waiting/pending) */}
                    {(transaction.status === 'in_progress' || transaction.status === 'waiting' || transaction.status === 'pending') && (
                        <div style={{ marginBottom: '1rem' }}>
                            {(transaction.customer_id || transaction.customers) && !customerMembership && (
                                <div style={{
                                    backgroundColor: 'var(--bg-secondary)',
                                    border: '1px dashed var(--border-color)',
                                    padding: '0.75rem', borderRadius: '0.5rem'
                                }}>
                                    <div style={{ fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                                        💎 Añadir Membresía
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <select id="edit-membership-select" className="input" style={{ flex: 1, padding: '0.5rem' }}>
                                            <option value="">Seleccionar plan...</option>
                                            {memberships.map(m => (
                                                <option key={m.id} value={m.id}>{m.name} - ${m.price}</option>
                                            ))}
                                        </select>
                                        <button
                                            type="button"
                                            className="btn btn-primary"
                                            onClick={() => {
                                                const sel = document.getElementById('edit-membership-select');
                                                if (sel && sel.value) handleAssignMembership(sel.value);
                                            }}
                                        >
                                            Asignar
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* MEMBERSHIP ACTIVE INDICATOR (Always show if they have one) */}
                    <div style={{ marginBottom: '1rem' }}>

                        {customerMembership && (
                            <div style={{
                                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                                border: '1px solid #22C55E',
                                padding: '0.75rem',
                                borderRadius: '0.5rem',
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
                                                : `Lavados Usados: ${customerMembership.usage_count || 0} / ${customerMembership.memberships?.limit_count || 0}`}
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(34, 197, 94, 0.2)', paddingTop: '0.5rem' }}>
                                    {(customerMembership.memberships?.type === 'unlimited' || (customerMembership.usage_count || 0) < (customerMembership.memberships?.limit_count || 0)) ? (
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={isMembershipUsage}
                                                onChange={(e) => {
                                                    setIsMembershipUsage(e.target.checked);
                                                    if (e.target.checked) {
                                                        alert("Recordatorio: Saldar con membresía cambia el método de pago a 'Membresía', pero los Extras u otros montos deben ajustarse manualmente si lo requieres.");
                                                    }
                                                }}
                                                style={{ width: '20px', height: '20px' }}
                                            />
                                            <span style={{ fontWeight: 'bold' }}>Saldar este servicio con Membresía</span>
                                        </label>
                                    ) : (
                                        <span style={{ fontSize: '0.8rem', color: '#EF4444' }}>⚠️ Límite de lavados alcanzado</span>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                        <label className="label">Servicio Base</label>
                        <select
                            className="input"
                            value={formData.serviceId}
                            onChange={(e) => {
                                const newServiceId = e.target.value;
                                const service = services.find(s => s.id === newServiceId);

                                if (service) {
                                    // Check for membership benefit
                                    let isBenefit = false;
                                    if (customerMembership && customerMembership.status === 'active') {
                                        const included = customerMembership.memberships.included_services || [];
                                        const isIncluded = (included.length === 0)
                                            ? true
                                            : (included.includes(service.name) || included.includes(service.id));

                                        if (isIncluded) {
                                            const lastUsed = customerMembership.last_used ? new Date(customerMembership.last_used) : null;
                                            const isUsedToday = lastUsed && new Date(lastUsed).toDateString() === new Date().toDateString();

                                            if (!isUsedToday) {
                                                isBenefit = true;
                                            }
                                        }
                                    }

                                    setIsMembershipUsage(isBenefit);
                                    setFormData({
                                        ...formData,
                                        serviceId: newServiceId,
                                        commissionAmount: parseFloat(service.commission) || 0
                                    });
                                } else {
                                    setIsMembershipUsage(false);
                                    setFormData({ ...formData, serviceId: '', price: 0, commissionAmount: 0 });
                                }
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
                                style={{
                                    backgroundColor: (userRole === 'admin' || userRole === 'manager' || (transaction.status !== 'paid' && transaction.status !== 'completed')) ? 'var(--bg-input)' : 'var(--bg-secondary)',
                                    opacity: (userRole === 'admin' || userRole === 'manager' || (transaction.status !== 'paid' && transaction.status !== 'completed')) ? 1 : 0.7
                                }}
                                value={formData.price}
                                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                readOnly={userRole !== 'admin' && userRole !== 'manager' && (transaction.status === 'paid' || transaction.status === 'completed')}
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
                                style={{
                                    backgroundColor: (userRole === 'admin' || userRole === 'manager' || (transaction.status !== 'paid' && transaction.status !== 'completed')) ? 'var(--bg-input)' : 'var(--bg-secondary)',
                                    opacity: (userRole === 'admin' || userRole === 'manager' || (transaction.status !== 'paid' && transaction.status !== 'completed')) ? 1 : 0.7
                                }}
                                value={formData.tip}
                                onChange={(e) => setFormData({ ...formData, tip: e.target.value })}
                                readOnly={userRole !== 'admin' && userRole !== 'manager' && (transaction.status === 'paid' || transaction.status === 'completed')}
                            />
                        </div>
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                        <label className="label" style={{ marginBottom: '0.5rem', display: 'block' }}>Método de Pago</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                            <button
                                type="button"
                                onClick={() => (userRole === 'admin' || userRole === 'manager' || (transaction.status !== 'paid' && transaction.status !== 'completed')) && setFormData({ ...formData, paymentMethod: 'cash' })}
                                style={{
                                    padding: '0.75rem',
                                    borderRadius: '0.5rem',
                                    border: formData.paymentMethod === 'cash' ? '2px solid #10B981' : '1px solid var(--border-color)',
                                    backgroundColor: formData.paymentMethod === 'cash' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                                    color: formData.paymentMethod === 'cash' ? '#10B981' : 'var(--text-muted)',
                                    fontWeight: 'bold',
                                    cursor: (userRole === 'admin' || userRole === 'manager' || (transaction.status !== 'paid' && transaction.status !== 'completed')) ? 'pointer' : 'not-allowed',
                                    transition: 'all 0.2s',
                                    opacity: (userRole === 'admin' || userRole === 'manager' || (transaction.status !== 'paid' && transaction.status !== 'completed')) ? 1 : 0.6
                                }}
                            >
                                💵 Efectivo
                            </button>
                            <button
                                type="button"
                                onClick={() => (userRole === 'admin' || userRole === 'manager' || (transaction.status !== 'paid' && transaction.status !== 'completed')) && setFormData({ ...formData, paymentMethod: 'card' })}
                                style={{
                                    padding: '0.75rem',
                                    borderRadius: '0.5rem',
                                    border: formData.paymentMethod === 'card' ? '2px solid #3B82F6' : '1px solid var(--border-color)',
                                    backgroundColor: formData.paymentMethod === 'card' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                                    color: formData.paymentMethod === 'card' ? '#3B82F6' : 'var(--text-muted)',
                                    fontWeight: 'bold',
                                    cursor: (userRole === 'admin' || userRole === 'manager' || (transaction.status !== 'paid' && transaction.status !== 'completed')) ? 'pointer' : 'not-allowed',
                                    transition: 'all 0.2s',
                                    opacity: (userRole === 'admin' || userRole === 'manager' || (transaction.status !== 'paid' && transaction.status !== 'completed')) ? 1 : 0.6
                                }}
                            >
                                💳 Tarjeta
                            </button>
                            <button
                                type="button"
                                onClick={() => (userRole === 'admin' || userRole === 'manager' || (transaction.status !== 'paid' && transaction.status !== 'completed')) && setFormData({ ...formData, paymentMethod: 'transfer' })}
                                style={{
                                    padding: '0.75rem',
                                    borderRadius: '0.5rem',
                                    border: formData.paymentMethod === 'transfer' ? '2px solid #F59E0B' : '1px solid var(--border-color)',
                                    backgroundColor: formData.paymentMethod === 'transfer' ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
                                    color: formData.paymentMethod === 'transfer' ? '#F59E0B' : 'var(--text-muted)',
                                    fontWeight: 'bold',
                                    cursor: (userRole === 'admin' || userRole === 'manager' || (transaction.status !== 'paid' && transaction.status !== 'completed')) ? 'pointer' : 'not-allowed',
                                    transition: 'all 0.2s',
                                    opacity: (userRole === 'admin' || userRole === 'manager' || (transaction.status !== 'paid' && transaction.status !== 'completed')) ? 1 : 0.6
                                }}
                            >
                                📱 Ath Móvil
                            </button>
                        </div>
                    </div>

                    {/* WHATSAPP CHECKBOX (Admin/Manager only) */}
                    {(userRole === 'admin' || userRole === 'manager') && transaction.customers?.phone && (
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
                            {(userRole === 'admin' || userRole === 'manager') && (
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
                                            const plate = (transaction.vehicles?.plate || transaction.customers?.vehicle_plate || 'car').replace(/\s+/g, '');
                                            doc.save(`recibo_${plate}.pdf`);
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
                            )}
                            <button type="button" onClick={handleSaveClick} className="btn btn-primary" disabled={isUploading}>
                                {isUploading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} style={{ marginRight: '0.5rem' }} />}
                                {isUploading ? ' Procesando...' : (isMembershipUsage ? 'Registrar Servicio' : 'Guardar')}
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
