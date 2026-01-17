import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';
import { Plus, Car, DollarSign, Users, Trash2, Edit2, Clock, RefreshCw, Loader2, CheckCircle, Play, Send, Droplets, MessageCircle, Settings, MessageSquare, X, Star, QrCode } from 'lucide-react';
import useSupabase from '../hooks/useSupabase';
import ProductivityBar from '../components/ProductivityBar';
import ServiceAnalyticsChart from '../components/ServiceAnalyticsChart';
import EmployeeProductivityChart from '../components/EmployeeProductivityChart';
import EditTransactionModal from '../components/EditTransactionModal';
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

    const [dateFilter, setDateFilter] = useState('today'); // 'today', 'manual', 'range'
    const [dateRange, setDateRange] = useState({
        start: new Date().toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });

    // Notes State
    const [dailyNotes, setDailyNotes] = useState([]);
    const [newNote, setNewNote] = useState('');
    const [showNotes, setShowNotes] = useState(false); // Default CLOSED

    useEffect(() => {
        const fetchNotes = async () => {
            const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Puerto_Rico' });
            const { data } = await supabase
                .from('daily_notes')
                .select('*')
                .eq('date', today)
                .order('created_at', { ascending: true });
            if (data) setDailyNotes(data);
        };
        fetchNotes();

        // Realtime subscription for notes
        const channel = supabase
            .channel('daily_notes_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_notes' }, () => {
                fetchNotes();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const handleAddNote = async () => {
        if (!newNote.trim()) return;
        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Puerto_Rico' });

        // Get employee name for attribution
        let authorName = 'Empleado';
        if (myEmployeeId) {
            const me = employees.find(e => e.id === myEmployeeId);
            if (me) authorName = me.name || me.first_name;
        }

        const contentWithAuthor = `${authorName}: ${newNote}`;

        const { error } = await supabase.from('daily_notes').insert([
            { content: contentWithAuthor, date: today }
        ]);

        if (!error) setNewNote('');
    };

    // REFACTOR: Store ID only, not the whole object
    const [editingTransactionId, setEditingTransactionId] = useState(null); // Nuevo: ID del perfil de empleado
    const [userRole, setUserRole] = useState(null); // Estado para el rol
    const [isRefreshing, setIsRefreshing] = useState(false); // Estado para el botón de refresh
    const [isModalOpen, setIsModalOpen] = useState(false); // Estado para el modal de nueva transacción
    const [alertedTransactions, setAlertedTransactions] = useState(new Set()); // Para evitar alertas repetidas
    const [feedbacks, setFeedbacks] = useState([]); // Nuevo: Estado para las reseñas privadas
    const [qrTransactionId, setQrTransactionId] = useState(null); // ID para mostrar modal QR

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
                }
            }
        };
        getUser();
    }, []);

    const { data: servicesData } = useSupabase('services');
    const services = servicesData || [];

    const { data: employeesData } = useSupabase('employees');
    const employees = employeesData || [];

    const { data: customersData, update: updateCustomer, refresh: refreshCustomers } = useSupabase('customers');
    const customers = customersData || [];

    const { data: vehiclesData, create: createVehicle, refresh: refreshVehicles } = useSupabase('vehicles');
    const vehicles = vehiclesData || [];

    const { data: transactionsData, create: createTransaction, update: updateTransaction, remove: removeTransaction, refresh: refreshTransactions } = useSupabase('transactions', `*, customers(name, phone), vehicles(plate, model, brand), transaction_assignments(employee_id)`, { orderBy: { column: 'date', ascending: false } });
    const transactions = transactionsData || [];

    // Auto-refresh transactions every 2 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            refreshTransactions();
        }, 2000);
        return () => clearInterval(interval);
    }, [refreshTransactions]);

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
    const [verificationChecks, setVerificationChecks] = useState({
        cristales: false,
        entrePuertas: false,
        baul: false,
        dash: false,
        portaVasos: false,
        manchas: false
    });

    const handleOpenVerification = (transaction) => {
        setVerifyingTransaction(transaction);
        setVerificationChecks({
            cristales: false,
            entrePuertas: false,
            baul: false,
            dash: false,
            portaVasos: false,
            manchas: false
        });
    };

    const handleConfirmReady = async () => {
        const transaction = verifyingTransaction;
        if (!transaction) return;

        // CHECK FOR UNASSIGNED EXTRAS
        const assignedCount = transaction.transaction_assignments?.length || 0;
        const unassignedExtras = transaction.extras?.filter(e => !e.assignedTo) || [];

        if (assignedCount > 1 && unassignedExtras.length > 0) {
            setPendingExtra(unassignedExtras[0]);
            setShowAssignmentModal(true);
            return;
        }

        if (!transaction.customers?.phone) {
            alert('Este cliente no tiene número de teléfono registrado.');
            return;
        }

        const phone = transaction.customers.phone.replace(/\D/g, '');
        if (!phone) {
            alert('Número de teléfono inválido.');
            return;
        }

        // Update status to 'ready'
        try {
            await updateTransaction(transaction.id, {
                status: 'ready',
                finished_at: new Date().toISOString()
            });

            // [LOYALTY] Award Point
            if (transaction.customer_id) {
                const { data: customer } = await supabase.from('customers').select('points').eq('id', transaction.customer_id).single();
                if (customer) {
                    await supabase.from('customers').update({ points: (customer.points || 0) + 1 }).eq('id', transaction.customer_id);
                }
            }

            await refreshTransactions();
            setVerifyingTransaction(null); // Close modal
        } catch (error) {
            console.error('Error updating status:', error);
            alert('Error al actualizar estado.');
            return;
        }

        const customerName = transaction.customers.name.split(' ')[0]; // First name
        const vehicle = `${transaction.vehicles?.plate || transaction.customers?.vehicle_plate || ''} (${transaction.vehicles?.model || transaction.customers?.vehicle_model || ''})`;

        // Calculate Total
        const extrasTotal = transaction.extras?.reduce((sum, e) => sum + e.price, 0) || 0;
        const totalToPay = (parseFloat(transaction.price) + extrasTotal).toFixed(2);
        const serviceName = getServiceName(transaction.service_id);

        const portalLink = `${window.location.origin}/portal/${transaction.customer_id}`;

        const message = `Hola ${customerName}, su vehículo ${vehicle} ya está listo. 🚗✨\n\n🧾 *Resumen de Cuenta:*\nServicio: ${serviceName}\nTotal a Pagar: $${totalToPay}\n\n💳 *Métodos de Pago:*\n1. 📱 *ATH Móvil:* 787-857-8983\n2. 💵 *Efectivo* al recoger.\n\n📲 *Ver Link de Pago y Calificar:*\n${portalLink}\n\n*Propina es bien recibida por nuestro equipo.* 🤝\n\n¡Lo esperamos!`;

        // Use api.whatsapp.com for better compatibility
        const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;

        // Revert to location.href to avoid popup blockers and ensure mobile app trigger
        window.location.href = url;
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

    // HELPER FUNCTIONS (Moved to top to avoid ReferenceError)
    const getCustomerName = (id) => customers.find(c => c.id === id)?.name || 'Cliente Casual';
    const getServiceName = (id) => services.find(s => s.id === id)?.name || 'Servicio Desconocido';
    const getEmployeeName = (id) => employees.find(e => e.id === id)?.name || 'Desconocido';
    const [activeDetailModal, setActiveDetailModal] = useState(null); // 'cars', 'income', 'commissions'
    const [selectedTransaction, setSelectedTransaction] = useState(null); // For detailed view of a specific transaction
    const [debugInfo, setDebugInfo] = useState(""); // DEBUG STATE
    const [error, setError] = useState(null); // FIX: Restore error state
    const [isSubmitting, setIsSubmitting] = useState(false); // Prevent double clicks

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
        extras: [] // Initialize extras
    });

    // PRODUCTIVITY FEATURES STATE
    const [vipInfo, setVipInfo] = useState(null);
    const [lastService, setLastService] = useState(null);

    const [canRedeemPoints, setCanRedeemPoints] = useState(false); // Loyalty State
    const [isRedemption, setIsRedemption] = useState(false); // Loyalty State
    const [customerMembership, setCustomerMembership] = useState(null);
    const [isMembershipUsage, setIsMembershipUsage] = useState(false);

    const handleCustomerSelect = async (customerId) => {
        if (!customerId) {
            setVipInfo(null);
            setLastService(null);
            setCanRedeemPoints(false);
            setCustomerMembership(null);
            setIsMembershipUsage(false);
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

        // 3. Loyalty Points Check
        const customer = customers.find(c => c.id == customerId);
        if (customer && (customer.points || 0) >= 10) {
            setCanRedeemPoints(true);
        } else {
            setCanRedeemPoints(false);
        }

        // 4. Membership Check
        const { data: memberSub } = await supabase
            .from('customer_memberships')
            .select('*, memberships(*)')
            .eq('customer_id', customerId)
            .eq('status', 'active')
            .single();

        if (memberSub) {
            setCustomerMembership(memberSub);
            // Auto-check if it's unlimited or has washes left
            if (memberSub.memberships.type === 'unlimited' || (memberSub.usage_count < memberSub.memberships.wash_limit)) {
                // We could auto-enable it, but better let users choose
            }
        } else {
            setCustomerMembership(null);
            setIsMembershipUsage(false);
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
        email: '' // Optional
    });

    // ASSIGNMENT MODAL STATE (Missing in previous deploy)
    const [assigningTransactionId, setAssigningTransactionId] = useState(null);
    const [selectedEmployeesForAssignment, setSelectedEmployeesForAssignment] = useState([]);

    const handleStartService = (txId) => {
        setAssigningTransactionId(txId);
        setSelectedEmployeesForAssignment([]); // Reset selection
    };

    const handleConfirmAssignment = async () => {
        if (selectedEmployeesForAssignment.length === 0) {
            alert("Selecciona al menos un empleado.");
            return;
        }

        const tx = transactions.find(t => t.id === assigningTransactionId);
        if (!tx) return;

        try {
            // 1. Create Assignments
            const assignments = selectedEmployeesForAssignment.map(empId => ({
                transaction_id: tx.id,
                employee_id: empId
            }));

            const { error: assignError } = await supabase
                .from('transaction_assignments')
                .insert(assignments);

            if (assignError) throw assignError;

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
        const cleanPhone = newCustomer.phone.replace(/\D/g, '');

        try {
            // 1. Check if customer exists by phone OR name (if phone empty)
            let existingCustomer = null;
            if (cleanPhone) {
                existingCustomer = customers.find(c => c.phone && c.phone.replace(/\D/g, '') === cleanPhone);
            }

            // If not found by phone, try by name (exact match)
            if (!existingCustomer) {
                existingCustomer = customers.find(c => c.name.trim().toLowerCase() === newCustomer.name.trim().toLowerCase());
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
                setNewCustomer({ name: '', phone: '', vehicle_plate: '', vehicle_brand: '', vehicle_model: '', email: '' });
                return;
            }

            // 4. Truly New Customer
            const [created] = await createCustomer({
                name: newCustomer.name,
                phone: cleanPhone,
                email: newCustomer.email
            });

            if (created) {
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
                setNewCustomer({ name: '', phone: '', vehicle_plate: '', vehicle_brand: '', vehicle_model: '', email: '' });
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

    // Filter transactions
    const filteredTransactions = transactions.filter(t => {
        const txDateLocal = getPRDateString(t.date);
        const isActive = t.status === 'waiting' || t.status === 'in_progress' || t.status === 'ready';

        if (dateFilter === 'today') {
            const today = getPRDateString(new Date());
            return txDateLocal === today || isActive;
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

    // --- NOTIFICATIONS LOGIC (Moved here to access statsTransactions) ---
    useEffect(() => {
        if (!userRole || userRole !== 'admin') return;

        // 1. REALTIME LISTENER FOR NEW SERVICES
        const channel = supabase
            .channel('public:transactions')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions' }, (payload) => {
                console.log('New transaction received:', payload);
                playNewServiceSound();
                refreshTransactions(); // Auto-refresh list
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
        .filter(t => t.status === 'completed' || t.status === 'paid')
        .reduce((sum, t) => sum + (parseFloat(t.price) || 0), 0);

    // Calcular comisiones basado en el rol (Admin ve total, Empleado ve suyo)
    const totalCommissions = statsTransactions.reduce((sum, t) => {
        // SOLO contar comisiones si el servicio está COMPLETADO o PAGADO
        if (t.status !== 'completed' && t.status !== 'paid') return sum;

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

    // GAMIFICATION CALCULATIONS
    // 1. Daily Count: Already filtered in 'myTransactions' (todaysTransactions for Admin, myTransactions for Employee)
    // For the bar, we want to show the specific employee's progress. If Admin, maybe show global? Let's show personal for now.
    // FIX: Exclude 'waiting' from productivity count
    const dailyProductivityCount = myTransactions.filter(t => t.status !== 'waiting').length;

    // 2. Total XP (Lifetime Cars)
    const [totalXp, setTotalXp] = useState(0);
    const [dailyTarget, setDailyTarget] = useState(10); // Default 10
    const [reviewLink, setReviewLink] = useState(''); // Review link setting
    const [stripeLink, setStripeLink] = useState(''); // Stripe payment link
    const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

    useEffect(() => {
        const fetchXpAndSettings = async () => {
            // Fetch Settings
            const { data: settingsData } = await supabase
                .from('settings')
                .select('key, value');

            if (settingsData) {
                const target = settingsData.find(s => s.key === 'daily_target');
                if (target) setDailyTarget(parseInt(target.value, 10) || 10);

                const link = settingsData.find(s => s.key === 'review_link');
                if (link) setReviewLink(link.value);

                const sLink = settingsData.find(s => s.key === 'stripe_link');
                if (sLink) setStripeLink(sLink.value);
            }

            if (myEmployeeId) {
                // Count assignments (Source of Truth for XP)
                const { count, error } = await supabase
                    .from('transaction_assignments')
                    .select('*', { count: 'exact', head: true })
                    .eq('employee_id', myEmployeeId);

                if (!error) {
                    setTotalXp(count || 0);
                }
            }
        };
        fetchXpAndSettings();
    }, [myEmployeeId, transactions]); // Re-fetch when transactions change

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

    const handleUpdateSettings = async (updates) => {
        if (userRole !== 'admin' && userRole !== 'manager') return;

        try {
            const upserts = Object.entries(updates).map(([key, value]) => ({
                key,
                value: value.toString()
            }));

            const { error } = await supabase
                .from('settings')
                .upsert(upserts);

            if (error) throw error;

            if (updates.daily_target !== undefined) setDailyTarget(parseInt(updates.daily_target));
            if (updates.review_link !== undefined) setReviewLink(updates.review_link);
            if (updates.stripe_link !== undefined) setStripeLink(updates.stripe_link);

            return { success: true };
        } catch (error) {
            console.error('Error updating settings:', error);
            alert('Error al actualizar: ' + error.message);
            return { success: false };
        }
    };

    const handleServiceChange = (e) => {
        const serviceId = e.target.value;
        const service = services.find(s => s.id === serviceId);
        if (service) {
            const extrasTotal = (formData.extras || []).reduce((sum, ex) => sum + ex.price, 0);
            setFormData({
                ...formData,
                serviceId,
                price: service.price + extrasTotal,
                commissionAmount: service.commission || 0 // Use fixed commission
            });
        } else {
            setFormData({ ...formData, serviceId: '', price: '', commissionAmount: '' });
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

            // Logic: Set finished_at ONLY if it's finishing AND we don't have a time yet
            // (or if we want to overwrite 'ready' with 'completed' time? No, usually Ready time is the wash end)
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
        if (!formData.serviceId || formData.serviceId === '') {
            alert('Por favor selecciona un servicio.');
            return;
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
            price: isMembershipUsage ? 0 : basePrice,
            commission_amount: (parseFloat(formData.commissionAmount) || 0) + (formData.extras || []).reduce((sum, ex) => sum + (parseFloat(ex.commission) || 0), 0),
            tip: 0,
            payment_method: isMembershipUsage ? 'membership' : 'cash',
            extras: isMembershipUsage ? [...(formData.extras || []), { description: `Membresía: ${customerMembership.memberships.name}`, price: 0 }] : (formData.extras || []),

            status: 'waiting', // Initial Status
            total_price: basePrice // REQUIRED by DB constraint
        };

        try {
            // SAFETY NET: If vehicle_id is missing, try to find it one last time
            if (!newTransaction.vehicle_id && newTransaction.customer_id) {
                const foundVehicle = vehicles.find(v => v.customer_id == newTransaction.customer_id);
                if (foundVehicle) {
                    newTransaction.vehicle_id = foundVehicle.id;
                }
            }

            // [LOYALTY] Deduct Points
            if (isRedemption) {
                const { data: customer } = await supabase.from('customers').select('points').eq('id', formData.customerId).single();
                if (customer) {
                    await supabase.from('customers').update({ points: Math.max(0, (customer.points || 0) - 10) }).eq('id', formData.customerId);
                }
            }

            // [MEMBERSHIP] Increment Usage
            if (isMembershipUsage && customerMembership) {
                await supabase.from('customer_memberships')
                    .update({ usage_count: (customerMembership.usage_count || 0) + 1 })
                    .eq('id', customerMembership.id);
            }

            setIsSubmitting(true); // Disable button
            await createTransaction(newTransaction);

            setIsModalOpen(false);
            setIsSubmitting(false);
            setIsRedemption(false); // Reset Loyalty State
            setIsMembershipUsage(false);
            setCustomerMembership(null);
            setFormData({
                customerId: '',
                vehicleId: '',
                serviceId: '',
                employeeId: '',
                selectedEmployees: [],
                price: '',
                commissionAmount: '',
                serviceTime: new Date().toTimeString().slice(0, 5),
                extras: []
            });
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
            const assignmentCount = t.transaction_assignments?.length || 1;
            return sum + (1 / assignmentCount);
        }, 0);

    console.log("VERSION 3.7 NUCLEAR LOADED");
    return (
        <div>
            {/* HEADER */}
            <div className="dashboard-header" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '0.5rem' }}>
                        <img src="/logo.jpg" alt="Logo" style={{ width: '50px', height: '50px', borderRadius: '12px', objectFit: 'cover', border: '2px solid white' }} />
                        <h1 style={{ fontSize: '1.875rem', margin: 0 }}>Dashboard</h1>
                        <span style={{ fontSize: '0.8rem', color: 'white', backgroundColor: '#6366f1', border: '1px solid white', padding: '0.2rem 0.5rem', borderRadius: '4px', boxShadow: '0 0 10px #6366f1' }}>
                            v4.61
                        </span>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                    {/* AUDIO UNLOCK */}
                    {userRole === 'admin' && (
                        <button
                            className="btn"
                            onClick={async () => {
                                await unlockAudio();
                                alert("🔊 Audio activado.");
                            }}
                            style={{
                                backgroundColor: 'var(--warning)',
                                color: 'black',
                                fontWeight: 'bold',
                                fontSize: '0.8rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                padding: '0.3rem 0.6rem',
                                border: 'none',
                                borderRadius: '0.25rem'
                            }}
                        >
                            🔔 Sonido
                        </button>
                    )}

                    {/* NOTES TOGGLE - HIDDEN FOR EMPLOYEES (Now in Grid) */}
                    {(userRole === 'admin' || userRole === 'manager') && (
                        <button
                            onClick={() => setShowNotes(!showNotes)}
                            className="btn"
                            style={{
                                backgroundColor: 'var(--bg-secondary)',
                                border: '1px solid var(--border-color)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                padding: '0.3rem 0.6rem',
                                fontSize: '0.8rem',
                                cursor: 'pointer',
                                borderRadius: '0.25rem'
                            }}
                        >
                            <span>📝 Notas ({dailyNotes.length})</span>
                            <span style={{ transform: showNotes ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', marginLeft: 'auto' }}>▼</span>
                        </button>
                    )}

                    {/* WHATSAPP SELF-REPORT BUTTON (PDF) */}
                    {userRole === 'admin' && (
                        <button
                            onClick={() => setIsConfigModalOpen(true)}
                            className="btn"
                            style={{
                                backgroundColor: '#6366f1',
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                padding: '0.3rem 0.6rem',
                                fontSize: '0.8rem',
                                cursor: 'pointer',
                                borderRadius: '0.25rem',
                                fontWeight: 'bold'
                            }}
                        >
                            <Settings size={16} />
                            <span>Configuración</span>
                        </button>
                    )}
                    {userRole === 'admin' && (
                        <button
                            className="btn"
                            onClick={async () => {
                                try {
                                    // 1. Gather Data
                                    const todayDate = new Date().toLocaleDateString('es-PR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

                                    const completedTxs = statsTransactions.filter(t => t.status === 'completed' || t.status === 'paid');
                                    const count = completedTxs.length;

                                    const incomeCash = completedTxs
                                        .filter(t => t.payment_method === 'cash')
                                        .reduce((sum, t) => sum + (parseFloat(t.price) || 0), 0);

                                    const incomeTransfer = completedTxs
                                        .filter(t => t.payment_method === 'transfer')
                                        .reduce((sum, t) => sum + (parseFloat(t.price) || 0), 0);

                                    const totalIncome = incomeCash + incomeTransfer;

                                    const totalTips = completedTxs.reduce((sum, t) => sum + (parseFloat(t.tip) || 0), 0);
                                    const totalCommissions = completedTxs.reduce((sum, t) => sum + (parseFloat(t.commission_amount) || 0), 0);

                                    const expensesProduct = expenses
                                        .filter(e => {
                                            const eDate = getPRDateString(e.date);
                                            const today = getPRDateString(new Date());
                                            return eDate === today && e.category === 'product';
                                        })
                                        .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

                                    const expensesLunch = expenses
                                        .filter(e => {
                                            const eDate = getPRDateString(e.date);
                                            const today = getPRDateString(new Date());
                                            return eDate === today && e.category === 'lunch';
                                        })
                                        .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

                                    const totalExpenses = totalCommissions + totalTips + expensesProduct + expensesLunch;
                                    const netProfit = totalIncome - totalExpenses; // Note: Tips are expense if excluded from income, but usually income includes tips? Check t.price vs t.tip logic. 
                                    // Normally price is base price. Tip is extra. 
                                    // If totalIncome = sum(price), then tips are not in income. 
                                    // But we pay tips out. So tips are flow-through. 
                                    // Let's assume Net = Income - (Commissions + Tips + Expenses).

                                    // 2. Generate PDF
                                    const doc = new jsPDF();

                                    // Header
                                    doc.setFillColor(37, 99, 235); // Blue
                                    doc.rect(0, 0, 210, 40, 'F');
                                    doc.setTextColor(255, 255, 255);
                                    doc.setFontSize(22);
                                    doc.text("Reporte Diario Detallado", 105, 20, { align: 'center' });
                                    doc.setFontSize(12);
                                    doc.text(todayDate.toUpperCase(), 105, 30, { align: 'center' });

                                    // 2.1 FINANZAS
                                    autoTable(doc, {
                                        startY: 50,
                                        head: [['Concepto', 'Monto']],
                                        body: [
                                            ['Autos Lavados', count.toString()],
                                            ['', ''], // Spacer
                                            ['Ingresos (Efecivo)', `$${incomeCash.toFixed(2)}`],
                                            ['Ingresos (ATH Móvil)', `$${incomeTransfer.toFixed(2)}`],
                                            ['INGRESOS TOTALES', `$${totalIncome.toFixed(2)}`],
                                            ['', ''], // Spacer
                                            ['Comisiones Pagadas', `$${totalCommissions.toFixed(2)}`],
                                            ['Propinas Pagadas', `$${totalTips.toFixed(2)}`],
                                            ['Almuerzos (Gastos)', `$${expensesLunch.toFixed(2)}`],
                                            ['Compras (Gastos)', `$${expensesProduct.toFixed(2)}`],
                                            ['GASTOS TOTALES', `$${totalExpenses.toFixed(2)}`],
                                            ['', ''], // Spacer
                                            ['GANANCIA NETA', `$${netProfit.toFixed(2)}`]
                                        ],
                                        theme: 'grid',
                                        headStyles: { fillColor: [37, 99, 235] },
                                        columnStyles: {
                                            0: { fontStyle: 'bold' },
                                            1: { halign: 'right' }
                                        }
                                    });

                                    // 2.2 EMPLEADOS (Comisiones)
                                    // Fetch employees directly to ensure data is fresh
                                    const { data: empData, error: empError } = await supabase.from('employees').select('*');
                                    const employeesList = empData || employees; // Fallback to state if fetch fails
                                    if (empError) console.error("Error fetching employees for PDF:", empError);

                                    // Calculate per employee
                                    const empStats = {};
                                    completedTxs.forEach(t => {
                                        const assignments = t.transaction_assignments?.length > 0 ? t.transaction_assignments : [{ employee_id: t.employee_id }];
                                        const count = assignments.length;
                                        const shareComm = (parseFloat(t.commission_amount) || 0) / count;
                                        const shareTip = (parseFloat(t.tip) || 0) / count;

                                        assignments.forEach(a => {
                                            const eid = a.employee_id;
                                            if (!eid) return; // Skip if no ID
                                            if (!empStats[eid]) empStats[eid] = { comm: 0, tips: 0 };
                                            empStats[eid].comm += shareComm;
                                            empStats[eid].tips += shareTip;
                                        });
                                    });

                                    // Debug matching
                                    console.log("PDF Stats Keys:", Object.keys(empStats));
                                    console.log("PDF Employees:", employeesList.map(e => ({ id: e.id, name: e.first_name })));

                                    const empBody = Object.entries(empStats).map(([eid, stats]) => {
                                        const emp = employeesList.find(e => String(e.id) === String(eid));
                                        const name = emp ? (emp.name || emp.first_name || `Emple. ${eid}`) : `ID: ${eid}`; // Use 'name' as primary, fallback to old fields
                                        return [name, `$${stats.comm.toFixed(2)}`, `$${stats.tips.toFixed(2)}`, `$${(stats.comm + stats.tips).toFixed(2)}`];
                                    });

                                    doc.text("Desglose por Empleado", 14, doc.lastAutoTable.finalY + 15);
                                    autoTable(doc, {
                                        startY: doc.lastAutoTable.finalY + 20,
                                        head: [['Empleado', 'Comisión', 'Propina', 'Total']],
                                        body: empBody,
                                        theme: 'striped',
                                        headStyles: { fillColor: [16, 185, 129] } // Green
                                    });

                                    // 2.3 DETALLE DE AUTOS
                                    const txBody = completedTxs.map(t => {
                                        const time = new Date(t.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                        const brand = t.vehicles?.brand && t.vehicles.brand !== 'null' ? t.vehicles.brand : '';
                                        const model = t.vehicles?.model || t.customers?.vehicle_model || (t.extras && t.extras.vehicle_model) || 'Auto';
                                        const plate = t.vehicles?.plate || t.customers?.vehicle_plate || (t.extras && t.extras.vehicle_plate) || '';
                                        const vehicleStr = `${brand} ${model} ${plate ? `(${plate})` : ''}`.trim();
                                        const clientName = t.customers?.name || 'Cliente';
                                        const price = `$${parseFloat(t.price).toFixed(2)}`;
                                        const serviceName = getServiceName(t.service_id);
                                        return [time, clientName, vehicleStr, serviceName, price];
                                    });

                                    doc.text("Historial de Autos", 14, doc.lastAutoTable.finalY + 15);
                                    autoTable(doc, {
                                        startY: doc.lastAutoTable.finalY + 20,
                                        head: [['Hora', 'Cliente', 'Vehículo', 'Servicio', 'Precio']],
                                        body: txBody,
                                        theme: 'striped',
                                        headStyles: { fillColor: [75, 85, 99] } // Gray
                                    });

                                    // 2.4 NOTES
                                    if (dailyNotes.length > 0) {
                                        const notesBody = dailyNotes.map(n => [
                                            new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                                            n.content
                                        ]);

                                        doc.addPage(); // Start notes on new page if needed, or check Y
                                        doc.text("Bitácora / Notas", 14, 20);
                                        autoTable(doc, {
                                            startY: 30,
                                            head: [['Hora', 'Nota']],
                                            body: notesBody,
                                            theme: 'plain'
                                        });
                                    }

                                    // 3. Share or Download
                                    const pdfBlob = doc.output('blob');
                                    const file = new File([pdfBlob], `Reporte_${getPRDateString(new Date())}.pdf`, { type: 'application/pdf' });

                                    if (navigator.share) {
                                        await navigator.share({
                                            files: [file],
                                            title: 'Reporte Diario Completo',
                                            text: `Reporte detallado del ${todayDate}`
                                        });
                                    } else {
                                        doc.save(`Reporte_${getPRDateString(new Date())}.pdf`);
                                        alert("PDF Descargado. Envíalo manualmente por WhatsApp.");
                                    }

                                } catch (error) {
                                    console.error("Error generating PDF:", error);
                                    alert("Error: " + error.message);
                                }
                            }}
                            style={{
                                backgroundColor: '#25D366', // WhatsApp Green
                                color: 'white',
                                border: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                padding: '0.3rem 0.6rem',
                                fontSize: '0.8rem',
                                cursor: 'pointer',
                                borderRadius: '0.25rem',
                                marginLeft: 'auto'
                            }}
                        >
                            <MessageCircle size={16} />
                            <span>Enviar PDF Detallado</span>
                        </button>
                    )}

                </div>

                {showNotes && (
                    <div style={{
                        marginBottom: '1rem', // Moved margin here
                        padding: '1rem',
                        backgroundColor: 'var(--bg-secondary)',
                        borderRadius: '0.5rem',
                        border: '1px solid var(--border-color)',
                        animation: 'fadeIn 0.2s'
                    }}>
                        {dailyNotes.length > 0 ? (
                            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1rem 0' }}>
                                {dailyNotes.map(note => (
                                    <li key={note.id} style={{ marginBottom: '0.5rem', padding: '0.5rem', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '4px', fontSize: '0.9rem' }}>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginRight: '0.5rem' }}>
                                            {new Date(note.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        {note.content}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.9rem', marginBottom: '1rem' }}>No hay notas hoy.</p>
                        )}

                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <input
                                type="text"
                                className="input"
                                placeholder="Escribir nota..."
                                value={newNote}
                                onChange={(e) => setNewNote(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                                style={{ flex: 1 }}
                            />
                            <button className="btn btn-primary" onClick={handleAddNote} disabled={!newNote.trim()}>
                                <Send size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>


            {/* DATE FILTER CONTROLS */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '1rem', alignItems: 'center' }}>
                <button
                    className="btn"
                    style={{
                        backgroundColor: dateFilter === 'today' ? 'var(--primary)' : 'var(--bg-secondary)',
                        color: 'white',
                    }}
                    onClick={() => setDateFilter('today')}
                >
                    Hoy
                </button>

                <button
                    className="btn"
                    style={{
                        backgroundColor: dateFilter === 'manual' ? 'var(--primary)' : 'var(--bg-secondary)',
                        color: 'white',
                    }}
                    onClick={() => setDateFilter('manual')}
                >
                    Rango/Fecha
                </button>

                {dateFilter === 'manual' && (
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', backgroundColor: 'var(--bg-secondary)', padding: '0.25rem', borderRadius: '0.5rem' }}>
                        <input
                            type="date"
                            value={dateRange.start}
                            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                            style={{
                                padding: '0.4rem',
                                borderRadius: '0.25rem',
                                border: '1px solid var(--border-color)',
                                backgroundColor: 'var(--bg-input)',
                                color: 'var(--text-primary)'
                            }}
                            title="Desde"
                        />
                        <span style={{ color: 'var(--text-muted)' }}>-</span>
                        <input
                            type="date"
                            value={dateRange.end}
                            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                            style={{
                                padding: '0.4rem',
                                borderRadius: '0.25rem',
                                border: '1px solid var(--border-color)',
                                backgroundColor: 'var(--bg-input)',
                                color: 'var(--text-primary)'
                            }}
                            title="Hasta"
                        />
                    </div>
                )}

                <button
                    className="btn"
                    style={{
                        backgroundColor: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        padding: '0.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        opacity: isRefreshing ? 0.7 : 1,
                        cursor: isRefreshing ? 'wait' : 'pointer'
                    }}
                    onClick={async () => {
                        if (isRefreshing) return;
                        setIsRefreshing(true);
                        await refreshTransactions();
                        await refreshCustomers();
                        setTimeout(() => setIsRefreshing(false), 500); // Visual delay
                    }}
                    title="Recargar datos"
                >
                    <RefreshCw size={18} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
                    <style>{`
                                @keyframes spin { 100% { transform: rotate(360deg); } }
                            `}</style>
                </button>

                {/* SHOW CANCELLED BUTTON */}
                <button
                    className="btn"
                    style={{
                        backgroundColor: 'var(--bg-secondary)',
                        color: '#EF4444', // Red text
                        padding: '0.5rem 0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontSize: '0.9rem'
                    }}
                    onClick={() => {
                        setActiveDetailModal('cancelled');
                    }}
                    title="Gestionar cancelaciones"
                >
                    <span style={{ fontSize: '1.1em' }} role="img" aria-label="cancel">⚠️</span> Gestionar Cancelaciones
                </button>
            </div>


            {/* MOSTRAR BOTÓN PARA TODOS (Admin y Empleados) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button className="btn btn-primary mobile-fab" onClick={() => setIsModalOpen(true)}>
                    <Plus size={20} />
                    <span className="desktop-text">Registrar Servicio</span>
                </button>

                {/* QUICK PLATE SEARCH (LPR Simulation) */}
                <div style={{ position: 'relative', flex: 1, maxWidth: '300px' }}>
                    <Car size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                        type="text"
                        placeholder="Buscar Tablilla... (Enter)"
                        className="input"
                        value={plateSearch}
                        onChange={(e) => setPlateSearch(e.target.value)}
                        onKeyDown={handlePlateSearch}
                        style={{ paddingLeft: '2.5rem', width: '100%', border: '1px solid var(--primary)', boxShadow: '0 0 10px rgba(99, 102, 241, 0.2)' }}
                    />
                </div>

                {(userRole === 'admin' || userRole === 'manager') && (
                    <button
                        onClick={() => setIsConfigModalOpen(true)}
                        title="Configuración de Sistema"
                        className="btn"
                        style={{
                            backgroundColor: 'rgba(255,255,255,0.1)',
                            color: 'white',
                            border: '1px solid rgba(255,255,255,0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            padding: '0 1rem',
                            height: '42px',
                            cursor: 'pointer',
                            borderRadius: '0.5rem',
                            transition: 'all 0.2s',
                            fontWeight: '600'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                    >
                        <Settings size={20} />
                        <span className="desktop-text">Configurar</span>
                    </button>
                )}
            </div>




            {/* MULTI-STAGE FLOW SECTIONS (Compacted) */}
            <div className="uniform-3-col-grid" style={{ marginBottom: '2rem' }}>

                {/* COLA DE ESPERA (Summary Card) */}
                <div
                    onClick={() => setActiveDetailModal('waiting_list')}
                    style={{
                        backgroundColor: 'var(--bg-card)', padding: '1.25rem', borderRadius: '0.5rem',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)', cursor: 'pointer',
                        border: activeDetailModal === 'waiting_list' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                        transition: 'transform 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                    <h3 className="label" style={{ marginBottom: '0.5rem', fontSize: '0.8rem' }}>En Espera</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Clock size={24} color="#6366f1" />
                        <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--text-primary)', lineHeight: 1 }}>
                            {statsTransactions.filter(t => t.status === 'waiting').length}
                        </div>
                    </div>
                </div>

                {/* Vertical Column for In Process + Feedback */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* CARD: EN PROCESO */}
                    <div
                        onClick={() => setActiveDetailModal('in_progress_list')}
                        style={{
                            backgroundColor: 'var(--bg-card)', padding: '1.25rem', borderRadius: '0.5rem',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.1)', cursor: 'pointer',
                            border: activeDetailModal === 'in_progress_list' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                            transition: 'transform 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        <h3 className="label" style={{ marginBottom: '0.5rem', fontSize: '0.8rem' }}>En Proceso</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <Droplets size={24} color="#3B82F6" />
                            <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--text-primary)', lineHeight: 1 }}>
                                {statsTransactions.filter(t => t.status === 'in_progress').length}
                            </div>
                        </div>
                    </div>


                </div>

                {/* CARD: LISTO PARA RECOGER (NUEVO) */}
                <div
                    onClick={() => setActiveDetailModal('ready_list')}
                    style={{
                        backgroundColor: 'var(--bg-card)', padding: '1.25rem', borderRadius: '0.5rem',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)', cursor: 'pointer',
                        border: activeDetailModal === 'ready_list' ? '2px solid #10B981' : '1px solid var(--border-color)',
                        transition: 'transform 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                    <h3 className="label" style={{ marginBottom: '0.5rem', fontSize: '0.8rem' }}>Listos</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <DollarSign size={24} color="#10B981" />
                        <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--text-primary)', lineHeight: 1 }}>
                            {statsTransactions.filter(t => t.status === 'ready').length}
                        </div>
                    </div>
                </div>
            </div>

            <div className="uniform-3-col-grid" style={{ marginBottom: '1.5rem' }}>
                {/* TOTAL REGISTRADOS / MIS SERVICIOS */}
                <div
                    className="card"
                    onClick={() => setActiveDetailModal('cars')}
                    style={{
                        padding: '1.25rem',
                        backgroundColor: 'var(--bg-card)',
                        cursor: 'pointer',
                        transition: 'transform 0.2s',
                        border: activeDetailModal === 'cars' ? '2px solid var(--primary)' : '1px solid var(--border-color)'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                    <h3 className="label" style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                        {userRole === 'admin' || userRole === 'manager' ? 'Total Registrados' : 'Mis Servicios'}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Car size={24} style={{ color: 'var(--text-muted)' }} />
                        <p style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--text-primary)', lineHeight: 1 }}>
                            {userRole === 'admin' || userRole === 'manager'
                                ? statsTransactions.length
                                : statsTransactions.filter(t => t.status !== 'waiting').length}
                        </p>
                    </div>
                </div>

                <div
                    className="card"
                    onClick={() => (userRole === 'admin' || userRole === 'manager') && setActiveDetailModal('income')}
                    style={{
                        cursor: (userRole === 'admin' || userRole === 'manager') ? 'pointer' : 'default',
                        transition: 'transform 0.2s',
                        padding: '1.25rem',
                        backgroundColor: 'var(--bg-card)',
                        border: activeDetailModal === 'income' ? '2px solid var(--primary)' : '1px solid var(--border-color)'
                    }}
                    onMouseEnter={(e) => (userRole === 'admin' || userRole === 'manager') && (e.currentTarget.style.transform = 'scale(1.02)')}
                    onMouseLeave={(e) => (userRole === 'admin' || userRole === 'manager') && (e.currentTarget.style.transform = 'scale(1)')}
                >
                    <h3 className="label" style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                        {(userRole === 'admin' || userRole === 'manager') ? 'Autos Completados' : 'Mis Autos'}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Car size={24} className="text-primary" />
                        <p style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--primary)', lineHeight: 1 }}>
                            {userRole === 'admin'
                                ? statsTransactions.filter(t => t.status === 'completed' || t.status === 'paid').length
                                : formatToFraction(fractionalCount)
                            }
                        </p>
                    </div>
                </div>

                {/* SOLO ADMIN VE INGRESOS TOTALES */}
                {userRole === 'admin' && (
                    <div
                        className="card"
                        onClick={() => setActiveDetailModal('income')}
                        style={{ cursor: 'pointer', transition: 'transform 0.2s', padding: '1.25rem' }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        <h3 className="label" style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>Ingresos Hoy</h3>
                        <p style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--success)', lineHeight: 1 }}>
                            ${totalIncome.toFixed(0)}
                        </p>
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>(Sin propinas)</p>
                    </div>
                )}

                <div
                    className="card"
                    onClick={() => setActiveDetailModal('commissions')}
                    style={{ cursor: 'pointer', transition: 'transform 0.2s', padding: '1.25rem' }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                    <h3 className="label" style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                        {userRole === 'admin' ? 'Comisiones' : 'Mi Neto'}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <p style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--warning)', lineHeight: 1 }}>
                            ${userRole === 'admin' ? totalCommissions.toFixed(0) : netCommissions.toFixed(2)}
                        </p>
                        {totalLunches > 0 && userRole !== 'admin' && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--danger)', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '0.2rem 0.4rem', borderRadius: '0.3rem' }}>
                                -${totalLunches.toFixed(0)}
                            </span>
                        )}
                    </div>
                </div>

                {/* NOTE CARD FOR EMPLOYEES (Placed 3rd in Grid) */}
                {userRole !== 'admin' && userRole !== 'manager' && (
                    <div
                        className="card"
                        onClick={() => setActiveDetailModal('daily_notes')}
                        style={{ cursor: 'pointer', transition: 'transform 0.2s', padding: '1.25rem' }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        <h3 className="label" style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                            Notas del Día
                        </h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ backgroundColor: 'rgba(234, 179, 8, 0.1)', padding: '0.4rem', borderRadius: '0.5rem' }}>
                                <MessageCircle size={20} color="#EAB308" />
                            </div>
                            <p style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--text-primary)', lineHeight: 1 }}>
                                {dailyNotes.length}
                            </p>
                        </div>
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

                    {/* DAILY NOTES CARD */}
                    <div
                        className="card"
                        onClick={() => setActiveDetailModal('daily_notes')}
                        style={{ cursor: 'pointer', transition: 'transform 0.2s', padding: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.01)'}
                        onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ backgroundColor: 'rgba(234, 179, 8, 0.1)', padding: '0.75rem', borderRadius: '0.5rem' }}>
                                <MessageCircle size={24} color="#EAB308" />
                            </div>
                            <div>
                                <h3 className="label" style={{ fontSize: '1rem', marginBottom: '0.2rem', color: 'var(--text-primary)' }}>Notas del Día</h3>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Bitácora de empleados</p>
                            </div>
                        </div>
                        <div>
                            <p style={{ fontSize: '2rem', fontWeight: 'bold', lineHeight: 1, color: 'var(--text-primary)' }}>{dailyNotes.length}</p>
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
                                            const isSelected = current.includes(emp.id);
                                            if (isSelected) {
                                                setSelectedEmployeesForAssignment(current.filter(id => id !== emp.id));
                                            } else {
                                                setSelectedEmployeesForAssignment([...current, emp.id]);
                                            }
                                        }}
                                        style={{
                                            padding: '0.5rem 1rem',
                                            borderRadius: '20px',
                                            border: '1px solid var(--primary)',
                                            backgroundColor: selectedEmployeesForAssignment.includes(emp.id) ? 'var(--primary)' : 'transparent',
                                            color: selectedEmployeesForAssignment.includes(emp.id) ? 'white' : 'var(--text-primary)',
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
            {
                isConfigModalOpen && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000
                    }} onClick={() => setIsConfigModalOpen(false)}>
                        <div style={{
                            backgroundColor: 'var(--bg-card)',
                            padding: '2rem',
                            borderRadius: '0.5rem',
                            width: '90%',
                            maxWidth: '450px'
                        }} onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <h2 style={{ margin: 0 }}>Configuración de Recibo</h2>
                                <button onClick={() => setIsConfigModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: '1.5rem' }}>&times;</button>
                            </div>

                            <div style={{ marginBottom: '1.5rem' }}>
                                <label className="label">Link de Reseña de Google</label>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="https://g.page/r/..."
                                    value={reviewLink}
                                    onChange={(e) => setReviewLink(e.target.value)}
                                />
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                                    Este link aparecerá en el PDF del recibo para que los clientes dejen su reseña.
                                </p>
                            </div>

                            <div style={{ marginBottom: '1.5rem' }}>
                                <label className="label">Link de Pago Stripe</label>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="https://buy.stripe.com/..."
                                    value={stripeLink}
                                    onChange={(e) => setStripeLink(e.target.value)}
                                />
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                                    Link de pago de Stripe para que los clientes paguen desde el portal.
                                </p>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <button
                                    className="btn"
                                    style={{ flex: 1, backgroundColor: 'var(--bg-secondary)', color: 'white' }}
                                    onClick={() => setIsConfigModalOpen(false)}
                                >
                                    Cancelar
                                </button>
                                <button
                                    className="btn btn-primary"
                                    style={{ flex: 1 }}
                                    onClick={async () => {
                                        const res = await handleUpdateSettings({
                                            review_link: reviewLink,
                                            stripe_link: stripeLink
                                        });
                                        if (res.success) {
                                            alert('Configuración guardada');
                                            setIsConfigModalOpen(false);
                                        }
                                    }}
                                >
                                    Guardar
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* EDIT TRANSACTION MODAL */}
            {
                editingTransactionId && (
                    <EditTransactionModal
                        key={editingTransactionId}
                        isOpen={true}
                        transaction={transactions.find(t => t.id === editingTransactionId)}
                        services={services}
                        employees={employees}
                        onClose={() => setEditingTransactionId(null)}
                        onUpdate={handleUpdateTransaction}
                        onDelete={handleDeleteTransactionV2}
                        userRole={userRole}
                        reviewLink={reviewLink}
                    />
                )
            }

            {/* DETAIL MODAL */}
            {
                activeDetailModal && (
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
                                    {activeDetailModal === 'daily_notes' && '📝 Notas del Día por Empleado'}
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
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {activeDetailModal === 'daily_notes' && (
                                    <div style={{ display: 'grid', gap: '1.5rem' }}>
                                        {dailyNotes.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No hay notas registradas hoy.</p>}
                                        {(() => {
                                            // Group notes by Author (parsing "Name: Content")
                                            const groupedNotes = {};
                                            dailyNotes.forEach(note => {
                                                const parts = note.content.split(':');
                                                let author = 'Desconocido';
                                                let content = note.content;

                                                if (parts.length > 1) {
                                                    author = parts[0].trim();
                                                    content = parts.slice(1).join(':').trim();
                                                }

                                                if (!groupedNotes[author]) groupedNotes[author] = [];
                                                groupedNotes[author].push({ ...note, cleanContent: content });
                                            });

                                            return Object.entries(groupedNotes).map(([author, notes]) => (
                                                <div key={author} className="card" style={{ padding: '1rem', backgroundColor: 'var(--bg-secondary)' }}>
                                                    <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem', color: 'var(--primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                                                        👤 {author}
                                                    </h3>
                                                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                                        {notes.map(n => (
                                                            <li key={n.id} style={{ marginBottom: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                                                                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', minWidth: '60px' }}>
                                                                    {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                                <span style={{ fontSize: '0.95rem' }}>{n.cleanContent}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            ));
                                        })()}

                                        {/* ADD NOTE INPUT IN MODAL */}
                                        <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <input
                                                    type="text"
                                                    className="input"
                                                    placeholder="Escribir nueva nota..."
                                                    value={newNote}
                                                    onChange={(e) => setNewNote(e.target.value)}
                                                    onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                                                    style={{ flex: 1 }}
                                                />
                                                <button className="btn btn-primary" onClick={handleAddNote} disabled={!newNote.trim()}>
                                                    <Send size={16} />
                                                </button>
                                            </div>
                                        </div>
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
                                        {statsTransactions.filter(t => t.status === 'completed' || t.status === 'paid').length === 0 ? <p>No hay autos lavados hoy.</p> : (
                                            <ul style={{ listStyle: 'none', padding: 0 }}>
                                                {[...statsTransactions]
                                                    .filter(t => t.status === 'completed' || t.status === 'paid')
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

                                                    if (vehicle) {
                                                        const brand = (vehicle.brand === 'Generico' || vehicle.brand === 'Generic' || vehicle.brand === 'null') ? '' : (vehicle.brand || '');
                                                        vehicleDisplayName = `${brand} ${vehicle.model || ''}`.trim();
                                                    } else if (t.customers?.vehicle_model) {
                                                        vehicleDisplayName = t.customers.vehicle_model;
                                                    } else if (t.extras?.vehicle_model) {
                                                        vehicleDisplayName = t.extras.vehicle_model;
                                                    }

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

                                                        if (vehicle) {
                                                            const brand = (vehicle.brand === 'Generico' || vehicle.brand === 'Generic' || vehicle.brand === 'null') ? '' : (vehicle.brand || '');
                                                            vehicleDisplayName = `${brand} ${vehicle.model || ''}`.trim();
                                                        } else if (t.customers?.vehicle_model) {
                                                            vehicleDisplayName = t.customers.vehicle_model;
                                                        } else if (t.extras?.vehicle_model) {
                                                            vehicleDisplayName = t.extras.vehicle_model;
                                                        }

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
                                                                            {(t.vehicles?.plate || t.customers?.vehicle_plate) && <span style={{ color: 'var(--text-primary)', marginLeft: '0.5rem', fontWeight: 'bold' }}>({t.vehicles?.plate || t.customers?.vehicle_plate})</span>}
                                                                        </div>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                                                                            <div style={{ color: 'var(--warning)', fontWeight: 'bold' }}>{getServiceName(t.service_id)}</div>
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
                                                        const brand = t.vehicles?.brand && t.vehicles.brand !== 'null' ? t.vehicles.brand : '';
                                                        const model = t.vehicles?.model || t.customers?.vehicle_model || t.extras?.vehicle_model || 'Modelo N/A';
                                                        const vehicleModel = `${brand} ${model}`.trim();
                                                        return (
                                                            <li key={t.id} className="mobile-card-item" style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(16, 185, 129, 0.05)', marginBottom: '0.5rem', borderRadius: '8px', borderLeft: '4px solid #10B981' }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                                    <div>
                                                                        <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--text-primary)' }}>{vehicleModel}</div>
                                                                        <div style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>({t.vehicles?.plate || t.customers?.vehicle_plate || t.extras?.vehicle_plate || 'Sin Placa'})</div>
                                                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{t.customers?.name}</div>
                                                                        <div style={{ color: 'var(--success)', fontWeight: 'bold', marginTop: '0.2rem' }}>{getServiceName(t.service_id)}</div>

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

                                {
                                    activeDetailModal === 'income' && (
                                        <div>
                                            <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '0.5rem' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                                    <span>Efectivo:</span>
                                                    <span style={{ fontWeight: 'bold' }}>${statsTransactions.filter(t => (t.status === 'completed' || t.status === 'paid') && t.payment_method === 'cash').reduce((sum, t) => sum + (parseFloat(t.price) || 0), 0).toFixed(2)}</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                                    <span>Tarjeta:</span>
                                                    <span style={{ fontWeight: 'bold' }}>${statsTransactions.filter(t => (t.status === 'completed' || t.status === 'paid') && t.payment_method === 'card').reduce((sum, t) => sum + (parseFloat(t.price) || 0), 0).toFixed(2)}</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <span>Ath Móvil:</span>
                                                    <span style={{ fontWeight: 'bold' }}>${statsTransactions.filter(t => (t.status === 'completed' || t.status === 'paid') && t.payment_method === 'transfer').reduce((sum, t) => sum + (parseFloat(t.price) || 0), 0).toFixed(2)}</span>
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
                                                                const count = (t.transaction_assignments?.length) || 1;

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
                                                                    const count = t.transaction_assignments?.length || 1;
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
                                                                const count = (t.transaction_assignments?.length) || 1;

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
            }

            {
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
                                                                    .filter(c =>
                                                                        (c.name || '').toLowerCase().includes(customerSearch.toLowerCase()) ||
                                                                        (c.vehicle_model || '').toLowerCase().includes(customerSearch.toLowerCase()) ||
                                                                        (c.vehicle_plate || '').toLowerCase().includes(customerSearch.toLowerCase())
                                                                    )
                                                                    .map(c => (
                                                                        <div
                                                                            key={c.id}
                                                                            onClick={() => {
                                                                                // Auto-select vehicle if exists
                                                                                const custVehicle = vehicles.find(v => v.customer_id == c.id);
                                                                                setFormData({
                                                                                    ...formData,
                                                                                    customerId: c.id,
                                                                                    vehicleId: custVehicle ? custVehicle.id : ''
                                                                                });
                                                                                handleCustomerSelect(c.id);
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
                                                                            <span style={{ fontWeight: 'bold' }}>{c.name}</span>
                                                                            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                                                                {c.vehicle_model ? `${c.vehicle_model} ` : ''}
                                                                                ({c.vehicle_plate || 'Sin Placa'})
                                                                            </span>
                                                                        </div>
                                                                    ))}
                                                                {customers.filter(c => (c.name || '').toLowerCase().includes(customerSearch.toLowerCase()) || (c.vehicle_model || '').toLowerCase().includes(customerSearch.toLowerCase()) || (c.vehicle_plate || '').toLowerCase().includes(customerSearch.toLowerCase())).length === 0 && (
                                                                    <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                                                        No se encontraron resultados
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                        <select
                                                            className="input"
                                                            required
                                                            value={formData.customerId}
                                                            onChange={(e) => {
                                                                const cId = e.target.value;
                                                                const custVehicle = vehicles.find(v => v.customer_id == cId);
                                                                setFormData({
                                                                    ...formData,
                                                                    customerId: cId,
                                                                    vehicleId: custVehicle ? custVehicle.id : ''
                                                                });
                                                                handleCustomerSelect(cId);
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


                                        {/* MEMBERSHIP INDICATOR */}
                                        {customerMembership && (
                                            <div style={{
                                                gridColumn: 'span 2',
                                                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                                                border: '1px solid #22C55E',
                                                padding: '0.75rem',
                                                borderRadius: '0.5rem',
                                                marginBottom: '1rem',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center'
                                            }}>
                                                <div>
                                                    <div style={{ color: '#22C55E', fontWeight: 'bold' }}>💎 Membresía Activa: {customerMembership.memberships.name}</div>
                                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                        {customerMembership.memberships.type === 'unlimited'
                                                            ? 'Lavados Ilimitados'
                                                            : `Lavados: ${customerMembership.usage_count} / ${customerMembership.memberships.wash_limit}`}
                                                    </div>
                                                </div>
                                                {(customerMembership.memberships.type === 'unlimited' || customerMembership.usage_count < customerMembership.memberships.wash_limit) && (
                                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={isMembershipUsage}
                                                            onChange={(e) => setIsMembershipUsage(e.target.checked)}
                                                            style={{ width: '20px', height: '20px' }}
                                                        />
                                                        <span style={{ fontWeight: 'bold' }}>Saldar con Membresía</span>
                                                    </label>
                                                )}
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

                                {/* LOYALTY REDEMPTION BUTTON */}
                                {canRedeemPoints && (
                                    <button
                                        type="button"
                                        className="btn"
                                        onClick={() => {
                                            setFormData({ ...formData, price: 0 });
                                            setIsRedemption(true);
                                            setCanRedeemPoints(false);
                                            alert('¡Lavado Gratis aplicado! El precio se ha ajustado a $0.00');
                                        }}
                                        style={{ width: '100%', marginTop: '1rem', backgroundColor: '#F59E0B', color: 'white', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
                                    >
                                        🌟 Canjear Lavado Gratis (10 Pts)
                                    </button>
                                )}

                                {/* TOTAL PRICE DISPLAY */}
                                <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'rgba(99, 102, 241, 0.1)', borderRadius: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontWeight: 'bold' }}>Total Estimado:</span>
                                    <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                                        ${formData.price || 0}
                                    </span>
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
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                            {statsTransactions
                                .filter(t => t.status === 'completed' || t.status === 'paid')
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
                                                    🚗 {t.customers?.vehicle_model || 'Modelo?'} <span style={{ color: 'var(--text-muted)' }}>({t.customers?.vehicle_plate || 'Sin Placa'})</span>
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
                                statsTransactions.length === 0 && (
                                    <div style={{ gridColumn: '1 / -1', padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', backgroundColor: 'var(--bg-card)', borderRadius: '0.5rem' }}>
                                        No hay ventas registradas hoy
                                    </div>
                                )
                            }
                        </div >
                    </>
                )
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
                                <p style={{ color: 'var(--text-muted)', margin: '0.5rem 0' }}>{selectedTransaction.customers?.vehicle_plate || 'Sin Placa'}</p>
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

            {/* GAMIFICATION BAR OR ADMIN CHART (MOVED TO BOTTOM) */}
            {
                userRole === 'admin' && dateFilter === 'custom' ? (
                    <EmployeeProductivityChart transactions={transactions} employees={employees} />
                ) : (
                    <ProductivityBar
                        dailyCount={fractionalCount}
                        dailyTarget={dailyTarget}
                        totalXp={totalXp}
                        isEditable={userRole === 'admin'}
                        onEditTarget={(newTarget) => handleUpdateSettings({ daily_target: newTarget })}
                    />
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
                            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                                Confirma que todo esté listo para {verifyingTransaction.customers?.vehicle_plate}:
                            </p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem' }}>
                                {[
                                    { key: 'cristales', label: 'Cristales' },
                                    { key: 'entrePuertas', label: 'Entre puertas' },
                                    { key: 'baul', label: 'Baúl' },
                                    { key: 'dash', label: 'Dash' },
                                    { key: 'portaVasos', label: 'Porta vasos' },
                                    { key: 'manchas', label: 'Manchas' }
                                ].map(item => (
                                    <label key={item.key} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontSize: '1.1rem' }}>
                                        <input
                                            type="checkbox"
                                            checked={verificationChecks[item.key]}
                                            onChange={(e) => setVerificationChecks({ ...verificationChecks, [item.key]: e.target.checked })}
                                            style={{ width: '20px', height: '20px', accentColor: 'var(--primary)' }}
                                        />
                                        {item.label}
                                    </label>
                                ))}
                            </div>

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
                                    disabled={!Object.values(verificationChecks).every(Boolean)}
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
        </div >
    );
};

export default Dashboard;
