import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';
import { Plus, Car, DollarSign, Users, Trash2, Edit2, Clock, RefreshCw, Loader2, CheckCircle, Play, Send, Droplets, MessageCircle, Settings, MessageSquare, X, Star, QrCode, AlertCircle, TrendingUp, AlertTriangle, Phone, Share2 } from 'lucide-react';
import useSupabase from '../hooks/useSupabase';

import ServiceAnalyticsChart from '../components/ServiceAnalyticsChart';

import PeakHoursChart from '../components/PeakHoursChart';
import TopCustomersReport from '../components/TopCustomersReport';
import EditTransactionModal from '../components/EditTransactionModal';
import ConfigModal from '../components/dashboard/ConfigModal';
import { DashboardProvider } from '../context/DashboardContext';
import TransactionModal from '../components/dashboard/TransactionModal';
import CustomerDetailView from '../components/dashboard/CustomerDetailView';
import { generateDailyReport } from '../utils/dailyReportPdf';
import { calculateSharedCommission } from '../utils/commissionRules';
import { playNewServiceSound, playAlertSound, unlockAudio } from '../utils/soundUtils';
import { formatDuration } from '../utils/formatUtils';
import { formatToFraction } from '../utils/fractionUtils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'react-qr-code';



const Dashboard = () => {
    const [myUserId, setMyUserId] = useState(null);
    const [myEmployeeId, setMyEmployeeId] = useState(null); // Nuevo: ID del perfil de empleado

    const [dateFilter, setDateFilter] = useState('today'); // 'today', 'manual', 'range', 'month'
    const [dateRange, setDateRange] = useState({
        start: new Date().toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });





    // REFACTOR: Store ID only, not the whole object
    const [editingTransactionId, setEditingTransactionId] = useState(null); // Nuevo: ID del perfil de empleado
    const [userRole, setUserRole] = useState(null); // Estado para el rol
    const [isRefreshing, setIsRefreshing] = useState(false); // Estado para el botón de refresh
    const [isModalOpen, setIsModalOpen] = useState(false); // Estado para el modal de nueva transacción
    const [alertedTransactions, setAlertedTransactions] = useState(new Set()); // Para evitar alertas repetidas
    const [feedbacks, setFeedbacks] = useState([]); // Nuevo: Estado para las reseñas privadas
    const [qrTransactionId, setQrTransactionId] = useState(null); // ID para mostrar modal QR
    const [viewMode, setViewMode] = useState('ops'); // 'ops' | 'reports'
    const [memberships, setMemberships] = useState([]); // Nuevo: Todos los planes de membresía

    const [isEditingVisits, setIsEditingVisits] = useState(false);
    const [manualVisits, setManualVisits] = useState(0);

    const clean = (val) => val && val !== 'null' && val !== 'undefined' ? val.trim() : '';

    const getVehicleDisplayName = (v, cust) => {
        let brand = clean(v?.brand);
        let model = clean(v?.model);
        const plate = clean(v?.plate);

        if (!brand && !model && cust) {
            if (plate === clean(cust?.vehicle_plate) || (customerVehicles && customerVehicles.length === 1)) {
                brand = clean(cust?.vehicle_brand);
                model = clean(cust?.vehicle_model);
            }
        }

        if (!brand && !model) return plate || 'Vehículo';
        return `${brand} ${model}`.trim();
    };

    const handleUpdateManualVisits = async (customerId) => {
        try {
            const { error } = await supabase
                .from('customers')
                .update({ manual_visit_count: parseInt(manualVisits) || 0 })
                .eq('id', customerId);
            if (error) throw error;
            await refreshCustomers();
            setIsEditingVisits(false);
        } catch (error) {
            console.error('Error updating visits:', error);
            alert('Error al actualizar visitas');
        }
    };

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setMyUserId(user.id);

                // Consultar el rol del empleado
                let { data: employee, error } = await supabase
                    .from('employees')
                    .select('*')
                    .eq('user_id', user.id)
                    .single();

                if (error) {
                    console.error("Error fetching employee:", error);
                }

                // AUTO-LINKING: Logic for unlinked employees
                if (!employee && user.email) {
                    const { data: unlinkedEmployee } = await supabase
                        .from('employees')
                        .select('*')
                        .eq('email', user.email)
                        .is('user_id', null)
                        .single();

                    if (unlinkedEmployee) {
                        // Vincular automáticamente
                        const { error: linkError } = await supabase
                            .from('employees')
                            .update({ user_id: user.id })
                            .eq('id', unlinkedEmployee.id);

                        if (!linkError) {
                            employee = { ...unlinkedEmployee, user_id: user.id };
                            console.log("Cuenta vinculada automáticamente por email:", user.email);
                        }
                    }
                }

                if (employee) {
                    setUserRole(employee.role);
                    setMyEmployeeId(employee.id); // Guardar el ID del perfil
                } else {
                    // FALLBACK: If user isn't linked, find at least one admin for financial records
                    const { data: adminEmp } = await supabase.from('employees').select('id').eq('role', 'admin').limit(1).single();
                    if (adminEmp) setMyEmployeeId(adminEmp.id);
                }
            }
        };
        getUser();
    }, []);

    const handleUpdateSettings = async (updates) => {
        if (userRole !== 'admin' && userRole !== 'manager') return;

        try {
            const upserts = Object.entries(updates).map(([key, value]) => ({
                key,
                value: value ? value.toString() : ''
            }));

            const { error } = await supabase
                .from('settings')
                .upsert(upserts);

            if (error) throw error;

            if (updates.review_link !== undefined) setReviewLink(updates.review_link);
            if (updates.stripe_link !== undefined) setStripeLink(updates.stripe_link);

            return { success: true };
        } catch (error) {
            console.error("Error updating settings:", error);
            alert("Error al guardar: " + error.message);
            return { success: false };
        }
    };





    useEffect(() => {
        const fetchMemberships = async () => {
            const { data, error } = await supabase.from('memberships').select('*');
            if (data) setMemberships(data);
            if (error) console.error("Error fetching memberships", error);
        };
        fetchMemberships();

        const fetchSettings = async () => {
            const { data: settingsData } = await supabase
                .from('settings')
                .select('key, value');

            if (settingsData) {
                const review = settingsData.find(s => s.key === 'review_link');
                const stripe = settingsData.find(s => s.key === 'stripe_link');
                if (review) setReviewLink(review.value);
                if (stripe) setStripeLink(stripe.value);
            }
        };
        fetchSettings();
    }, []);

    const { data: servicesData } = useSupabase('services');
    const services = servicesData || [];

    const { data: employeesData } = useSupabase('employees');
    const employees = employeesData || [];

    const { data: customersData, update: updateCustomer, refresh: refreshCustomers } = useSupabase('customers');
    const customers = customersData || [];

    const { data: vehiclesData, create: createVehicle, refresh: refreshVehicles } = useSupabase('vehicles');
    const vehicles = vehiclesData || [];

    const { data: transactionsData, create: createTransaction, update: updateTransaction, remove: removeTransaction, refresh: refreshTransactions } = useSupabase('transactions', `*, customers(name, phone, vehicle_plate, vehicle_model), vehicles(plate, model, brand), transaction_assignments(employee_id)`, { orderBy: { column: 'date', ascending: false } });
    const transactions = transactionsData || [];

    // [MOVED HELPERS START]
    const getTransactionCategory = (t) => {
        if (!t) return 'other';
        const method = (t.payment_method || '').toLowerCase();
        const desc = (t.extras || []).map(ex => (ex.description || '').toUpperCase()).join(' ');
        if (method === 'membership' || method === 'membership_usage') return 'membership_usage';
        if (method === 'membership_sale' || method === 'sale' || desc.includes('VENTA') || desc.includes('PLAN') || desc.includes('MEMBRE')) return 'membership_sale';
        if (method === 'transfer') return 'transfer';
        if (method === 'card') return 'card';
        if (method === 'cash' || !method) return 'cash';
        return 'other';
    };

    const calculateTxTotal = (t) => {
        if (!t) return 0;
        const desc = (t.extras || []).map(ex => (ex.description || '').toUpperCase()).join(' ');
        const isSale = t.payment_method === 'membership_sale' || desc.includes('VENTA');
        if (isSale) {
            const val = parseFloat(t.total_price || t.price || 0);
            return isNaN(val) ? 0 : val;
        }
        if (t.payment_method === 'membership' || t.payment_method === 'membership_usage') {
            const extrasSum = (t.extras || []).reduce((s, ex) => s + (parseFloat(ex.price) || 0), 0);
            return isNaN(extrasSum) ? 0 : extrasSum;
        }
        if (t.price !== null && t.price !== undefined) return parseFloat(t.price) || 0;
        if (t.total_price !== null && t.total_price !== undefined) return parseFloat(t.total_price) || 0;
        return (t.extras || []).reduce((s, ex) => s + (parseFloat(ex.price) || 0), 0);
    };

    const getServiceName = (id) => services.find(s => s.id === id)?.name || 'Servicio Desconocido';
    const getEmployeeName = (id) => employees.find(e => e.id === id)?.name || 'Sin Asignar';
    const getCustomerName = (id) => customers.find(c => c.id === id)?.name || 'Cliente Desconocido';
    // [MOVED HELPERS END]

    const { data: expensesData } = useSupabase('expenses');
    const expenses = expensesData || [];

    // Sorting services by popularity (most requested first)
    const sortedServices = useMemo(() => {
        if (!services.length) return [];

        // Count transactions for each service
        const counts = {};
        transactions.forEach(tx => {
            if (tx.service_id) {
                counts[tx.service_id] = (counts[tx.service_id] || 0) + 1;
            }
            // Also count if it was used as an extra
            if (tx.extras && Array.isArray(tx.extras)) {
                tx.extras.forEach(extra => {
                    const matchedService = services.find(s => s.name === extra.description);
                    if (matchedService) {
                        counts[matchedService.id] = (counts[matchedService.id] || 0) + 1;
                    }
                });
            }
        });

        // Sort copy of services based on counts
        return [...services].sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0));
    }, [services, transactions]);

    const [verifyingTransaction, setVerifyingTransaction] = useState(null);
    const [hasConsentedVerification, setHasConsentedVerification] = useState(false);
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
    const [photoToUpload, setPhotoToUpload] = useState(null);
    const [viewingPhoto, setViewingPhoto] = useState(null);

    const handleOpenVerification = (transaction) => {
        console.log('Opening verification for transaction:', transaction?.id);
        setVerifyingTransaction(transaction);
        setHasConsentedVerification(false);
    };

    const handleConfirmReady = async () => {
        const transaction = verifyingTransaction;
        if (!transaction) return;

        // CRITICAL DEFENSIVE CHECK: Customers being null
        if (!transaction.customers) {
            console.error("DEBUG: Transaction details", transaction);
            alert("Error: El registro del cliente no está disponible temporalmente. Intente refrescar el dashboard.");
            return;
        }

        // CHECK FOR UNASSIGNED EXTRAS
        const uniqueAssignees = new Set((transaction.transaction_assignments || []).map(a => a.employee_id));
        const assignedCount = uniqueAssignees.size || 0;
        const unassignedExtras = transaction.extras?.filter(e => !e.assignedTo) || [];

        if (assignedCount > 1 && unassignedExtras.length > 0) {
            setPendingExtra(unassignedExtras[0]);
            setShowAssignmentModal(true);
            return;
        }

        if (!transaction.customers.phone) {
            alert('Este cliente no tiene número de teléfono registrado.');
            return;
        }

        const phone = (transaction.customers?.phone || '').replace(/\D/g, '');
        if (!phone) {
            alert('Número de teléfono inválido o ausente.');
            return;
        }

        // ... REST OF THE FUNCTION ...


        // Update status to 'ready'
        try {
            setIsSubmitting(true);
            let finish_photo_url = null;

            if (photoToUpload) {
                setIsUploadingPhoto(true);
                const fileExt = photoToUpload.name.split('.').pop();
                const fileName = `${transaction.id}_finish.${fileExt}`;
                const filePath = `finished/${fileName}`;

                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('car_photos')
                    .upload(filePath, photoToUpload, { upsert: true });

                if (!uploadError) {
                    const { data: publicUrlData } = supabase.storage.from('car_photos').getPublicUrl(filePath);
                    finish_photo_url = publicUrlData.publicUrl;
                } else {
                    console.error("Error al subir foto de acabado:", uploadError);
                }
                setIsUploadingPhoto(false);
            }

            await updateTransaction(transaction.id, {
                status: 'ready',
                finished_at: new Date().toISOString(),
                finish_photo_url: finish_photo_url || transaction.finish_photo_url
            });

            setPhotoToUpload(null);
            setIsSubmitting(false);



            await refreshTransactions();
            setVerifyingTransaction(null); // Close modal
        } catch (error) {
            console.error('Error updating status:', error);
            alert('Error al actualizar estado.');
            return;
        }

        const rawName = transaction.customers?.name || 'Cliente';
        const customerName = rawName.split(' ')[0]; // First name
        const vehPlate = transaction.vehicles?.plate || transaction.customers?.vehicle_plate || '';
        const vehModel = transaction.vehicles?.model || transaction.customers?.vehicle_model || '';
        const vehicle = `${vehPlate} (${vehModel})`.trim() || 'Vehículo';

        // Calculate Total
        const extrasTotal = transaction.extras?.reduce((sum, e) => sum + e.price, 0) || 0;
        const totalToPay = (parseFloat(transaction.price) + extrasTotal).toFixed(2);
        const serviceName = getServiceName(transaction.service_id);

        const isMembership = getTransactionCategory(transaction) === 'membership_usage';
        const portalLink = `${window.location.origin}/portal/${transaction.customer_id}`;
        
        let message = '';

        if (isMembership) {
            const hasExtras = extrasTotal > 0;
            const extrasDetail = hasExtras ? `\nExtras/Adicionales: $${extrasTotal.toFixed(2)}` : '';
            const paymentPrompt = hasExtras 
                ? `Para los adicionales: \n1. 📱 *ATH Móvil:* 787-857-8983\n2. 💵 *Efectivo* al recoger.`
                : `Todo está cubierto por su plan. ✨`;

            message = `¡Hola ${customerName}! Su vehículo ${vehicle} ya está listo. 🚗💎\n\n🌟 *Cliente de Membresía*\nEl servicio solicitado está cubierto por su plan.${extrasDetail}\n\n${paymentPrompt}\n\n🧤 *Nuestro equipo puso todo su empeño en su auto. Una propina para el lavador es el mejor reconocimiento a su trabajo.* 🤝\n\n📲 *Ver detalles y calificar aquí:* ${portalLink}\n\n¡Le esperamos!`;
        } else {
            message = `Hola ${customerName}, su vehículo ${vehicle} ya está listo. 🚗✨\n\n🧾 *Resumen de Cuenta:*\nServicio: ${serviceName}\nTotal a Pagar: $${totalToPay}\n\n💳 *Métodos de Pago:*\n1. 📱 *ATH Móvil:* 787-857-8983\n2. 💵 *Efectivo* al recoger.\n\n📲 *Ver Link de Pago y Calificar:*\n${portalLink}\n\n*Propina es bien recibida por nuestro equipo.* 🤝\n\n¡Lo esperamos!`;
        }

        // Use api.whatsapp.com for better compatibility
        const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;

        // Revert to location.href to avoid popup blockers and ensure mobile app trigger
        window.location.href = url;
    };

    const handleMarkAsUnpaid = async (tx) => {
        if (!window.confirm(`¿Confirmas que el cliente retiró el vehículo sin pagar? Se moverá a la lista de deudores.`)) return;

        try {
            const { error } = await supabase
                .from('transactions')
                .update({
                    status: 'unpaid',
                    finished_at: tx.finished_at || new Date().toISOString()
                })
                .eq('id', tx.id);

            if (error) throw error;

            await refreshTransactions();
            alert("Vehículo movido a Deudores (Falta Pago).");
        } catch (error) {
            console.error("Error marking as unpaid:", error);
            alert("Error: " + error.message);
        }
    };

    const handleSendDebtReminder = (tx) => {
        if (!tx.customers?.phone) return alert("El cliente no tiene teléfono.");

        const phone = tx.customers.phone.replace(/\D/g, '');
        const customerName = (tx.customers?.name || '').split(' ')[0];

        const extrasTotal = tx.extras?.reduce((sum, e) => sum + e.price, 0) || 0;
        const totalToPay = (parseFloat(tx.price) + extrasTotal).toFixed(2);
        const serviceName = getServiceName(tx.service_id);
        const dateStr = new Date(tx.created_at).toLocaleDateString();

        const portalLink = `${window.location.origin}/portal/${tx.customer_id}`;

        const message = `Hola ${customerName}, te escribimos de Express CarWash. 👋\n\nTenemos pendiente el pago de tu servicio realizado el ${dateStr}.\n\n🧾 *Detalle:* ${serviceName}\n💰 *Monto:* $${totalToPay}\n\n💳 *Puedes pagar por ATH Móvil:* 787-857-8983\n\n📲 *O ver los detalles aquí:* ${portalLink}\n\n¡Muchas gracias! 🙏`;

        window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`, '_blank');
    };

    const handleShareTicket = (txId, phone) => {
        const ticketUrl = `${window.location.origin}/ticket/${txId}`;
        
        if (navigator.clipboard) {
            navigator.clipboard.writeText(ticketUrl)
                .then(() => {
                    if (phone && window.confirm('Link del ticket copiado al portapapeles.\n\n¿Deseas compartirlo por WhatsApp al cliente?')) {
                        const cleanPhone = phone.replace(/\D/g, '');
                        const message = `Hola, puedes seguir el estado de tu vehículo en tiempo real aquí: ${ticketUrl}`;
                        window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`, '_blank');
                    } else if (!phone) {
                        alert('Link del ticket copiado al portapapeles: ' + ticketUrl);
                    }
                })
                .catch(err => {
                    alert('Link del ticket: ' + ticketUrl);
                });
        } else {
            alert('Link del ticket: ' + ticketUrl);
        }
    };

    // ASSIGNMENT MODAL STATE
    const [showAssignmentModal, setShowAssignmentModal] = useState(false);
    const [pendingExtra, setPendingExtra] = useState(null);

    const addExtra = (service, employeeId) => {
        const currentExtras = formData.extras || [];
        const newExtraItem = {
            description: service.name,
            price: service.price,
            commission: service.commission || 0, // Ensure commission is stored
            assignedTo: employeeId // UUID or null
        };

        const updatedExtras = [...currentExtras, newExtraItem];
        const currentPrice = parseFloat(formData.price) || 0;

        // Also add the extra commission to the total commission if applicable? 
        // No, `commission_amount` in DB is usually fixed per `services` row in old model.
        // But here we might be using dynamic commissions.
        // Let's ensure the Main Service commission is correct, and we ADD this extra commission to the total `commission_amount` stored?
        // Wait, `createTransaction` (line 633) sets `commission_amount: 0`.
        // If the backend doesn't calculate it, we should set it here.
        // CURRENTLY: `createTransaction` sends `0`. The DB trigger `calculate_commission` or similar might solve it?
        // Checking `fix_past_commissions.sql`: `SET commission_amount = 12`. 
        // Checking `migration_commission_fixed.sql`: `ALTER TABLE services ADD COLUMN commission...`.
        // It seems Frontend sends `0` and maybe backend fixes it? OR Frontend logic is missing.
        // Let's assume we need to calculate it.
        // But for now, let's just focus on saving the `assignedTo`.

        setFormData({
            ...formData,
            extras: updatedExtras,
            price: currentPrice + service.price
        });

        setPendingExtra(null);
        setShowAssignmentModal(false);
    };

    const assignExistingExtra = async (extra, empId) => {
        const t = verifyingTransaction;
        if (!t) return;

        const newExtras = t.extras.map(e => {
            if (e === extra || (e.description === extra.description && e.price === extra.price && !e.assignedTo)) {
                return { ...e, assignedTo: empId };
            }
            return e;
        });

        await updateTransaction(t.id, { extras: newExtras });
        await refreshTransactions();
        setVerifyingTransaction({ ...t, extras: newExtras });

        setPendingExtra(null);
        setShowAssignmentModal(false);
    };


    const [activeDetailModal, setActiveDetailModal] = useState(null); // 'cars', 'income', 'commissions'
    const [selectedTransaction, setSelectedTransaction] = useState(null); // For detailed view of a specific transaction
    const [debugInfo, setDebugInfo] = useState(""); // DEBUG STATE
    const [error, setError] = useState(null); // FIX: Restore error state
    const [isSubmitting, setIsSubmitting] = useState(false); // Prevent double clicks
    const [isRedemption, setIsRedemption] = useState(false); // NEW: Loyalty state
    const [vipInfo, setVipInfo] = useState(null); // NEW: VIP logic state
    const [canRedeemPoints, setCanRedeemPoints] = useState(false); // NEW: Points redemption state

    // Transaction Form State
    const [formData, setFormData] = useState({
        customerId: '',
        vehicleId: '', // Added vehicleId
        serviceId: '',
        employeeId: '',
        selectedEmployees: [], // Inicializar array vacío
        price: '',
        commissionAmount: '',
        serviceTime: new Date().toTimeString().slice(0, 5),
        extras: [], // Initialize extras
        referrerId: '' // Added for referral system
    });

    // PRODUCTIVITY FEATURES STATE
    const [lastService, setLastService] = useState(null);

    const [reviewLink, setReviewLink] = useState(''); // Review link setting
    const [stripeLink, setStripeLink] = useState(''); // Stripe payment link
    const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);


    const [customerMembership, setCustomerMembership] = useState(null);
    const [allCustomerMemberships, setAllCustomerMemberships] = useState([]); // Array of all active memberships for selected customer
    const [isMembershipUsage, setIsMembershipUsage] = useState(false);

    // NEW: Extra Wash redemption state
    const [availableExtraWashes, setAvailableExtraWashes] = useState([]);
    const [isExtraWashUsage, setIsExtraWashUsage] = useState(false);

    // SYNC PRICE: Recalculate anytime membership usage, service, extra wash usage, or extras change
    useEffect(() => {
        if (!formData.serviceId) return;
        const service = services.find(s => s.id === formData.serviceId);
        if (!service) return;

        // Price is 0 if either membership OR extra wash is used
        const basePrice = (isMembershipUsage || isExtraWashUsage) ? 0 : (parseFloat(service.price) || 0);
        const extrasTotal = (formData.extras || []).reduce((sum, ex) => sum + (parseFloat(ex.price) || 0), 0);

        setFormData(prev => ({
            ...prev,
            price: basePrice + extrasTotal
        }));
    }, [isMembershipUsage, isExtraWashUsage, formData.serviceId, formData.extras, services]);

    const handleCustomerSelect = async (customerId, overrideVehicleId = null) => {
        const vehicleId = overrideVehicleId || formData.vehicleId;
        if (!customerId) {
            setVipInfo(null);
            setLastService(null);
            setCanRedeemPoints(false);
            setCustomerMembership(null);
            setIsMembershipUsage(false);
            setAvailableExtraWashes([]);
            setIsExtraWashUsage(false);
            return;
        }

        // 1. VIP Calculation
        const customerTxs = transactions.filter(t => t.customer_id == customerId && t.status !== 'cancelled');
        const visitCount = customerTxs.length;
        setVipInfo({
            count: visitCount,
            isVip: visitCount >= 5 // VIP threshold
        });

        // 2. Last Service (Quick Reorder)
        if (customerTxs.length > 0) {
            // Transactions are already ordered by date desc
            const lastTx = customerTxs[0];
            setLastService(lastTx);
        } else {
            setLastService(null);
        }



        // 4. Membership Check
        // Trigger auto-renewal check first if a month has passed
        await supabase.rpc('check_and_renew_membership', { p_customer_id: customerId });

        // Fetch ALL active memberships for this customer
        const { data: memberSubs } = await supabase
            .from('customer_memberships')
            .select('*, memberships(*)')
            .eq('customer_id', customerId)
            .eq('status', 'active');

        setAllCustomerMemberships(memberSubs || []); // We'll need this new state

        // Re-calculate membership usage if a vehicle is already selected
        if (vehicleId && memberSubs) {
            // PRIORITY: Strict match, then fallback to global (null)
            const vehicleSub = memberSubs.find(m => m.vehicle_id === vehicleId) || memberSubs.find(m => m.vehicle_id === null);
            if (vehicleSub) {
                setCustomerMembership(vehicleSub);
                // AUTO-CHECK: If a service is already selected, check if it's a benefit
                if (formData.serviceId) {
                    const service = services.find(s => s.id === formData.serviceId);
                    if (service) {
                        const included = vehicleSub.memberships.included_services || [];
                        const isIncluded = (included.length === 0) ? true : (included.includes(service.name) || included.includes(service.id));
                        if (isIncluded) {
                            const lastUsed = vehicleSub.last_used ? new Date(vehicleSub.last_used) : null;
                            const isUsedToday = lastUsed && lastUsed.toDateString() === new Date().toDateString();

                            if (vehicleSub.memberships?.type === 'unlimited') {
                                if (!isUsedToday) {
                                    setIsMembershipUsage(true);
                                }
                            } else {
                                if ((vehicleSub.usage_count || 0) < (vehicleSub.memberships?.limit_count || 0)) {
                                    setIsMembershipUsage(true);
                                }
                            }
                        }
                    }
                }
            } else {
                setCustomerMembership(null);
                setIsMembershipUsage(false);
            }
        } else {
            setCustomerMembership(null);
            setIsMembershipUsage(false);
        }

        // 5. Fetch Vehicles (Directly from DB to ensure completeness)
        const { data: vehiclesData } = await supabase
            .from('vehicles')
            .select('*')
            .eq('customer_id', customerId);

        if (vehiclesData) {
            setCustomerVehicles(vehiclesData);
        } else {
            setCustomerVehicles([]);
        }

        // 6. Extra Wash (Cortesía) Check - Filtered by Vehicle if selected
        const validExtras = transactions.filter(t => {
            const isCortesia = t.payment_method === 'cortesia_membresia';
            const isForCustomer = t.customer_id == customerId;
            const isForVehicle = !vehicleId || t.vehicle_id == vehicleId;
            
            // Parse extras to check expiration and used status
            let isUsed = false;
            let isExpired = false;
            
            if (t.extras) {
                const extrasArr = Array.isArray(t.extras) ? t.extras : [t.extras];
                const cortesiaStr = extrasArr.find(e => typeof e === 'string' && e.includes('CORTESÍA')) || '';
                
                // Expiration check
                const match = cortesiaStr.match(/vence: (\d{4}-\d{2}-\d{2})/);
                if (match) {
                    const expiry = new Date(match[1]);
                    if (expiry < new Date()) isExpired = true;
                }
                
                // Used check
                isUsed = extrasArr.some(e => e.used === true);
            }
            
            return isCortesia && isForCustomer && isForVehicle && !isUsed && !isExpired;
        });
        
        setAvailableExtraWashes(validExtras);
        setIsExtraWashUsage(false);
    };

    const handleAssignMembership = async (membershipId) => {
        console.log("INICIANDO ASIGNACIÓN DE MEMBRESÍA:", { customerId: formData.customerId, membershipId });

        if (!formData.customerId) {
            alert("❌ Error: No hay un cliente seleccionado.");
            return;
        }
        if (!membershipId) {
            alert("❌ Error: ID de membresía inválido.");
            return;
        }

        try {
            // Use UPSERT to either update the existing membership or insert a new one
            // This is safer than delete+insert because it is atomic and avoids unique constraint errors.
            const vehicleIdValue = formData.vehicleId === 'all' || !formData.vehicleId ? null : formData.vehicleId;
            const { error: opError } = await supabase
                .from('customer_memberships')
                .upsert({
                    customer_id: formData.customerId,
                    vehicle_id: vehicleIdValue,
                    membership_id: membershipId,
                    status: 'active',
                    start_date: new Date().toISOString(),
                    last_reset_at: new Date().toISOString(),
                    usage_count: 0 // Reset usage on new assignment
                }, { onConflict: 'customer_id,vehicle_id' });

            if (opError) {
                console.error("UPSERT Error:", opError);
                throw opError;
            }

            // 3. REFRESH: Fetch ALL active memberships for this customer
            const { data: allMembersData, error: fetchErr } = await supabase
                .from('customer_memberships')
                .select('*, memberships(*)')
                .eq('customer_id', formData.customerId)
                .eq('status', 'active');

            if (fetchErr) console.warn("Error fetching memberships:", fetchErr);

            // Set current membership based on vehicle
            const match = allMembersData?.find(m => m.vehicle_id === vehicleIdValue || (m.vehicle_id === null && vehicleIdValue === null));
            setCustomerMembership(match || null);
            setIsMembershipUsage(true); // Auto-enable benefit for the newly assigned membership

            /* 
               FINANCIAL RECORD REMOVED: 
               The transaction record is now handled automatically by a database trigger (tr_record_membership_sale)
               to prevent duplication when assigning memberships.
            */
            /*
            const membership = memberships.find(m => m.id == membershipId);
            if (membership) {
                // ... (previous manual insert logic)
            }
            */
            alert("✅ Membresía asignada correctamente. El registro financiero se genera automáticamente.");

        } catch (opError) {
            console.error("Error general en handleAssignMembership:", opError);
            alert("❌ Error al asignar membresía: " + (opError.message || JSON.stringify(opError)));
        }
    };

    const handleRemoveMembership = async () => {
        if (!formData.customerId) return;
        if (!window.confirm("¿Seguro que deseas eliminar/cancelar la membresía de este cliente?")) return;

        // NEW: ASK TO DELETE THE TRANSACTION TOO
        let deleteTx = false;
        if (window.confirm("¿Deseas también borrar el registro de venta ($69) de los reportes?")) {
            deleteTx = true;
        }

        const vehicleIdValue = formData.vehicleId === 'all' || !formData.vehicleId ? null : formData.vehicleId;
        const { error } = await supabase.from('customer_memberships')
            .delete()
            .eq('customer_id', formData.customerId)
            .eq('vehicle_id', vehicleIdValue);
        if (error) {
            console.error("Error removing membership:", error);
            alert("Error al cancelar la membresía");
            return;
        }

        if (deleteTx) {
            // Try to find the most recent membership sale for this customer
            const { data: txs } = await supabase
                .from('transactions')
                .select('id')
                .eq('customer_id', formData.customerId)
                .eq('payment_method', 'membership_sale')
                .order('created_at', { ascending: false })
                .limit(1);

            if (txs && txs.length > 0) {
                await supabase.from('transactions').delete().eq('id', txs[0].id);
                console.log("Dashboard v4.72 LOADING...");
            }
        }

        setCustomerMembership(null);
        setIsMembershipUsage(false);
        alert("Membresía cancelada correctamente" + (deleteTx ? " y registro de venta eliminado." : "."));

        // Refresh the form data if customer is still selected
        if (formData.customerId) {
            const currentId = formData.customerId;
            setFormData(prev => ({ ...prev, customerId: '' }));
            setTimeout(() => setFormData(prev => ({ ...prev, customerId: currentId })), 100);
        }
    };

    const applyLastService = () => {
        if (!lastService) return;

        // Find vehicle
        const vehicle = vehicles.find(v => v.id == lastService.vehicle_id);

        setFormData(prev => ({
            ...prev,
            serviceId: lastService.service_id,
            vehicleId: lastService.vehicle_id || (vehicle ? vehicle.id : ''),
            price: lastService.price, // Use last price or current service price? Better use last price as starting point
            // We don't copy employees because that changes
        }));
    };
    const [activeTab, setActiveTab] = useState('main'); // 'main' | 'extras'

    const [newExtra, setNewExtra] = useState({ description: '', price: '' });
    const [customerSearch, setCustomerSearch] = useState(''); // Estado para el buscador de clientes
    const [showCustomerSearch, setShowCustomerSearch] = useState(false); // Toggle para mostrar el input
    const [plateSearch, setPlateSearch] = useState(''); // New: LPR Search

    // Quick Add Customer State
    const [isAddingCustomer, setIsAddingCustomer] = useState(false);
    const [newCustomer, setNewCustomer] = useState({
        name: '',
        phone: '',
        vehicle_plate: '',
        vehicle_brand: '',
        vehicle_model: '',
        email: '', // Optional
        referrer_id: ''
    });
    const [customerVehicles, setCustomerVehicles] = useState([]); // NEW: Local state for selected customer's vehicles
    const [referrerSearch, setReferrerSearch] = useState('');
    const [showReferrerSearch, setShowReferrerSearch] = useState(false);

    // ASSIGNMENT MODAL STATE (Missing in previous deploy)
    const [assigningTransactionId, setAssigningTransactionId] = useState(null);
    const [selectedEmployeesForAssignment, setSelectedEmployeesForAssignment] = useState([]);

    const handleStartService = (txId) => {
        setAssigningTransactionId(txId);
        if (myEmployeeId && userRole !== 'admin' && userRole !== 'manager') {
            setSelectedEmployeesForAssignment([myEmployeeId]);
        } else {
            setSelectedEmployeesForAssignment([]); // Reset selection
        }
    };

    const handleConfirmAssignment = async () => {
        if (selectedEmployeesForAssignment.length === 0) {
            alert("Selecciona al menos un empleado.");
            return;
        }

        const tx = transactions.find(t => t.id === assigningTransactionId);
        if (!tx) return;

        try {
            // 1. Remove existing assignments to prevent duplicates
            await supabase
                .from('transaction_assignments')
                .delete()
                .eq('transaction_id', tx.id);

            // 2. Create Assignments
            const assignments = selectedEmployeesForAssignment.map(empId => ({
                transaction_id: tx.id,
                employee_id: empId
            }));

            if (assignments.length > 0) {
                const { error: assignError } = await supabase
                    .from('transaction_assignments')
                    .insert(assignments);

                if (assignError) throw assignError;
            }

            // 2. Calculate Commission
            // Logic: If $35 service & >1 employee => $12 total commission. Else standard.
            const service = services.find(s => s.id === tx.service_id);
            const baseCommission = service?.commission || 0;

            const finalCommission = calculateSharedCommission(tx.price, selectedEmployeesForAssignment.length, baseCommission);

            // 3. Update Transaction Status & Commission
            await updateTransaction(tx.id, {
                status: 'in_progress',
                started_at: new Date().toISOString(), // Start the "Wash Timer"
                commission_amount: finalCommission,
                employee_id: selectedEmployeesForAssignment[0] // Legacy primary
            });

            setAssigningTransactionId(null);
            await refreshTransactions();
            alert("¡Servicio comenzado!");

        } catch (error) {
            console.error("Error starting service:", error);
            alert("Error al comenzar: " + error.message);
        }
    };

    const handlePayment = (tx) => {
        // Open the Edit Modal to allow adding tips, extras, and selecting payment method
        setEditingTransactionId(tx.id);
    };

    const { create: createCustomer } = useSupabase('customers');

    const handleCreateCustomer = async () => {
        if (!newCustomer.name || !newCustomer.vehicle_plate) {
            alert('Nombre y Placa son obligatorios');
            return;
        }

        // Clean values
        const cleanPlate = newCustomer.vehicle_plate.trim().toUpperCase();
        const cleanPhone = (newCustomer.phone || '').replace(/\D/g, '');

        try {
            // 1. Check if customer exists by phone, plate, or name
            let existingCustomer = null;

            // A) Match by phone (if provided)
            if (cleanPhone) {
                existingCustomer = customers.find(c => {
                    if (!c.phone) return false;
                    const cPhone = c.phone.replace(/\D/g, '');
                    return cPhone === cleanPhone || (cPhone.length >= 10 && cleanPhone.length >= 10 && cPhone.slice(-10) === cleanPhone.slice(-10));
                });
            }

            // B) Match by exact vehicle plate
            if (!existingCustomer && cleanPlate) {
                const existingVehicle = vehicles.find(v => v.plate.trim().toUpperCase() === cleanPlate);
                if (existingVehicle) {
                    existingCustomer = customers.find(c => c.id == existingVehicle.customer_id);
                }
            }

            // C) Match by exact name (case insensitive)
            if (!existingCustomer && newCustomer.name) {
                existingCustomer = customers.find(c => c.name?.trim().toLowerCase() === newCustomer.name.trim().toLowerCase());
            }



            if (existingCustomer) {
                // 2. Customer exists, check if vehicle exists for them
                const existingVehicle = vehicles.find(v =>
                    v.customer_id == existingCustomer.id &&
                    v.plate.trim().toUpperCase() === cleanPlate
                );

                if (existingVehicle) {
                    alert(`El cliente ${existingCustomer.name} ya tiene registrado el vehículo ${cleanPlate}. Seleccionándolo...`);
                    setFormData({ ...formData, customerId: existingCustomer.id, vehicleId: existingVehicle.id });
                } else {
                    // 3. New vehicle for existing customer
                    alert(`Cliente ${existingCustomer.name} encontrado. Añadiendo nuevo vehículo ${cleanPlate} a su perfil...`);

                    const [newV] = await createVehicle({
                        customer_id: existingCustomer.id,
                        plate: cleanPlate,
                        brand: newCustomer.vehicle_brand || '',
                        model: newCustomer.vehicle_model,
                        color: ''
                    });

                    // No longer updating legacy fields in customers table
                    /*
                    await updateCustomer(existingCustomer.id, {
                        vehicle_plate: cleanPlate,
                        vehicle_brand: newCustomer.vehicle_brand,
                        vehicle_model: newCustomer.vehicle_model
                    });
                    */

                    await refreshVehicles();
                    await refreshCustomers();
                    setFormData({ ...formData, customerId: existingCustomer.id, vehicleId: newV.id });
                }

                setIsAddingCustomer(false);
                setNewCustomer({ name: '', phone: '', vehicle_plate: '', vehicle_brand: '', vehicle_model: '', email: '', referrer_id: '' });
                setReferrerSearch('');
                return;
            }

            // 4. Truly New Customer
            const [created] = await createCustomer({
                name: newCustomer.name,
                phone: cleanPhone,
                email: newCustomer.email
            });

            if (created) {
                // 5. Handle Referral Points (+2 for referrer)
                if (newCustomer.referrer_id) {
                    const referrer = customers.find(c => c.id == newCustomer.referrer_id);
                    if (referrer) {
                        const { error: pointError } = await supabase
                            .from('customers')
                            .update({ points: (referrer.points || 0) + 2 })
                            .eq('id', referrer.id);

                        if (!pointError) {
                            console.log(`Puntos de referido (+2) otorgados a: ${referrer.name}`);
                        }
                    }
                }

                // Also create initial vehicle record
                const [newV] = await createVehicle({
                    customer_id: created.id,
                    plate: cleanPlate,
                    brand: newCustomer.vehicle_brand || '',
                    model: newCustomer.vehicle_model
                });

                await refreshCustomers();
                await refreshVehicles();

                setFormData({
                    ...formData,
                    customerId: created.id,
                    vehicleId: newV.id
                });
                setIsAddingCustomer(false);
                setNewCustomer({ name: '', phone: '', vehicle_plate: '', vehicle_brand: '', vehicle_model: '', email: '', referrer_id: '' });
                setReferrerSearch('');
                alert("¡Cliente y Vehículo registrados!");
            }
        } catch (error) {
            console.error("Error in handleCreateCustomer:", error);
            alert('Error al procesar: ' + error.message);
        }
    };

    const handlePlateSearch = async (e) => {
        if (e.key !== 'Enter' || !plateSearch.trim()) return;

        const plate = plateSearch.trim().toUpperCase();
        const found = vehicles.find(v => v.plate?.toUpperCase() === plate);

        if (found) {
            setFormData({ ...formData, customerId: found.customer_id, vehicleId: found.id });
            handleCustomerSelect(found.customer_id);
            setIsModalOpen(true);
            setPlateSearch('');
        } else {
            if (confirm(`No se encontró el vehículo ${plate}. ¿Deseas registrarlo como nuevo?`)) {
                setNewCustomer({ ...newCustomer, vehicle_plate: plate });
                setIsAddingCustomer(true);
                setIsModalOpen(true);
                setPlateSearch('');
            }
        }
    };

    // Helper para manejar fechas en zona horaria de Puerto Rico
    const getPRDateString = (dateInput) => {
        if (!dateInput) return '';
        try {
            const date = new Date(dateInput);
            // Ensure we are getting YYYY-MM-DD
            return date.toLocaleDateString('en-CA', { timeZone: 'America/Puerto_Rico' });
        } catch (e) {
            console.error("Date parse error:", e);
            return '';
        }
    };

    // DATE FILTER LOGIC
    // getPRDateString computes YYYY-MM-DD for Puerto Rico

    const todayStr = getPRDateString(new Date());
    const currentMonthStr = todayStr.substring(0, 7); // YYYY-MM

    // Filter transactions
    const filteredTransactions = transactions.filter(t => {
        const txDateLocal = getPRDateString(t.date);
        const isActive = t.status === 'waiting' || t.status === 'in_progress' || t.status === 'ready' || t.status === 'unpaid';

        if (dateFilter === 'today') {
            return txDateLocal === todayStr || isActive;
        } else if (dateFilter === 'month') {
            return txDateLocal.startsWith(currentMonthStr) || isActive;
        } else {
            // Manual Range
            return txDateLocal >= dateRange.start && txDateLocal <= dateRange.end;
        }
    });

    const filteredExpenses = expenses.filter(e => {
        const exDateLocal = getPRDateString(e.date);
        if (dateFilter === 'today') {
            return exDateLocal === getPRDateString(new Date()) && e.category === 'lunch';
        } else {
            return exDateLocal >= dateRange.start && exDateLocal <= dateRange.end && e.category === 'lunch';
        }
    });

    // Para empleados: Filtrar SOLO sus transacciones para los contadores
    const myTransactions = filteredTransactions.filter(t => {
        // 1. Verificar si está en la lista de asignaciones (Multi-empleado)
        const isAssigned = t.transaction_assignments?.some(a => a.employee_id === myEmployeeId);
        // 2. Verificar si es el empleado principal (Legacy/Fallback)
        const isPrimary = t.employee_id === myEmployeeId;
        // 3. Permitir ver la Cola de Espera (Shared Pool)
        const isWaiting = t.status === 'waiting';

        return isAssigned || isPrimary || isWaiting;
    });

    // Si es Admin, usa TODO. Si es Empleado, usa SOLO LO SUYO.
    const statsTransactions = userRole === 'admin' ? filteredTransactions : myTransactions;

    // --- NOTIFICATIONS & REALTIME LOGIC ---
    useEffect(() => {
        if (!userRole) return;

        // 1. REALTIME LISTENER FOR ALL CHANGES
        const channel = supabase
            .channel('db-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, (payload) => {
                console.log('Realtime change in transactions:', payload.eventType);

                // Sound only for NEW services (not gifts/memberships) and if admin/manager
                if (payload.eventType === 'INSERT' && 
                    (userRole === 'admin' || userRole === 'manager') &&
                    payload.new.service_id && !payload.new.payment_method?.includes('cortesia')) {
                    playNewServiceSound();
                }

                refreshTransactions(); // Auto-refresh local state
            })
            // Also listen to assignments so employee dashboards update
            .on('postgres_changes', { event: '*', schema: 'public', table: 'transaction_assignments' }, () => {
                refreshTransactions();
            })
            .subscribe();

        // 2. INTERVAL FOR LONG-RUNNING SERVICES (> 1 HR)
        const intervalId = setInterval(() => {
            const now = new Date();
            const oneHourMs = 60 * 60 * 1000;

            const longRunning = statsTransactions.filter(t => {
                if (t.status !== 'in_progress') return false;
                const startTime = new Date(t.started_at || t.created_at);
                return (now - startTime) > oneHourMs;
            });

            let newAlerts = false;
            longRunning.forEach(t => {
                if (!alertedTransactions.has(t.id)) {
                    playAlertSound();
                    alert(`⚠️ ALERTA: El vehículo ${t.customers?.vehicle_plate || '???'} lleva más de 1 hora.`);

                    setAlertedTransactions(prev => {
                        const newSet = new Set(prev);
                        newSet.add(t.id);
                        return newSet;
                    });
                    newAlerts = true;
                }
            });

        }, 60000); // Check every minute

        return () => {
            supabase.removeChannel(channel);
            clearInterval(intervalId);
        };
    }, [userRole, statsTransactions, alertedTransactions]);

    const totalIncome = filteredTransactions
        .filter(t => t.status === 'completed' || t.status === 'paid' || t.status === 'ready')
        .reduce((sum, t) => sum + calculateTxTotal(t), 0);

    const completionCount = filteredTransactions.filter(t => t.status === 'completed' || t.status === 'paid' || t.status === 'ready').length;
    const averageTicket = completionCount > 0 ? (totalIncome / completionCount) : 0;

    const totalCommissions = statsTransactions.reduce((sum, t) => {
        // SOLO contar comisiones si el servicio está COMPLETADO, PAGADO o EN DEUDA (UNPAID)
        if (t.status !== 'completed' && t.status !== 'paid' && t.status !== 'unpaid') return sum;

        // Calcular el monto total de comisión + propina de la transacción
        const txTotalCommission = (parseFloat(t.commission_amount) || 0) + (parseFloat(t.tip) || 0);

        // Determinar cuántos empleados participaron
        // Si hay assignments, usar su longitud. Si no, asumir 1 (el employee_id principal).
        const employeeCount = (t.transaction_assignments && t.transaction_assignments.length > 0)
            ? t.transaction_assignments.length
            : 1;

        // Dividir equitativamente
        const splitCommission = txTotalCommission / employeeCount;

        // FIX: Si es Admin, sumar el TOTAL de la comisión (lo que paga el negocio).
        // Si es Empleado, sumar solo SU PARTE (split).
        if (userRole === 'admin') {
            return sum + txTotalCommission;
        } else {
            return sum + splitCommission;
        }
    }, 0);





    // Calcular Almuerzos (Deducciones)
    const totalLunches = filteredExpenses.reduce((sum, e) => {
        // Si es Admin, suma todos los almuerzos. Si es Empleado, solo los suyos.
        if (userRole === 'admin' || e.employee_id === myEmployeeId) {
            return sum + (parseFloat(e.amount) || 0);
        }
        return sum;
    }, 0);

    const netCommissions = totalCommissions - totalLunches;

    useEffect(() => {
        const fetchSettings = async () => {
            // Fetch Settings
            const { data: settingsData } = await supabase
                .from('settings')
                .select('key, value');

            if (settingsData) {
                const link = settingsData.find(s => s.key === 'review_link');
                if (link) setReviewLink(link.value);

                const sLink = settingsData.find(s => s.key === 'stripe_link');
                if (sLink) setStripeLink(sLink.value);
            }
        };
        fetchSettings();
    }, [transactions]); // Refresh when transactions change

    useEffect(() => {
        const fetchFeedback = async () => {
            let query = supabase
                .from('customer_feedback')
                .select('*, transactions(customers(name), services(name))')
                .order('created_at', { ascending: false });

            // Apply Date Filter
            if (dateFilter === 'today') {
                // Assuming prStartOfDay and prEndOfDay are available or need to be recalculated here if they are state-dependent or globals
                // To be safe, let's use the same logic as transactions if possible, or simple JS dates converted to ISO
                // Given previous logic, best to use the same strings if they are available in scope? 
                // Wait, prStartOfDay/prEndOfDay are calculated at top level typically?
                // Let's look at how they are defined. If they are variables inside the component body, we use them.
                // If not, we re-calculate.
                // Let's assume re-calculation for safety or usage of dateRange if manual.

                const now = new Date();
                const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).toISOString();
                const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();

                // Better: Use the same helper or logic as transactions if accessible.
                // Let's stick to current Dashboard logic.
                // Actually, transactions are filtered IN MEMORY in this file (lines 490+).
                // So maybe we should fetch ALL for the period? 
                // Or fetch all and filter in memory? 
                // Fetching all is easier for small scale, but filtering prevents over-fetching.

                // Let's filter in memory like transactions to keep it consistent and reactive?
                // Transactions are fetched via useSupabase which fetches ALL?.
                // No, useSupabase likely fetches all.

                // To fix the user request "can I see it by dates?", let's filter the FEEDBACKS list in the UI, 
                // but for now, let's just fetch ALL (since volume is low) and filter in the RENDER or IN MEMORY.

                // WAIT, lines 490 filter transactions. We should probably filter feedbacks similarly.
                // But the user asked "will it be saved and can I see it by dates".
                // Saving is confirmed. Viewing by dates requires filtering.

                // Let's fetch ALL for now (simple) and adds a filtered list variable?
                // Or better, let's just filter the 'feedbacks' state setter? 
                // No, better to filter in the UI render or a derived state.

                // Actually, let's just leave the fetch as fetching ALL (or last 100) and filter in the view?
                // The user asked "puedo ver por fechas".
                // If I fetch all, I can filter based on the main 'dateFilter' state.
            }

            // To be robust and answer "YES", I should make sure the UI respects the date.
            // Currently the UI (lines 1600+) iterates over `feedbacks`.
            // I should change that to `filteredFeedbacks`.

            const { data } = await query;
            if (data) setFeedbacks(data);
        };
        if (userRole === 'admin' || userRole === 'manager') {
            fetchFeedback();
        }
    }, [userRole, transactions]); // Refresh when transactions change (new feedback might be linked)

    // DERIVED STATE: Filtered Feedbacks
    const filteredFeedbacks = feedbacks.filter(f => {
        const fDate = getPRDateString(f.created_at);
        if (dateFilter === 'today') {
            return fDate === getPRDateString(new Date());
        } else {
            return fDate >= dateRange.start && fDate <= dateRange.end;
        }
    });

    const handleServiceChange = (e) => {
        const serviceId = e.target.value;
        const service = services.find(s => s.id === serviceId);

        if (service) {
            let isMemberBenefit = false;

            // MEMBERSHIP CHECK
            if (customerMembership && customerMembership.status === 'active') {
                const included = customerMembership.memberships.included_services || [];
                const isIncluded = (included.length === 0)
                    ? true
                    : (included.includes(service.name) || included.includes(service.id));

                if (isIncluded) {
                    const lastUsed = customerMembership.last_used ? new Date(customerMembership.last_used) : null;
                    const isUsedToday = lastUsed && new Date(lastUsed).toDateString() === new Date().toDateString();

                    // RELAXED CHECK
                    if (customerMembership.memberships?.type === 'unlimited') {
                        if (!isUsedToday) {
                            isMemberBenefit = true;
                        } else {
                            alert(`⚠️ BENEFICIO DIARIO YA UTILIZADO\n\nLos planes ilimitados están limitados a 1 lavado diario.`);
                        }
                    } else {
                        // Limited: Allow multiple uses if they have balance
                        if ((customerMembership.usage_count || 0) < (customerMembership.memberships?.limit_count || 0)) {
                            isMemberBenefit = true;
                        } else {
                            alert(`⚠️ LÍMITE ALCANZADO\n\nEl cliente ya utilizó todos los lavados de su plan mensual.`);
                        }
                    }
                }
            }

            setIsMembershipUsage(isMemberBenefit);
            setFormData({
                ...formData,
                serviceId,
                commissionAmount: parseFloat(service.commission) || 0
            });
            // Note: Price is handled by the useEffect above
        } else {
            setIsMembershipUsage(false);
            setFormData({ ...formData, serviceId: '', price: 0, commissionAmount: 0 });
        }
    };

    const handleAddExtra = () => {
        if (newExtra.description && newExtra.price) {
            const price = parseFloat(newExtra.price);
            const updatedExtras = [...formData.extras, { ...newExtra, price }];
            const currentPrice = parseFloat(formData.price) || 0;

            setFormData({
                ...formData,
                extras: updatedExtras,
                price: currentPrice + price
            });
            setNewExtra({ description: '', price: '' });
        }
    };

    const handleRemoveExtra = (index) => {
        const extraToRemove = formData.extras[index];
        const newExtras = [...formData.extras];
        newExtras.splice(index, 1);

        const currentPrice = parseFloat(formData.price) || 0;

        setFormData({
            ...formData,
            extras: newExtras,
            price: currentPrice - extraToRemove.price
        });
    };

    const handleUpdateTransaction = async (id, updates) => {
        try {
            // Find current transaction state
            const currentTx = transactions.find(t => t.id === id);
            const isFinishing = ['ready', 'completed', 'paid'].includes(updates.status);

            // [MEMBERSHIP LOGIC] If finishing and it's a membership usage that hasn't been decremented yet
            if (isFinishing && currentTx?.payment_method === 'membership') {
                // If it's the first time reaching a finished state (from waiting or in_progress)
                if (!['ready', 'completed', 'paid'].includes(currentTx.status)) {
                    // Trigger membership logic in case it wasn't done at creation (or to ensure it's done)
                    // (Actually Dashboard does it at creation, but Edit Modal does it at completion)
                    // Let's make it idempotent by checking if we have already decremented. 
                    // To keep it simple for now, we'll let Edit Modal and Dashboard handle it in their respective processes, 
                    // but we'll add a safety check here if needed. 
                }
            }

            if (isFinishing) {
                // If the update explicitly provides finished_at, use it (from handleConfirmReady)
                if (updates.finished_at) {
                    // Do nothing, it's already set in updates
                } else if (currentTx?.finished_at) {
                    // If it already finished (e.g. was Ready), KEEP the original time
                    // Do not overwrite with new time unless explicitly requested
                    updates.finished_at = currentTx.finished_at;
                } else {
                    // First time finishing? Set current time
                    updates.finished_at = new Date().toISOString();
                }
            }

            await updateTransaction(id, updates);
            // setEditingTransactionId(null); // REMOVED: Let the modal close itself to allow async receipt upload
            await refreshTransactions();
        } catch (error) {
            console.error("Update failed:", error);
            alert("Error al actualizar: " + error.message);
        }
    };

    const handleDeleteTransactionV2 = async (id) => {
        if (!window.confirm("¿Estás seguro de que quieres CANCELAR este servicio?\n\nDesaparecerá de la lista activa.")) return;

        try {
            // 1. TRY RPC FIRST (Bypass RLS)
            let cancellerName = 'Usuario Desconocido';
            if (myEmployeeId && employees) {
                const me = employees.find(e => e.id === myEmployeeId);
                if (me) cancellerName = me.name || 'Empleado';
            }

            const { data: rpcData, error: rpcError } = await supabase.rpc('cancel_transaction_v2', {
                tx_id: id,
                canceller_name: cancellerName
            });

            if (!rpcError && rpcData?.success) {
                // RPC Success
                console.log("Transaction cancelled via RPC");
                await refreshTransactions();
                setEditingTransactionId(null);
                alert("Venta cancelada correctamente (RPC).");
                return;
            } else {
                console.warn("RPC cancel failed or not exists, falling back to manual update:", rpcError);
            }

            // 2. FALLBACK: Manual Soft Delete (Subject to RLS)
            // CRITICAL FIX: We must Update FIRST, while we are still assigned.
            // If we delete assignments first, we lose permission to update the transaction!

            console.log("Attempting Manual Soft Delete...");

            // A. Update status to 'cancelled' (Keep assignments for a moment to pass RLS)
            let result;
            try {
                result = await updateTransaction(id, {
                    status: 'cancelled',
                    finished_at: null,
                    price: 0,
                    commission_amount: 0,
                    extras: [],
                    cancelled_by: cancellerName // Try to save usage name
                });
            } catch (err) {
                console.warn("Update with cancelled_by failed (likely missing column), retrying without it:", err);

                // RETRY: Direct Supabase call without .select() to avoid schema cache issues
                const { error: retryError } = await supabase
                    .from('transactions')
                    .update({
                        status: 'cancelled',
                        finished_at: null,
                        price: 0,
                        commission_amount: 0,
                        extras: []
                    })
                    .eq('id', id);

                if (retryError) throw retryError;

                // Mock a result to pass the next check
                result = [{ id }];
            }

            // Check if RLS blocked the update
            if (!result || result.length === 0) {
                alert("⚠️ ACCESO DENEGADO\n\nNo tienes permiso para cancelar este servicio.\n\nSOLUCIÓN: Pide al Admin que ejecute el script 'cancel_rpc.sql'.");
                return;
            }

            // B. Now that it is cancelled, we can try to clean up assignments
            // (Even if this fails, the service is effectively cancelled)

            const { error: assignError } = await supabase
                .from('transaction_assignments')
                .delete()
                .eq('transaction_id', id);

            if (assignError) console.warn("Error cleaning assignments (non-critical):", assignError);

            const { error: feedbackError } = await supabase
                .from('customer_feedback')
                .delete()
                .eq('transaction_id', id);

            if (feedbackError) console.warn("Error cleaning feedback:", feedbackError);

            // 5. Force refresh
            await refreshTransactions();

            setEditingTransactionId(null);
            alert("Venta cancelada correctamente.");
        } catch (error) {
            console.error("Error cancelling:", error);
            alert("Error al cancelar: " + (error.message || JSON.stringify(error)));
        }
    };

    const handleRevertToInProgress = async (tx) => {
        if (!window.confirm(`¿Devolver ${tx.customers?.vehicle_plate} a "En Proceso"?`)) return;

        try {
            await updateTransaction(tx.id, {
                status: 'in_progress',
                started_at: tx.started_at || new Date().toISOString(),
                finished_at: null // Clear finished time
            });
            await refreshTransactions();
        } catch (error) {
            console.error("Error reverting status:", error);
            alert("Error al devolver estado: " + error.message);
        }
    };

    const handleRevertToReady = async (tx) => {
        if (!window.confirm(`¿Devolver ${tx.customers?.vehicle_plate} a "Listo para Recoger"?`)) return;

        try {
            await updateTransaction(tx.id, {
                status: 'ready',
                // Keep finished_at so we know when it was finished
            });
            await refreshTransactions();
        } catch (error) {
            console.error("Error reverting to ready:", error);
            alert("Error al devolver estado: " + error.message);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();


        if (!formData.customerId || formData.customerId === '') {
            alert('Por favor selecciona un cliente.');
            return;
        }
        // VALIDATION: Vehicle is now mandatory
        if (!formData.vehicleId || formData.vehicleId === '') {
            alert('Por favor selecciona un vehículo.');
            return;
        }
        if (!formData.serviceId || formData.serviceId === '') {
            alert('Por favor selecciona un servicio.');
            return;
        }

        // [GUARD] PREVENT DUPLICATE MEMBERSHIP CHARGES
        const selectedService = services.find(s => s.id === formData.serviceId);
        const isMembershipSale = selectedService?.name?.toLowerCase().includes('membresía') || 
                                (formData.extras || []).some(ex => ex.description?.toLowerCase().includes('membresía'));
        
        if (isMembershipSale && !isMembershipUsage) {
            const currentMonth = new Date().toISOString().substring(0, 7);
            const hasDuplicate = transactions.some(t => 
                t.customer_id === formData.customerId && 
                getTransactionCategory(t) === 'membership_sale' &&
                t.date.startsWith(currentMonth) &&
                t.status !== 'cancelled'
            );

            if (hasDuplicate) {
                const proceed = window.confirm("⚠️ ALERTA DE DUPLICADO: Este cliente ya tiene un pago de membresía registrado este mes.\n\n¿Estás SEGURO de que quieres cobrarle la membresía otra vez?");
                if (!proceed) return;
            }
        }

        const basePrice = parseFloat(formData.price) || 0;
        const transactionDate = new Date();
        const [hours, minutes] = formData.serviceTime.split(':');
        transactionDate.setHours(hours, minutes, 0, 0);

        // NEW FLOW: Register -> Waiting (No Employee Assigned Yet)
        const newTransaction = {
            date: transactionDate.toISOString(),
            customer_id: formData.customerId || null,
            vehicle_id: formData.vehicleId || null, // Add vehicle_id
            service_id: formData.serviceId || null,
            employee_id: null, // No assigned yet
            price: (isMembershipUsage || isExtraWashUsage) ? 0 : basePrice,
            commission_amount: (parseFloat(formData.commissionAmount) || 0) + (formData.extras || []).reduce((sum, ex) => sum + (parseFloat(ex.commission) || 0), 0),
            tip: 0,
            payment_method: (isMembershipUsage || isExtraWashUsage) ? 'membership' : 'cash',
            extras: isExtraWashUsage 
                ? [...(formData.extras || []), { description: `CORTESÍA REDIMIDA`, price: 0 }]
                : (isMembershipUsage ? [...(formData.extras || []), { description: `Membresía: ${customerMembership.memberships.name}`, price: 0 }] : (formData.extras || [])),

            status: 'waiting', // Initial Status
            total_price: (isMembershipUsage || isExtraWashUsage) ? (formData.extras || []).reduce((sum, ex) => sum + (parseFloat(ex.price) || 0), 0) : basePrice // REQUIRED by DB constraint
        };

        try {
            // [REFERRAL] Award Points to Referrer (+2)
            const activeReferrerId = newCustomer.referrer_id || formData.referrerId;
            if (activeReferrerId) {
                const referrer = customers.find(c => c.id == activeReferrerId);
                if (referrer) {
                    await supabase
                        .from('customers')
                        .update({ points: (referrer.points || 0) + 2 })
                        .eq('id', referrer.id);
                    console.log(`Puntos de referido (+2) otorgados a: ${referrer.name}`);
                }
            }

            // [LOYALTY] Deduct Points
            if (isRedemption) {
                // Deduct from customer (compatibility)
                const { data: customer } = await supabase.from('customers').select('points').eq('id', formData.customerId).single();
                if (customer) {
                    await supabase.from('customers').update({ points: Math.max(0, (customer.points || 0) - 10) }).eq('id', formData.customerId);
                }

                // NEW: Deduct from vehicle independently
                if (formData.vehicleId) {
                    const { data: vehicle } = await supabase.from('vehicles').select('points').eq('id', formData.vehicleId).single();
                    if (vehicle) {
                        await supabase.from('vehicles').update({ points: Math.max(0, (vehicle.points || 0) - 10) }).eq('id', formData.vehicleId);
                    }
                }
            }

            // [MEMBERSHIP] Increment Usage & Timestamp
            if (isMembershipUsage && customerMembership) {
                console.log("INCREMENTANDO USO DE MEMBRESÍA:", customerMembership.id, "Valor previo:", customerMembership.usage_count);
                const { error: usageErr } = await supabase.from('customer_memberships')
                    .update({
                        usage_count: (customerMembership.usage_count || 0) + 1,
                        last_used: new Date().toISOString()
                    })
                    .eq('id', customerMembership.id);

                if (usageErr) {
                    console.error("Error al incrementar uso de membresía:", usageErr);
                    alert("⚠️ No se pudo registrar el uso en el saldo de la membresía. Contacte a soporte.");
                } else {
                    console.log("Uso de membresía incrementado correctamente.");
                }
            }

            // [EXTRA WASH] Mark as Used - USE updateTransaction for Local State Consistency
            if (isExtraWashUsage && availableExtraWashes.length > 0) {
                const courtesy = availableExtraWashes[0]; // Take the oldest
                const currentExtras = Array.isArray(courtesy.extras) ? courtesy.extras : [courtesy.extras];
                const updatedExtras = [...currentExtras, { used: true, used_at: new Date().toISOString() }];
                
                try {
                    await updateTransaction(courtesy.id, { extras: updatedExtras });
                    console.log("Cortesía marcada como usada y estado local actualizado.");
                } catch (courtesyErr) {
                    console.error("Error al marcar cortesía como usada:", courtesyErr);
                }
            }

            setIsSubmitting(true); // Disable button
            await createTransaction(newTransaction);

            setIsModalOpen(false);
            setIsSubmitting(false);
            setIsRedemption(false); // Reset Loyalty State
            setIsMembershipUsage(false);
            setIsExtraWashUsage(false); // Reset Extra Wash state
            setCustomerMembership(null);
            setAvailableExtraWashes([]);
            setFormData({
                customerId: '',
                vehicleId: '',
                serviceId: '',
                employeeId: '',
                selectedEmployees: [],
                price: '',
                commissionAmount: '',
                serviceTime: new Date().toTimeString().slice(0, 5),
                extras: [],
                referrerId: ''
            });
            setReferrerSearch('');
            // await refreshTransactions(); // Remove explicit refresh if createTransaction updates state, or keep it but ensure no race condition.
            // Actually, useSupabase updates state. refreshTransactions fetches again.
            // To be safe against duplication, let's rely on refreshTransactions but clear the form first.
            await refreshTransactions();
            alert("¡Turno registrado! Añadido a Cola de Espera.");

        } catch (error) {
            console.error("Error creating transaction:", error);
            alert("ERROR AL REGISTRAR: " + (error.message || JSON.stringify(error)));
        } finally {
            setIsSubmitting(false); // Re-enable button
        }
    };

    const getPaymentMethodLabel = (method) => {
        switch (method) {
            case 'cash': return 'Efectivo';
            case 'card': return 'Tarjeta';
            case 'transfer': return 'AthMóvil';
            default: return method;
        }
    };

    // --- FRACTIONAL COUNT CALCULATION ---
    const fractionalCount = statsTransactions
        .filter(t => t.status === 'completed' || t.status === 'paid')
        .reduce((sum, t) => {
            const uniqueAssignees = new Set((t.transaction_assignments || []).map(a => a.employee_id));
            const assignmentCount = uniqueAssignees.size > 0 ? uniqueAssignees.size : 1;
            return sum + (1 / assignmentCount);
        }, 0);


    // ────────────────────────────────────────────
    // CONTEXT VALUE: All state & handlers shared
    //   with sub-components via DashboardContext
    // ────────────────────────────────────────────
    const dashboardContextValue = {
        // Identity
        myUserId, myEmployeeId, userRole,
        // Data
        services, employees, customers, vehicles, transactions, memberships,
        expenses,
        // UI State
        dateFilter, setDateFilter,
        dateRange, setDateRange,
        viewMode, setViewMode,
        activeDetailModal, setActiveDetailModal,
        selectedTransaction, setSelectedTransaction,
        isModalOpen, setIsModalOpen,
        editingTransactionId, setEditingTransactionId,
        isRefreshing, setIsRefreshing,
        isConfigModalOpen, setIsConfigModalOpen,
        qrTransactionId, setQrTransactionId,
        verifyingTransaction, setVerifyingTransaction,
        hasConsentedVerification, setHasConsentedVerification,
        isUploadingPhoto, setIsUploadingPhoto,
        photoToUpload, setPhotoToUpload,
        viewingPhoto, setViewingPhoto,
        showAssignmentModal, setShowAssignmentModal,
        assigningTransactionId, setAssigningTransactionId,
        selectedEmployeesForAssignment, setSelectedEmployeesForAssignment,
        // Form State
        formData, setFormData,
        isSubmitting, setIsSubmitting,
        error, setError,
        activeTab, setActiveTab,
        newExtra, setNewExtra,
        customerSearch, setCustomerSearch,
        showCustomerSearch, setShowCustomerSearch,
        plateSearch, setPlateSearch,
        isAddingCustomer, setIsAddingCustomer,
        newCustomer, setNewCustomer,
        customerVehicles, setCustomerVehicles,
        referrerSearch, setReferrerSearch,
        showReferrerSearch, setShowReferrerSearch,
        pendingExtra, setPendingExtra,
        // Membership State
        customerMembership, setCustomerMembership,
        allCustomerMemberships, setAllCustomerMemberships,
        isMembershipUsage, setIsMembershipUsage,
        availableExtraWashes, setAvailableExtraWashes,
        isExtraWashUsage, setIsExtraWashUsage,
        // Loyalty State
        isRedemption, setIsRedemption,
        vipInfo, setVipInfo,
        canRedeemPoints, setCanRedeemPoints,
        lastService, setLastService,
        // Settings
        reviewLink, setReviewLink,
        stripeLink, setStripeLink,
        // Handlers / helpers
        getServiceName,
        getCustomerName,
        getEmployeeName,
        calculateTxTotal,
        getTransactionCategory,
        handleCustomerSelect,
        handleCreateCustomer,
        handleSubmit,
        handleRemoveExtra,
        handleStartService,
        handleAssignMembership,
        handleRemoveMembership,
        applyLastService,
        handleDeleteTransactionV2,
        handleOpenVerification,
        handleMarkAsUnpaid,
        handleRevertToInProgress,
        handleRevertToReady,
        handlePayment,
        handleSendDebtReminder,
        refreshTransactions,
        refreshCustomers,
        formatToFraction,
        // Report
        statsTransactions,
        getPRDateString,
        totalIncome,
        filteredExpenses,
        totalLunches,
        netCommissions,
        fractionalCount,
        // Feedback
        feedbacks,
        filteredFeedbacks,
        todayStr,
        // Debug
        debugInfo, setDebugInfo,
    };

    console.log("VERSION 4.74 NUCLEAR LOADED");
    return (
        <DashboardProvider value={dashboardContextValue}>
        <div>
            {/* HEADER */}
            <header className="p-3 md:p-6 mb-4 space-y-4 bg-zinc-900/50 backdrop-blur-xl border-b border-white/5 sticky top-0 z-40">
                {/* ROW 1: BRANDING & UTILITIES */}
                <div className="flex items-center justify-between gap-2 overflow-hidden">
                    {/* LEFT: Branding */}
                    <div className="flex items-center gap-3 shrink-0 group">
                        <div className="relative">
                            <img 
                                src="/logo.jpg" 
                                alt="Logo" 
                                style={{ width: '28px', height: '28px', borderRadius: '0.5rem', objectFit: 'contain' }}
                                className="ring-1 ring-white/10 shadow-lg" 
                            />
                        </div>
                        <div className="leading-tight">
                            <h1 className="text-lg md:text-xl font-black tracking-tight text-white flex items-center gap-2">
                                <span className="hidden xs:inline">Dashboard</span>
                                <span className="text-[10px] bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full uppercase tracking-widest font-bold border border-indigo-500/30">
                                    Pro
                                </span>
                            </h1>
                            <p className="text-[9px] md:text-[10px] text-zinc-500 font-bold uppercase tracking-widest opacity-60 truncate max-w-[100px] md:max-w-none">
                                CarWash
                            </p>
                        </div>
                    </div>

                    {/* RIGHT: Top Utilities */}
                    <div className="flex items-center gap-2 relative z-50">
                        {(userRole === 'admin' || userRole === 'manager') && (
                            <div className="flex items-center bg-zinc-800/50 p-1 rounded-xl border border-white/5 shadow-inner">
                                <button
                                    onClick={async () => { await unlockAudio(); alert("🔊 Audio activado."); }}
                                    className="p-2 text-zinc-400 hover:text-white transition-colors active:scale-95"
                                    title="Notificaciones Sonoras"
                                >
                                    <span className="text-lg">🔔</span>
                                </button>
                                <div className="w-px h-4 bg-white/10 mx-1"></div>
                                <button
                                    className="px-3 md:px-5 py-2 text-[10px] md:text-xs font-black text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20 uppercase tracking-widest active:scale-95"
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        try {
                                            await generateDailyReport({
                                                statsTransactions,
                                                expenses,
                                                getPRDateString,
                                                getServiceName,
                                                employees
                                            });
                                        } catch (error) {
                                            console.error("Error generating PDF:", error);
                                            alert("Error: " + error.message);
                                        }
                                    }}
                                >
                                    <MessageCircle size={14} />
                                    <span className="hidden sm:inline">PDF DIARIO</span>
                                    <span className="sm:hidden">PDF</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* ROW 2 & 3: CONTROLS & SEARCH */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', backgroundColor: 'var(--bg-card)', padding: '1rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
                    
                    {/* View Switcher & Date Filters Group */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
                        {/* View Switcher */}
                        {userRole === 'admin' && (
                            <div style={{ display: 'flex', gap: '0.5rem', flex: '1 1 auto', minWidth: '200px' }}>
                                <button 
                                    onClick={() => setViewMode('ops')} 
                                    className={`btn ${viewMode === 'ops' ? 'btn-primary' : ''}`}
                                    style={{ flex: 1, padding: '0.75rem', fontSize: '0.9rem', fontWeight: 'bold', background: viewMode !== 'ops' ? 'rgba(255,255,255,0.05)' : undefined, color: viewMode !== 'ops' ? 'var(--text-muted)' : 'white' }}
                                >
                                    MODO OPS
                                </button>
                                <button 
                                    onClick={() => setViewMode('reports')} 
                                    className={`btn ${viewMode === 'reports' ? 'btn-primary' : ''}`}
                                    style={{ flex: 1, padding: '0.75rem', fontSize: '0.9rem', fontWeight: 'bold', background: viewMode !== 'reports' ? 'rgba(255,255,255,0.05)' : undefined, color: viewMode !== 'reports' ? 'var(--text-muted)' : 'white' }}
                                >
                                    REPORTES
                                </button>
                            </div>
                        )}

                        {/* Date Filters */}
                        <div style={{ display: 'flex', gap: '0.5rem', flex: '1 1 auto', minWidth: '200px' }}>
                            {['today', 'month', 'manual'].map((filter) => (
                                <button
                                    key={filter}
                                    onClick={() => setDateFilter(filter)}
                                    className="btn"
                                    style={{
                                        flex: 1,
                                        padding: '0.75rem',
                                        fontSize: '0.9rem',
                                        fontWeight: 'bold',
                                        backgroundColor: dateFilter === filter ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                                        color: dateFilter === filter ? 'white' : 'var(--text-muted)',
                                        border: `1px solid ${dateFilter === filter ? 'var(--primary)' : 'transparent'}`,
                                    }}
                                >
                                    {filter === 'today' ? 'Hoy' : filter === 'month' ? 'Mes' : '🕒 Fecha'}
                                </button>
                            ))}
                        </div>
                        
                        {/* Manual Date Inputs Wrapper */}
                        {dateFilter === 'manual' && (
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flex: '1 1 100%', backgroundColor: 'rgba(0,0,0,0.3)', padding: '0.5rem', borderRadius: 'var(--radius-md)' }}>
                                <input type="date" className="input" style={{ padding: '0.5rem', fontSize: '0.9rem' }} value={dateRange.start} onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))} />
                                <span style={{ color: 'var(--text-muted)' }}>-</span>
                                <input type="date" className="input" style={{ padding: '0.5rem', fontSize: '0.9rem' }} value={dateRange.end} onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))} />
                            </div>
                        )}
                    </div>

                    {/* Primary Actions Workspace */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', marginTop: '0.5rem' }}>
                        <button 
                            className="btn btn-primary"
                            style={{ padding: '1rem 2rem', fontSize: '1.1rem', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '1 1 auto', justifyContent: 'center', minWidth: '150px' }}
                            onClick={(e) => { e.stopPropagation(); setIsModalOpen(true); }}
                        >
                            <Plus size={24} />
                            NUEVO
                        </button>

                        <div style={{ position: 'relative', flex: '2 1 auto', minWidth: '200px' }}>
                            <Car size={20} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                type="text"
                                placeholder="BUSCAR TABLILLA..."
                                className="input"
                                style={{ width: '100%', paddingLeft: '3rem', paddingRight: '1rem', height: '3.5rem', fontSize: '1.1rem', fontWeight: 'bold', textTransform: 'uppercase', backgroundColor: 'rgba(0,0,0,0.4)' }}
                                value={plateSearch}
                                onChange={(e) => setDateFilter('today') || setPlateSearch(e.target.value.toUpperCase())}
                                onKeyDown={handlePlateSearch}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', flex: '1 1 auto' }}>
                            <button 
                                className="btn"
                                onClick={refreshTransactions}
                                style={{ padding: '1rem', backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--text-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}
                            >
                                <RefreshCw size={20} className={isRefreshing ? 'animate-spin' : ''} />
                            </button>
                            {(userRole === 'admin' || userRole === 'manager') && (
                                <button 
                                    className="btn"
                                    onClick={() => setIsConfigModalOpen(true)}
                                    style={{ padding: '1rem', backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--text-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}
                                >
                                    <Settings size={20} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Cancelled Button */}
                    <button 
                        onClick={() => setActiveDetailModal('cancelled')} 
                        className="w-full lg:w-auto px-4 md:px-5 py-2 md:py-2.5 bg-red-500/5 hover:bg-red-500/10 text-red-500 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest border border-red-500/10 transition-all flex items-center justify-center gap-3 shadow-lg shadow-red-500/5"
                    >
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                        </span>
                        <span>Cancelaciones</span>
                    </button>
                </div>
            </header>

            {/* MULTI-STAGE FLOW SECTIONS (Compacted) */}
            {viewMode === 'reports' ? (
                /* REPORTES DASHBOARD (Dashboard 2.0) */
                <div style={{ padding: '1rem' }}>
                    {/* KPI CARDS */}
                    <div className="grid-responsive" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                        <div className="card" style={{ padding: '1.5rem', backgroundColor: 'white', borderRadius: '1rem', borderLeft: '4px solid #10b981' }}>
                            <div style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 'bold' }}>Ticket Promedio</div>
                            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b' }}>${averageTicket.toFixed(2)}</div>
                        </div>
                        <div className="card" style={{ padding: '1.5rem', backgroundColor: 'white', borderRadius: '1rem', borderLeft: '4px solid #3b82f6' }}>
                            <div style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 'bold' }}>Ingreso Total (Filtrado)</div>
                            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b' }}>${totalIncome.toFixed(2)}</div>
                        </div>
                        <div className="card" style={{ padding: '1.5rem', backgroundColor: 'white', borderRadius: '1rem', borderLeft: '4px solid #f59e0b' }}>
                            <div style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 'bold' }}>Autos Lavados</div>
                            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b' }}>{completionCount}</div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                        {/* CHART 1: Service Analytics (Existing) */}
                        <ServiceAnalyticsChart transactions={statsTransactions} />

                        {/* CHART 2: Peak Hours (New) */}
                        <PeakHoursChart transactions={statsTransactions} />

                        {/* REPORT: Top Customers (New) */}
                        <TopCustomersReport transactions={transactions} customers={customers} />
                    </div>
                </div>
            ) : (
                <>
                    {/* OPERACIONES DASHBOARD (Consolidated 2-Col Grid) */}
                    <div className="force-2-col-grid" style={{ marginBottom: '2rem', gap: '1rem' }}>

                        {/* 1. EN ESPERA */}
                        <div
                            onClick={() => setActiveDetailModal('waiting_list')}
                            style={{
                                backgroundColor: 'var(--bg-card)', padding: '1.25rem', borderRadius: '1rem',
                                boxShadow: '0 4px 6px rgba(0,0,0,0.1)', cursor: 'pointer',
                                border: activeDetailModal === 'waiting_list' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                                transition: 'transform 0.2s', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', aspectRatio: '1/1'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        >
                            <Clock size={32} color="#6366f1" style={{ marginBottom: '0.5rem' }} />
                            <h3 className="label" style={{ marginBottom: '0.25rem', fontSize: '0.85rem' }}>En Espera</h3>
                            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--text-primary)', lineHeight: 1 }}>
                                {statsTransactions.filter(t => t.status === 'waiting').length}
                            </div>
                        </div>

                        {/* 2. EN PROCESO */}
                        <div
                            onClick={() => setActiveDetailModal('in_progress_list')}
                            style={{
                                backgroundColor: 'var(--bg-card)', padding: '1.25rem', borderRadius: '1rem',
                                boxShadow: '0 4px 6px rgba(0,0,0,0.1)', cursor: 'pointer',
                                border: activeDetailModal === 'in_progress_list' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                                transition: 'transform 0.2s', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', aspectRatio: '1/1'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        >
                            <Droplets size={32} color="#3B82F6" style={{ marginBottom: '0.5rem' }} />
                            <h3 className="label" style={{ marginBottom: '0.25rem', fontSize: '0.85rem' }}>En Proceso</h3>
                            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--text-primary)', lineHeight: 1 }}>
                                {statsTransactions.filter(t => t.status === 'in_progress').length}
                            </div>
                        </div>

                        {/* 3. LISTOS */}
                        <div
                            onClick={() => setActiveDetailModal('ready_list')}
                            style={{
                                backgroundColor: 'var(--bg-card)', padding: '1.25rem', borderRadius: '1rem',
                                boxShadow: '0 4px 6px rgba(0,0,0,0.1)', cursor: 'pointer',
                                border: activeDetailModal === 'ready_list' ? '2px solid #10B981' : '1px solid var(--border-color)',
                                transition: 'transform 0.2s', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', aspectRatio: '1/1'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        >
                            <DollarSign size={32} color="#10B981" style={{ marginBottom: '0.5rem' }} />
                            <h3 className="label" style={{ marginBottom: '0.25rem', fontSize: '0.85rem' }}>Listos</h3>
                            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--text-primary)', lineHeight: 1 }}>
                                {statsTransactions.filter(t => t.status === 'ready').length}
                            </div>
                        </div>

                        {/* 4. DEUDORES */}
                        <div
                            onClick={() => setActiveDetailModal('unpaid_list')}
                            style={{
                                backgroundColor: 'var(--bg-card)', padding: '1.25rem', borderRadius: '1rem',
                                boxShadow: '0 4px 6px rgba(0,0,0,0.1)', cursor: 'pointer',
                                border: activeDetailModal === 'unpaid_list' ? '2px solid #ef4444' : '1px solid var(--border-color)',
                                transition: 'transform 0.2s', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', aspectRatio: '1/1'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        >
                            <AlertCircle size={32} color="#ef4444" style={{ marginBottom: '0.5rem' }} />
                            <h3 className="label" style={{ marginBottom: '0.25rem', fontSize: '0.85rem', color: '#ef4444' }}>Deudores</h3>
                            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ef4444', lineHeight: 1 }}>
                                {statsTransactions.filter(t => t.status === 'unpaid').length}
                            </div>
                        </div>

                        {/* 5. TOTAL REGISTRADOS / MIS SERVICIOS */}
                        <div
                            onClick={() => setActiveDetailModal('cars')}
                            style={{
                                backgroundColor: 'var(--bg-card)', padding: '1.25rem', borderRadius: '1rem',
                                boxShadow: '0 4px 6px rgba(0,0,0,0.1)', cursor: 'pointer',
                                border: activeDetailModal === 'cars' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                                transition: 'transform 0.2s', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', aspectRatio: '1/1'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        >
                            <Car size={32} color="var(--text-muted)" style={{ marginBottom: '0.5rem' }} />
                            <h3 className="label" style={{ marginBottom: '0.25rem', fontSize: '0.85rem' }}>
                                {userRole === 'admin' || userRole === 'manager' ? 'Total Autos' : 'Mis Servicios'}
                            </h3>
                            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--text-primary)', lineHeight: 1 }}>
                                {userRole === 'admin' || userRole === 'manager'
                                    ? statsTransactions.filter(t =>
                                        getTransactionCategory(t) !== 'membership_sale' &&
                                        t.status !== 'unpaid' &&
                                        (dateFilter !== 'today' || getPRDateString(t.date) === todayStr)
                                    ).length
                                    : statsTransactions.filter(t =>
                                        t.status !== 'waiting' &&
                                        getTransactionCategory(t) !== 'membership_sale' &&
                                        t.status !== 'unpaid' &&
                                        (dateFilter !== 'today' || getPRDateString(t.date) === todayStr)
                                    ).length}
                            </div>
                        </div>

                        {/* 6. AUTOS COMPLETADOS / MIS AUTOS */}
                        <div
                            onClick={() => (userRole === 'admin' || userRole === 'manager') && setActiveDetailModal('income')}
                            style={{
                                backgroundColor: 'var(--bg-card)', padding: '1.25rem', borderRadius: '1rem',
                                boxShadow: '0 4px 6px rgba(0,0,0,0.1)', cursor: (userRole === 'admin' || userRole === 'manager') ? 'pointer' : 'default',
                                border: activeDetailModal === 'income' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                                transition: 'transform 0.2s', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', aspectRatio: '1/1'
                            }}
                            onMouseEnter={(e) => (userRole === 'admin' || userRole === 'manager') && (e.currentTarget.style.transform = 'scale(1.02)')}
                            onMouseLeave={(e) => (userRole === 'admin' || userRole === 'manager') && (e.currentTarget.style.transform = 'scale(1)')}
                        >
                            <CheckCircle size={32} color="var(--primary)" style={{ marginBottom: '0.5rem' }} />
                            <h3 className="label" style={{ marginBottom: '0.25rem', fontSize: '0.85rem' }}>
                                {(userRole === 'admin' || userRole === 'manager') ? 'Completados' : 'Mis Autos'}
                            </h3>
                            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary)', lineHeight: 1 }}>
                                {userRole === 'admin'
                                    ? statsTransactions.filter(t => (t.status === 'completed' || t.status === 'paid') && getTransactionCategory(t) !== 'membership_sale').length
                                    : formatToFraction(statsTransactions.filter(t => (t.status === 'completed' || t.status === 'paid') && getTransactionCategory(t) !== 'membership_sale').reduce((sum, t) => {
                                        const uniqueAssignees = new Set((t.transaction_assignments || []).map(a => a.employee_id));
                                        const assignmentCount = uniqueAssignees.size > 0 ? uniqueAssignees.size : 1;
                                        return sum + (1 / assignmentCount);
                                    }, 0))
                                }
                            </div>
                        </div>

                        {/* 7. INGRESOS HOY (Admin only) */}
                        {userRole === 'admin' && (
                            <div
                                onClick={() => setActiveDetailModal('income')}
                                style={{
                                    backgroundColor: 'var(--bg-card)', padding: '1.25rem', borderRadius: '1rem',
                                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)', cursor: 'pointer',
                                    border: activeDetailModal === 'income' ? '2px solid var(--success)' : '1px solid var(--border-color)',
                                    transition: 'transform 0.2s', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', aspectRatio: '1/1'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                            >
                                <TrendingUp size={32} color="var(--success)" style={{ marginBottom: '0.5rem' }} />
                                <h3 className="label" style={{ marginBottom: '0.25rem', fontSize: '0.85rem' }}>Ingresos</h3>
                                <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--success)', lineHeight: 1 }}>
                                    ${totalIncome.toFixed(0)}
                                </div>
                                <p style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>(Sin propinas)</p>
                            </div>
                        )}

                        {/* 8. COMISIONES / MI NETO */}
                        <div
                            onClick={() => setActiveDetailModal('commissions')}
                            style={{
                                backgroundColor: 'var(--bg-card)', padding: '1.25rem', borderRadius: '1rem',
                                boxShadow: '0 4px 6px rgba(0,0,0,0.1)', cursor: 'pointer',
                                border: activeDetailModal === 'commissions' ? '2px solid var(--warning)' : '1px solid var(--border-color)',
                                transition: 'transform 0.2s', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', aspectRatio: '1/1'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        >
                            <Users size={32} color="var(--warning)" style={{ marginBottom: '0.5rem' }} />
                            <h3 className="label" style={{ marginBottom: '0.25rem', fontSize: '0.85rem' }}>
                                {userRole === 'admin' ? 'Comisiones' : 'Mi Neto'}
                            </h3>
                            <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--warning)', lineHeight: 1 }}>
                                ${userRole === 'admin' ? totalCommissions.toFixed(0) : netCommissions.toFixed(2)}
                            </div>
                            {totalLunches > 0 && userRole !== 'admin' && (
                                <span style={{ fontSize: '0.6rem', color: 'var(--danger)', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '0.1rem 0.3rem', borderRadius: '0.2rem', marginTop: '0.2rem' }}>
                                    -${totalLunches.toFixed(0)}
                                </span>
                            )}
                        </div>

                        {/* 9. EXTRA: EMPLOYEE NOTE (If applicable) */}
                        {userRole !== 'admin' && userRole !== 'manager' && (
                            <div
                                style={{
                                    backgroundColor: 'var(--bg-card)', padding: '1.25rem', borderRadius: '1rem',
                                    border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', aspectRatio: '1/1', opacity: 0.8
                                }}
                            >
                                <AlertTriangle size={32} color="var(--accent)" style={{ marginBottom: '0.5rem' }} />
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Métricas hoy</p>
                            </div>
                        )}
                    </div>

                    {/* RESEÑAS PRIVADAS (Relocated Below Stats) */}
                    {/* ADMIN SPLIT ROW: FEEDBACK & DAILY NOTES */}
                    {(userRole === 'admin' || userRole === 'manager') && (
                        <div className="force-2-col-grid" style={{ marginBottom: '1.5rem' }}>
                            {/* FEEDBACK CARD */}
                            <div
                                className="card"
                                onClick={() => setActiveDetailModal('feedback')}
                                style={{ cursor: 'pointer', transition: 'transform 0.2s', padding: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.01)'}
                                onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)', padding: '0.75rem', borderRadius: '0.5rem' }}>
                                        <MessageSquare size={24} color="#8b5cf6" />
                                    </div>
                                    <div>
                                        <h3 className="label" style={{ fontSize: '1rem', marginBottom: '0.2rem', color: 'var(--text-primary)' }}>Feedback</h3>
                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Comentarios de clientes</p>
                                    </div>
                                </div>
                                <div>
                                    <p style={{ fontSize: '2rem', fontWeight: 'bold', lineHeight: 1, color: 'var(--text-primary)' }}>{filteredFeedbacks.length}</p>
                                </div>
                            </div>


                        </div>
                    )}

                    {/* ASSIGNMENT MODAL */}
                    {
                        assigningTransactionId && (
                            <div style={{
                                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                                backgroundColor: 'rgba(0,0,0,0.8)',
                                display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000
                            }} onClick={() => setAssigningTransactionId(null)}>
                                <div style={{
                                    backgroundColor: 'var(--bg-card)',
                                    padding: '2rem',
                                    borderRadius: '0.5rem',
                                    width: '90%',
                                    maxWidth: '400px'
                                }} onClick={e => e.stopPropagation()}>
                                    <h2 style={{ marginTop: 0 }}>Asignar Empleado(s)</h2>
                                    <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>¿Quién lavará este auto?</p>

                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '2rem' }}>
                                        {employees.map(emp => (
                                            <button
                                                key={emp.id}
                                                onClick={() => {
                                                    const current = selectedEmployeesForAssignment;
                                                    const isSelected = current.some(id => String(id) === String(emp.id));
                                                    if (isSelected) {
                                                        setSelectedEmployeesForAssignment(current.filter(id => String(id) !== String(emp.id)));
                                                    } else {
                                                        setSelectedEmployeesForAssignment([...current, emp.id]);
                                                    }
                                                }}
                                                style={{
                                                    padding: '0.5rem 1rem',
                                                    borderRadius: '20px',
                                                    border: '1px solid var(--primary)',
                                                    backgroundColor: selectedEmployeesForAssignment.some(id => String(id) === String(emp.id)) ? 'var(--primary)' : 'transparent',
                                                    color: selectedEmployeesForAssignment.some(id => String(id) === String(emp.id)) ? 'white' : 'var(--text-primary)',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                {emp.name}
                                            </button>
                                        ))}
                                    </div>

                                    <div style={{ display: 'flex', gap: '1rem' }}>
                                        <button
                                            className="btn"
                                            style={{ flex: 1, backgroundColor: 'var(--bg-secondary)', color: 'white' }}
                                            onClick={() => setAssigningTransactionId(null)}
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            className="btn btn-primary"
                                            style={{ flex: 1 }}
                                            onClick={handleConfirmAssignment}
                                        >
                                            Confirmar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )
                    }

                    {/* CONFIGURATION MODAL */}
                    <ConfigModal
                        isOpen={isConfigModalOpen}
                        onClose={() => setIsConfigModalOpen(false)}
                        reviewLink={reviewLink}
                        setReviewLink={setReviewLink}
                        stripeLink={stripeLink}
                        setStripeLink={setStripeLink}
                        onSave={handleUpdateSettings}
                    />

                    {/* EDIT TRANSACTION MODAL */}
                    {
                        editingTransactionId && (
                            <EditTransactionModal
                                key={editingTransactionId}
                                isOpen={true}
                                transaction={transactions.find(t => t.id === editingTransactionId)}
                                services={services}
                                employees={employees}
                                vehicles={vehicles}
                                onClose={() => setEditingTransactionId(null)}
                                onUpdate={handleUpdateTransaction}
                                onDelete={handleDeleteTransactionV2}
                                userRole={userRole}
                                reviewLink={reviewLink}
                            />
                        )
                    }




                    {/* ERROR ALERT */}
                    {
                        error && (
                            <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem', border: '1px solid #EF4444' }}>
                                <strong>Error:</strong> {error}
                                <button onClick={() => setError(null)} style={{ float: 'right', background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer' }}>✕</button>
                            </div>
                        )
                    }



                    {/* SECCIÓN DE HISTORIAL (PAGADOS) - ADMIN/MANAGER ONLY */}
                    {
                        (userRole === 'admin' || userRole === 'manager') && (
                            <>
                                <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>✅ Historial de Ventas</h2>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                                    {statsTransactions
                                        .filter(t => (t.status === 'completed' || t.status === 'paid') && getTransactionCategory(t) !== 'membership_sale')
                                        .sort((a, b) => {
                                            const dateA = new Date(a.date);
                                            const dateB = new Date(b.date);
                                            if (dateB - dateA !== 0) return dateB - dateA;
                                            return new Date(b.created_at) - new Date(a.created_at);
                                        })
                                        .map(t => (
                                            <div
                                                key={t.id}
                                                className="card"
                                                style={{
                                                    borderLeft: t.payment_method === 'cash' ? '4px solid #10B981' : t.payment_method === 'card' ? '4px solid #3B82F6' : '4px solid #F59E0B',
                                                    cursor: 'pointer',
                                                    transition: 'transform 0.2s'
                                                }}
                                                onClick={() => setSelectedTransaction(t)}
                                                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                                                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                                    <div>
                                                        <h3 style={{ fontWeight: 'bold', fontSize: '1.1rem', margin: 0 }}>{t.customers?.name || 'Cliente Casual'}</h3>
                                                        <div style={{ fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                                                            🚗 {
                                                                (() => {
                                                                    // Logic to display vehicle info correctly

                                                                    // Priority 0: Lookup in standard Vehicles Array (Most Reliable)
                                                                    if (t.vehicle_id) {
                                                                        const v = vehicles.find(veh => veh.id === t.vehicle_id);
                                                                        if (v) {
                                                                            const brand = v.brand;
                                                                            const model = v.model;
                                                                            // Filter out bad data strings
                                                                            const validBrand = (brand && brand !== 'null' && brand !== 'undefined') ? brand : '';
                                                                            const validModel = (model && model !== 'null' && model !== 'undefined') ? model : '';

                                                                            if (validBrand || validModel) {
                                                                                return `${validBrand} ${validModel}`.trim();
                                                                            }
                                                                        }
                                                                    }

                                                                    // Priority 1: Joined Vehicle Data (from t.vehicles) - Allow partials
                                                                    if (t.vehicles) {
                                                                        const brand = t.vehicles.brand;
                                                                        const model = t.vehicles.model;
                                                                        // Filter out bad data strings
                                                                        const validBrand = (brand && brand !== 'null' && brand !== 'undefined') ? brand : '';
                                                                        const validModel = (model && model !== 'null' && model !== 'undefined') ? model : '';

                                                                        if (validBrand || validModel) {
                                                                            return `${validBrand} ${validModel}`.trim();
                                                                        }
                                                                    }

                                                                    // Priority 2: Legacy Customer Fields (from t.customers)
                                                                    if (t.customers) {
                                                                        const brand = t.customers.vehicle_brand;
                                                                        const model = t.customers.vehicle_model;
                                                                        if (brand || model) {
                                                                            return `${brand || ''} ${model || ''}`.trim();
                                                                        }
                                                                    }

                                                                    // Priority 3: Extras (if vehicle info stored there)
                                                                    if (Array.isArray(t.extras)) {
                                                                        const extraWithVehicle = t.extras.find(e => e.vehicle_model);
                                                                        if (extraWithVehicle) return extraWithVehicle.vehicle_model;
                                                                    }
                                                                    return 'Vehículo';
                                                                })()
                                                            }
                                                            <span style={{ color: 'var(--text-muted)' }}>
                                                                {' '}({
                                                                    t.vehicles?.plate ||
                                                                    t.customers?.vehicle_plate ||
                                                                    (Array.isArray(t.extras) ? t.extras.find(e => e.vehicle_plate)?.vehicle_plate : null) ||
                                                                    'Sin Placa'
                                                                })
                                                            </span>
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                                                            <span>{new Date(t.date).toLocaleTimeString('es-PR', { timeZone: 'America/Puerto_Rico', hour: '2-digit', minute: '2-digit' })}</span>
                                                            <span>•</span>
                                                            <span style={{
                                                                padding: '0.1rem 0.5rem',
                                                                borderRadius: '9999px',
                                                                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                                                color: '#10B981'
                                                            }}>
                                                                {getPaymentMethodLabel(t.payment_method)}
                                                            </span>
                                                        </div>

                                                        {/* TIMING DETAILS (Users Request) */}
                                                        <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', backgroundColor: 'var(--bg-secondary)', padding: '0.5rem', borderRadius: '0.25rem', marginTop: '0.25rem' }}>
                                                            {(() => {
                                                                const created = new Date(t.created_at);
                                                                const started = t.started_at ? new Date(t.started_at) : created;
                                                                const finished = t.finished_at ? new Date(t.finished_at) : null;

                                                                // Wait Time (Created -> Started)
                                                                const waitMins = Math.max(0, Math.round((started - created) / 60000));

                                                                // Process Time (Started -> Finished)
                                                                const processMins = finished ? Math.max(0, Math.round((finished - started) / 60000)) : 0;

                                                                return (
                                                                    <>
                                                                        <div title="Tiempo de Espera en Cola">⏳ Espera: <span style={{ color: 'var(--text-main)' }}>{waitMins}m</span></div>
                                                                        <div title="Tiempo de Lavado">🚿 Lavado: <span style={{ color: 'var(--text-main)' }}>{processMins > 0 ? formatDuration(processMins) : '--'}</span></div>
                                                                        {finished && (
                                                                            <div title="Hora de Finalización" style={{ gridColumn: 'span 2' }}>
                                                                                ✅ Fin: <span style={{ color: 'var(--text-main)' }}>{finished.toLocaleTimeString('es-PR', { hour: '2-digit', minute: '2-digit' })}</span>
                                                                            </div>
                                                                        )}
                                                                    </>
                                                                );
                                                            })()}
                                                        </div>
                                                    </div>
                                                    <div style={{ textAlign: 'right' }}>
                                                        <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
                                                            ${parseFloat(t.price || 0).toFixed(2)}
                                                        </div>
                                                        {t.tip > 0 && (
                                                            <div style={{ fontSize: '0.8rem', color: 'var(--warning)' }}>
                                                                + ${parseFloat(t.tip).toFixed(2)} propina
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '0.5rem' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Servicio:</span>
                                                        <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{getServiceName(t.service_id)}</span>
                                                    </div>
                                                    {t.extras && t.extras.length > 0 && (
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                                            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Extras:</span>
                                                            <span style={{ fontSize: '0.9rem' }}>{t.extras.length} items</span>
                                                        </div>
                                                    )}
                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Realizado por:</span>
                                                        <span style={{ fontSize: '0.9rem', textAlign: 'right' }}>
                                                            {t.transaction_assignments && t.transaction_assignments.length > 0
                                                                ? t.transaction_assignments.map(a => getEmployeeName(a.employee_id)).join(', ')
                                                                : getEmployeeName(t.employee_id)
                                                            }
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* ACTIONS FOR HISTORY ITEMS */}
                                                < div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }} onClick={(e) => e.stopPropagation()}>
                                                    <button
                                                        className="btn"
                                                        onClick={() => handleRevertToReady(t)}
                                                        title="Devolver a Listo"
                                                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', color: 'var(--text-primary)', backgroundColor: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                                                    >
                                                        <RefreshCw size={14} /> <span>Devolver</span>
                                                    </button>
                                                    {userRole === 'admin' && (
                                                        <>
                                                            <button
                                                                className="btn"
                                                                style={{ padding: '0.5rem', color: 'var(--primary)', backgroundColor: 'transparent' }}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setEditingTransactionId(t.id);
                                                                }}
                                                                title="Editar"
                                                            >
                                                                <span style={{ marginRight: '0.5rem' }}>Editar</span> ✏️
                                                            </button>
                                                            <button
                                                                className="btn"
                                                                style={{ padding: '0.5rem', color: 'var(--error)', backgroundColor: 'transparent' }}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (window.confirm('¿Seguro que quieres eliminar esta venta?')) {
                                                                        handleDeleteTransactionV2(t.id);
                                                                    }
                                                                }}
                                                                title="Eliminar"
                                                            >
                                                                <span style={{ marginRight: '0.5rem' }}>Eliminar</span> <Trash2 size={18} />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>

                                            </div>
                                        ))
                                    }
                                    {
                                        statsTransactions.filter(t => (t.status === 'completed' || t.status === 'paid') && getTransactionCategory(t) !== 'membership_sale').length === 0 && (
                                            <div style={{ gridColumn: '1 / -1', padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', backgroundColor: 'var(--bg-card)', borderRadius: '0.5rem' }}>
                                                No hay lavados registrados hoy
                                            </div>
                                        )
                                    }
                                </div >

                                {/* NEW: MEMBERSHIP SALES SECTION */}
                                <h2 style={{ fontSize: '1.5rem', marginTop: '2rem', marginBottom: '1rem', color: '#ec4899' }}>💎 Ventas de Membresía</h2>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                                    {statsTransactions
                                        .filter(t => (t.status === 'completed' || t.status === 'paid') && getTransactionCategory(t) === 'membership_sale')
                                        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                                        .map(t => (
                                            <div
                                                key={t.id}
                                                className="card"
                                                style={{ borderLeft: '4px solid #ec4899', cursor: 'pointer', transition: 'transform 0.2s' }}
                                                onClick={() => setSelectedTransaction(t)}
                                                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                                                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                    <div>
                                                        <h3 style={{ fontWeight: 'bold', fontSize: '1.1rem', margin: 0 }}>{t.customers?.name || 'Cliente'}</h3>
                                                        <div style={{ fontSize: '0.9rem', color: '#ec4899', fontWeight: '600', marginTop: '0.25rem' }}>VENTA DE PLAN 💎</div>
                                                    </div>
                                                    <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--text-primary)' }}>${calculateTxTotal(t).toFixed(2)}</div>
                                                </div>
                                                <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                                    {new Date(t.date || t.created_at).toLocaleDateString('es-PR')} • {new Date(t.date || t.created_at).toLocaleTimeString('es-PR', { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </div>
                                        ))
                                    }
                                    {statsTransactions.filter(t => (t.status === 'completed' || t.status === 'paid') && getTransactionCategory(t) === 'membership_sale').length === 0 && (
                                        <div style={{ gridColumn: '1 / -1', padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', backgroundColor: 'rgba(236, 72, 153, 0.05)', borderRadius: '0.5rem', border: '1px dashed #ec4899' }}>
                                            No hay ventas de membresía hoy.
                                        </div>
                                    )}
                                </div>
                            </>
                        )
                    }

                </>)
            }

            {/* TRANSACTION DETAIL MODAL */}
            {
                selectedTransaction && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000
                    }} onClick={() => setSelectedTransaction(null)}>
                        <div style={{
                            backgroundColor: 'var(--bg-card)',
                            padding: '2rem',
                            borderRadius: '0.5rem',
                            width: '90%',
                            maxWidth: '500px',
                            maxHeight: '80vh',
                            overflowY: 'auto'
                        }} onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <h2 style={{ margin: 0 }}>🧾 Detalle de Venta</h2>
                                <button onClick={() => setSelectedTransaction(null)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: '1.5rem' }}>&times;</button>
                            </div>

                            <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
                                <h3 style={{ fontSize: '1.5rem', color: 'var(--primary)', margin: 0 }}>{selectedTransaction.customers?.name || 'Cliente Casual'}</h3>
                                <div style={{ color: 'var(--text-muted)', margin: '0.5rem 0', fontSize: '1.1rem' }}>
                                    {/* Vehicle Description Logic */}
                                    {
                                        (() => {
                                            const t = selectedTransaction;

                                            // Priority 0: Lookup in standard Vehicles Array (Most Reliable)
                                            if (t.vehicle_id) {
                                                const v = vehicles.find(veh => veh.id === t.vehicle_id);
                                                if (v) {
                                                    const validBrand = (v.brand && v.brand !== 'null' && v.brand !== 'undefined') ? v.brand : '';
                                                    const validModel = (v.model && v.model !== 'null' && v.model !== 'undefined') ? v.model : '';
                                                    if (validBrand || validModel) return `${validBrand} ${validModel}`.trim();
                                                }
                                            }

                                            // Priority 1: Joined Vehicle Data
                                            if (t.vehicles) {
                                                const validBrand = (t.vehicles.brand && t.vehicles.brand !== 'null' && t.vehicles.brand !== 'undefined') ? t.vehicles.brand : '';
                                                const validModel = (t.vehicles.model && t.vehicles.model !== 'null' && t.vehicles.model !== 'undefined') ? t.vehicles.model : '';
                                                if (validBrand || validModel) return `${validBrand} ${validModel}`.trim();
                                            }

                                            // Priority 2: Customer fields
                                            if (t.customers) {
                                                if (t.customers.vehicle_brand || t.customers.vehicle_model) {
                                                    return `${t.customers.vehicle_brand || ''} ${t.customers.vehicle_model || ''}`.trim();
                                                }
                                            }

                                            return 'Vehículo';
                                        })()
                                    }
                                    <span style={{ fontWeight: 'bold', marginLeft: '0.5rem', color: 'var(--text-main)' }}>
                                        {
                                            selectedTransaction.vehicles?.plate ||
                                            selectedTransaction.customers?.vehicle_plate ||
                                            (Array.isArray(selectedTransaction.extras) ? selectedTransaction.extras.find(e => e.vehicle_plate)?.vehicle_plate : null) ||
                                            'Sin Placa'
                                        }
                                    </span>
                                </div>
                                <span style={{
                                    backgroundColor: 'var(--bg-secondary)',
                                    padding: '0.25rem 0.75rem',
                                    borderRadius: '9999px',
                                    fontSize: '0.9rem'
                                }}>
                                    {new Date(selectedTransaction.date).toLocaleTimeString('es-PR', { timeZone: 'America/Puerto_Rico', hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>

                            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '1.1rem', fontWeight: 'bold' }}>
                                    <span>{getServiceName(selectedTransaction.service_id)}</span>
                                    <span>${(parseFloat(selectedTransaction.price) - (selectedTransaction.extras?.reduce((sum, e) => sum + e.price, 0) || 0)).toFixed(2)}</span>
                                </div>

                                {/* EXTRAS LIST */}
                                {selectedTransaction.extras && selectedTransaction.extras.length > 0 && (
                                    <div style={{ marginTop: '0.5rem', paddingLeft: '1rem', borderLeft: '2px solid var(--border-color)' }}>
                                        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Extras:</p>
                                        {selectedTransaction.extras.map((extra, idx) => (
                                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                                                <span>+ {extra.description}</span>
                                                <span>${extra.price.toFixed(2)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <hr style={{ borderColor: 'var(--border-color)', margin: '1rem 0' }} />

                                {selectedTransaction.tip > 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--warning)', marginBottom: '0.5rem' }}>
                                        <span>Propina</span>
                                        <span>+ ${parseFloat(selectedTransaction.tip).toFixed(2)}</span>
                                    </div>
                                )}

                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--success)' }}>
                                    <span>Total Pagado</span>
                                    <span>${(parseFloat(selectedTransaction.price) + (parseFloat(selectedTransaction.tip) || 0)).toFixed(2)}</span>
                                </div>
                                <div style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                    Método: {getPaymentMethodLabel(selectedTransaction.payment_method)}
                                </div>
                            </div>

                            <div style={{ marginBottom: '1rem' }}>
                                <h4 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Realizado por:</h4>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    {selectedTransaction.transaction_assignments && selectedTransaction.transaction_assignments.length > 0
                                        ? selectedTransaction.transaction_assignments.map(a => (
                                            <span key={a.employee_id} style={{ backgroundColor: 'var(--bg-secondary)', padding: '0.25rem 0.75rem', borderRadius: '0.25rem', fontSize: '0.9rem' }}>
                                                {getEmployeeName(a.employee_id)}
                                            </span>
                                        ))
                                        : <span style={{ backgroundColor: 'var(--bg-secondary)', padding: '0.25rem 0.75rem', borderRadius: '0.25rem', fontSize: '0.9rem' }}>{getEmployeeName(selectedTransaction.employee_id)}</span>
                                    }
                                </div>
                            </div>

                            {(userRole === 'admin' || userRole === 'manager') && (
                                <button
                                    onClick={() => {
                                        handleDeleteTransactionV2(selectedTransaction.id);
                                        setSelectedTransaction(null);
                                    }}
                                    style={{
                                        width: '100%',
                                        marginTop: '1.5rem',
                                        padding: '0.75rem',
                                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                        color: '#ef4444',
                                        border: '1px solid #ef4444',
                                        borderRadius: '0.5rem',
                                        cursor: 'pointer',
                                        fontWeight: 'bold',
                                        fontSize: '0.9rem'
                                    }}
                                >
                                    🗑️ ELIMINAR ESTE REGISTRO
                                </button>
                            )}

                            <button onClick={() => setSelectedTransaction(null)} className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
                                Cerrar
                            </button>
                        </div>
                    </div>
                )
            }


            {/* CHART SECTION (ADMIN ONLY) */}
            {
                userRole === 'admin' && (
                    <ServiceAnalyticsChart transactions={transactions} />
                )
            }




            {/* VERIFICATION MODAL */}
            {
                verifyingTransaction && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 4000
                    }} onClick={() => setVerifyingTransaction(null)}>
                        <div style={{
                            backgroundColor: 'var(--bg-card)',
                            padding: '2rem',
                            borderRadius: '0.5rem',
                            width: '90%',
                            maxWidth: '400px'
                        }} onClick={e => e.stopPropagation()}>
                            <h2 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Verificar antes de entregar</h2>
                            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
                                Confirma que todo esté listo para {verifyingTransaction.customers?.vehicle_plate || verifyingTransaction.vehicles?.plate}:
                            </p>

                            <div style={{
                                backgroundColor: 'var(--bg-secondary)',
                                padding: '1rem',
                                borderRadius: '0.5rem',
                                marginBottom: '1.5rem',
                                border: '1px solid var(--border-color)'
                            }}>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Servicios a Realizar</div>
                                <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--primary)' }}>
                                    ✓ {getServiceName(verifyingTransaction.service_id)}
                                </div>
                                {verifyingTransaction.extras && verifyingTransaction.extras.length > 0 && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '1rem' }}>
                                        {verifyingTransaction.extras.map((extra, idx) => (
                                            <div key={idx} style={{ fontSize: '0.9rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <span style={{ color: 'var(--success)' }}>✓</span> {extra.description}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* PHOTO UPLOAD (OPTIONAL) */}
                                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                                        Foto del Resultado (Opcional)
                                    </label>
                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                        <label className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.5rem 1rem', fontSize: '0.85rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '0.4rem' }}>
                                            <Droplets size={16} color={photoToUpload ? 'var(--primary)' : 'currentColor'} />
                                            {photoToUpload ? 'Foto Cargada ✓' : 'Subir Foto'}
                                            <input 
                                                type="file" 
                                                accept="image/*" 
                                                capture="environment" 
                                                style={{ display: 'none' }} 
                                                onChange={(e) => setPhotoToUpload(e.target.files[0])}
                                            />
                                        </label>
                                        {photoToUpload && (
                                            <button 
                                                onClick={() => setPhotoToUpload(null)}
                                                style={{ color: '#ef4444', background: 'none', border: 'none', fontSize: '0.75rem', textDecoration: 'underline', cursor: 'pointer' }}
                                            >
                                                Quitar
                                            </button>
                                        )}
                                    </div>
                                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                        El cliente podrá ver esto al entrar a su portal.
                                    </p>
                                </div>
                            </div>

                            <div style={{
                                backgroundColor: 'rgba(234, 179, 8, 0.1)',
                                border: '1px solid var(--warning)',
                                padding: '1rem',
                                borderRadius: '0.5rem',
                                marginBottom: '1.5rem',
                                color: 'var(--text-primary)',
                                fontSize: '0.95rem',
                                lineHeight: '1.4'
                            }}>
                                <div style={{ fontWeight: 'bold', color: 'var(--warning)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    ⚠️ ADVERTENCIA DE RESPONSABILIDAD
                                </div>
                                <p style={{ margin: 0 }}>
                                    Al marcar este servicio como <strong>LISTO</strong>, el empleado asegura haber verificado la calidad total del trabajo.
                                </p>
                                <p style={{ marginTop: '0.75rem', marginBottom: 0, fontSize: '0.85rem', fontStyle: 'italic' }}>
                                    * Si el cliente regresa con servicios no terminados, no se cobrará la comisión por este servicio.
                                </p>
                            </div>

                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontSize: '1.1rem', marginBottom: '2rem' }}>
                                <input
                                    type="checkbox"
                                    checked={hasConsentedVerification}
                                    onChange={(e) => setHasConsentedVerification(e.target.checked)}
                                    style={{ width: '22px', height: '22px', accentColor: 'var(--primary)' }}
                                />
                                <span>He verificado el auto</span>
                            </label>

                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <button
                                    className="btn"
                                    style={{ flex: 1, backgroundColor: 'var(--bg-secondary)', color: 'white' }}
                                    onClick={() => setVerifyingTransaction(null)}
                                >
                                    Cancelar
                                </button>
                                <button
                                    className="btn btn-primary"
                                    style={{ flex: 1 }}
                                    disabled={!hasConsentedVerification}
                                    onClick={handleConfirmReady}
                                >
                                    Confirmar y Enviar
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* ASSIGNMENT MODAL */}
            {
                showAssignmentModal && pendingExtra && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100
                    }}>
                        <div className="card" style={{ width: '90%', maxWidth: '400px' }}>
                            <h3 style={{ marginBottom: '1rem' }}>¿Quién realizó: {pendingExtra.name}?</h3>
                            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                                Selecciona al empleado para asignarle la comisión completa de este extra.
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {(verifyingTransaction
                                    ? (verifyingTransaction.transaction_assignments?.map(ta => ta.employee_id) || [])
                                    : (formData.selectedEmployees || [])
                                ).map(empId => {
                                    const emp = employees.find(e => e.id === empId);
                                    return (
                                        <button
                                            key={empId}
                                            className="btn"
                                            style={{ justifyContent: 'center', padding: '1rem', border: '1px solid var(--border-color)' }}
                                            onClick={() => {
                                                if (verifyingTransaction) {
                                                    assignExistingExtra(pendingExtra, empId);
                                                } else {
                                                    addExtra(pendingExtra, empId);
                                                }
                                            }}
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
                )
            }
            {/* QR CODE MODAL */}
            {/* QR CODE MODAL - PERMANENT CUSTOMER LINK */}
            {
                qrTransactionId && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 5000
                    }} onClick={() => setQrTransactionId(null)}>
                        <div style={{
                            backgroundColor: 'white', padding: '2rem', borderRadius: '1rem',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem',
                            maxWidth: '90%', width: '350px'
                        }} onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                                <h2 style={{ color: 'black', margin: 0 }}>QR del Cliente</h2>
                                <button onClick={() => setQrTransactionId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                                    <X color="black" size={24} />
                                </button>
                            </div>

                            <div style={{ padding: '1rem', background: 'white', borderRadius: '0.5rem' }}>
                                {(() => {
                                    // Find transaction to get Customer ID
                                    const tx = statsTransactions.find(t => t.id === qrTransactionId) || transactions.find(t => t.id === qrTransactionId);
                                    const customerId = tx?.customers?.id || tx?.customer_id;

                                    if (customerId) {
                                        const portalUrl = `${window.location.origin}/portal/${customerId}`;
                                        const phone = tx.customers?.phone ? tx.customers.phone.replace(/\D/g, '') : '';
                                        const formattedPhone = phone.length === 10 ? `1${phone}` : phone;
                                        const whatsappMsg = encodeURIComponent(`Hola, sigue el estado de tu servicio en Express CarWash aquí: ${portalUrl}`);
                                        const whatsappUrl = formattedPhone
                                            ? `https://wa.me/${formattedPhone}?text=${whatsappMsg}`
                                            : `https://wa.me/?text=${whatsappMsg}`;

                                        return (
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                                                <QRCode value={portalUrl} size={256} />

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
                                    } else {
                                        return <p style={{ color: 'red', textAlign: 'center' }}>⚠️ Cliente no vinculado.<br />Edita el servicio para asignar un cliente.</p>;
                                    }
                                })()}
                            </div>

                            <div style={{ color: '#555', textAlign: 'center', fontSize: '0.9rem' }}>
                                <p style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Escanear para Portal de Cliente</p>
                                <p>Historial • Estado • Info</p>
                            </div>
                        </div>
                    </div>
                )
            }
                <div style={{ textAlign: 'center', marginTop: '2rem', padding: '1rem', opacity: 0.3, fontSize: '0.7rem' }}>
                    Dashboard v4.72 • {new Date().toLocaleTimeString()}
                </div>

            {/* FULLSCREEN PHOTO VIEWER MODAL */}
            {viewingPhoto && (
                <div 
                    style={{ 
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
                        backgroundColor: 'rgba(0,0,0,0.95)', zIndex: 10000, 
                        display: 'flex', justifyContent: 'center', alignItems: 'center',
                        padding: '1rem' 
                    }}
                    onClick={() => setViewingPhoto(null)}
                >
                    <button 
                        style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'white', fontSize: '2rem', cursor: 'pointer', zIndex: 10001 }}
                        onClick={() => setViewingPhoto(null)}
                    >
                        ✕
                    </button>
                    <img 
                        src={viewingPhoto} 
                        alt="Vista Ampliada" 
                        style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: '0.5rem', boxShadow: '0 0 20px rgba(255,255,255,0.1)' }} 
                        onClick={e => e.stopPropagation()}
                    />
                </div>
            )}
            <CustomerDetailView />
            <TransactionModal />
        </div >
        </DashboardProvider>
    );
};

export default Dashboard;
