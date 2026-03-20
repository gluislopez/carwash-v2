// Customer Portal - Last Updated: 2026-01-20
import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabase';
import { MapPin, Phone, Calendar, Clock, CheckCircle, Gift, X, DollarSign, Share, CreditCard, List, Award, FileText, Download, Check } from 'lucide-react';
import QRCode from 'react-qr-code';

const CustomerPortal = () => {
    // Add shimmer animation style
    useEffect(() => {
        const style = document.createElement('style');
        style.innerHTML = `
            @keyframes progress-shimmer {
                0% { background-position: 0 0; }
                100% { background-position: 1rem 0; }
            }
        `;
        document.head.appendChild(style);
        return () => document.head.removeChild(style);
    }, []);

    const { customerId } = useParams();
    const [customer, setCustomer] = useState(null);
    const [history, setHistory] = useState([]);
    const [activeService, setActiveService] = useState(null);
    const [vehicles, setVehicles] = useState([]);
    const [selectedVehicleId, setSelectedVehicleId] = useState(null);
    const [allMemberships, setAllMemberships] = useState([]); // All active plans for this customer
    const [membership, setMembership] = useState(null); // Current selected vehicle's plan
    const [subPayments, setSubPayments] = useState([]);
    const [loading, setLoading] = useState(true);

    const [showPromo, setShowPromo] = useState(false);
    const [latestTx, setLatestTx] = useState(null);
    const [hasRated, setHasRated] = useState(false);
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');
    const [submittingFeedback, setSubmittingFeedback] = useState(false);
    const [stripeLink, setStripeLink] = useState('');

    const [availableCoupons, setAvailableCoupons] = useState(0);
    const [nextCouponIndex, setNextCouponIndex] = useState(0);
    const [showCouponModal, setShowCouponModal] = useState(false);
    const [showVehiclesModal, setShowVehiclesModal] = useState(false); // NEW MODAL STATE
    const [showFeedbackModal, setShowFeedbackModal] = useState(false); // NEW MODAL FOR FEEDBACK
    const [showMembershipModal, setShowMembershipModal] = useState(false); // NEW MODAL FOR MEMBERSHIPS
    const [availablePlans, setAvailablePlans] = useState([]); // Store all plans
    const [portalMessage, setPortalMessage] = useState(''); // Global announcement
    const [submittingSubscription, setSubmittingSubscription] = useState(false);
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [selectedPlanId, setSelectedPlanId] = useState(null);
    const [branding, setBranding] = useState({ name: 'Express CarWash', logo: '/logo.jpg' });

    // PWA State
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [isIOS, setIsIOS] = useState(false);
    const [showIOSInstructions, setShowIOSInstructions] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());

    // --- NEW: ADDITIONAL SERVICES STATE ---
    const [allServices, setAllServices] = useState([]);
    const [isUpdatingExtras, setIsUpdatingExtras] = useState(false);
    const [showExtras, setShowExtras] = useState(false);

    // Queue position for waiting services
    const [queuePosition, setQueuePosition] = useState(null);

    // --- SHARED HELPERS ---
    const clean = (val) => (val && val !== 'null' && val !== 'undefined') ? val.toString().trim() : '';

    const getVehicleDisplayName = (v, cust) => {
        let brand = clean(v?.brand);
        let model = clean(v?.model);
        const plate = clean(v?.plate);

        if (!brand && !model && cust) {
            if (plate === clean(cust?.vehicle_plate) || vehicles.length === 1) {
                brand = clean(cust?.vehicle_brand);
                model = clean(cust?.vehicle_model);
            }
        }

        if (!brand && !model) return plate || 'Vehículo';
        return `${brand} ${model}`.trim();
    };

    // Progress Calculation Logic
    const calculateProgress = (service) => {
        if (!service) return 0;
        if (service.status === 'ready') return 100;
        if (service.status === 'waiting') return 0;

        if (service.status === 'in_progress') {
            if (!service.started_at) return 10; // Just started

            const startTime = new Date(service.started_at).getTime();
            const now = currentTime.getTime();
            const elapsedMinutes = (now - startTime) / (1000 * 60);

            // Linear progress from 10% to 75% over 30 minutes
            const progress = 10 + Math.min(65, (elapsedMinutes / 30) * 65);
            return Math.floor(progress);
        }
        return 0;
    };

    const formatDuration = (start, end) => {
        if (!start) return null;
        const s = new Date(start);
        const e = end ? new Date(end) : currentTime;
        const diff = Math.floor((e.getTime() - s.getTime()) / (1000 * 60)); // minutes
        if (diff < 0) return "0 min";
        return `${diff} min`;
    };

    const progress = calculateProgress(activeService);

    const getTransactionCategory = (t) => {
        const method = (t.payment_method || '').toLowerCase();
        const desc = (t.extras || []).map(ex => (ex.description || '').toUpperCase()).join(' ');

        // Priority 1: Use of Plan Benefits (Explicit method check)
        if (method === 'membership' || method === 'membership_usage') return 'membership_usage';

        // Priority 2: Sale of a Plan (Keywords or explicit sale method)
        if (method === 'membership_sale' || method === 'sale' || desc.includes('VENTA') || desc.includes('PLAN') || desc.includes('MEMBRE')) return 'membership_sale';

        // Standard methods
        if (method === 'transfer') return 'transfer';
        if (method === 'card') return 'card';
        if (method === 'cash' || !method) return 'cash';
        return 'other';
    };

    // Derived Stats for Multi-Vehicle Support
    const selectedVehicle = useMemo(() => vehicles.find(v => v.id === selectedVehicleId), [vehicles, selectedVehicleId]);

    // Sum points across all vehicles for Global View
    const totalVehiclePoints = useMemo(() => vehicles.reduce((sum, v) => sum + (v.points || 0), 0), [vehicles]);
    const totalVehicleRedeemed = useMemo(() => vehicles.reduce((sum, v) => sum + (v.redeemed_coupons || 0), 0), [vehicles]);

    const vehiclePoints = selectedVehicle ? selectedVehicle.points : (customer?.points || totalVehiclePoints || 0);
    const vehicleRedeemed = selectedVehicle ? selectedVehicle.redeemed_coupons : (customer?.redeemed_coupons || totalVehicleRedeemed || 0);

    const filteredHistory = useMemo(() => {
        const visibleHistory = history.filter(tx => tx.status !== 'cancelled');
        if (!selectedVehicleId) return visibleHistory;
        return visibleHistory.filter(tx => tx.vehicle_id === selectedVehicleId);
    }, [history, selectedVehicleId]);

    // DERIVED STATS FOR PROGRESS BARS
    const visitsCount = useMemo(() => {
        const baseVisits = filteredHistory.filter(tx => getTransactionCategory(tx) !== 'membership_sale').length;
        if (!selectedVehicleId) return baseVisits + (customer?.manual_visit_count || 0);
        return baseVisits; // For specific vehicle, we don't often use manual_visit_count unless linked
    }, [filteredHistory, selectedVehicleId, customer?.manual_visit_count]);

    const availableCouponsCount = useMemo(() => {
        const earned = Math.floor(visitsCount / 10);
        return Math.max(0, earned - vehicleRedeemed);
    }, [visitsCount, vehicleRedeemed]);

    // Timer to update progress bar every minute
    useEffect(() => {
        if (activeService && activeService.status === 'in_progress') {
            const timer = setInterval(() => {
                setCurrentTime(new Date());
            }, 60000); // Update every minute
            return () => clearInterval(timer);
        }
    }, [activeService]);

    // Calculate queue position when activeService is waiting
    useEffect(() => {
        const fetchQueuePosition = async () => {
            if (!activeService || activeService.status !== 'waiting') {
                setQueuePosition(null);
                return;
            }
            const { count, error } = await supabase
                .from('transactions')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'waiting')
                .lt('created_at', activeService.created_at);
            if (!error) {
                setQueuePosition(count + 1);
            }
        };
        fetchQueuePosition();
        const interval = setInterval(fetchQueuePosition, 15000);
        return () => clearInterval(interval);
    }, [activeService]);

    // Business Status
    const [isBusinessOpen, setIsBusinessOpen] = useState(false);

    const fetchSettings = async () => {
        const { data } = await supabase
            .from('business_settings')
            .select('setting_key, setting_value');

        if (data) {
            // 1. Business Status (Automatic Schedule + DB Override)
            const isOpenSetting = data.find(s => s.setting_key === 'is_open');
            const isManualOpen = isOpenSetting ? isOpenSetting.setting_value === 'true' : true;

            // Automatic logic: Tue-Sat, 8:00 AM to 4:30 PM (America/Puerto_Rico)
            const prTime = new Date().toLocaleString("en-US", { timeZone: "America/Puerto_Rico" });
            const prDate = new Date(prTime);
            const day = prDate.getDay(); // 0 Sun, 1 Mon, 2 Tue, 3 Wed, 4 Thu, 5 Fri, 6 Sat
            const hours = prDate.getHours();
            const mins = prDate.getMinutes();
            const totalMins = (hours * 60) + mins;
            const isScheduleOpen = (day >= 2 && day <= 6) && (totalMins >= 480 && totalMins < 990);

            setIsBusinessOpen(isManualOpen && isScheduleOpen);

            // 2. Portal Announcement (with expiration logic)
            const msg = data.find(s => s.setting_key === 'portal_message')?.setting_value;
            const msgDate = data.find(s => s.setting_key === 'portal_message_date')?.setting_value;
            const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Puerto_Rico' });

            if (msg && msgDate === today) {
                setPortalMessage(msg);
            } else {
                setPortalMessage('');
            }

            // 3. Branding
            const bName = data.find(s => s.setting_key === 'business_name')?.setting_value;
            const bLogo = data.find(s => s.setting_key === 'business_logo_url')?.setting_value;

            setBranding({
                name: bName || 'Express CarWash',
                logo: bLogo || '/logo.jpg'
            });
        }
    };

    useEffect(() => {
        fetchSettings();

        // Check time every minute for automatic status change
        const timer = setInterval(fetchSettings, 60000);

        // Realtime Subscription for ALL settings
        const channel = supabase
            .channel('public:business_settings_portal')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'business_settings' }, () => {
                fetchSettings();
            })
            .subscribe();

        return () => {
            clearInterval(timer);
            supabase.removeChannel(channel);
        };
    }, []);

    useEffect(() => {
        // Check if iOS
        const isIosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        setIsIOS(isIosDevice);

        // Capture install prompt
        const handleBeforeInstallPrompt = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const handleInstallClick = async () => {
        if (isIOS) {
            setShowIOSInstructions(true);
        } else if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                setDeferredPrompt(null);
            }
        } else {
            // Already installed or not supported, maybe show a hint or do nothing
            // For now, if no prompt and not iOS, we can assume it's installed or not capable
            // But let's show an alert for clarity during this phase if clicked
            // alert("Para instalar, busca la opción 'Instalar aplicación' en el menú de tu navegador.");
        }
    };

    useEffect(() => {
        console.log("Express CarWash System v4.80 [Portal] Initialized");
        const fetchData = async () => {
            if (!customerId) return;

            try {
                // SAVE ID FOR PWA "SMART LAUNCH"
                localStorage.setItem('my_carwash_id', customerId);
                // Backup cookie (more reliable for some iOS PWA scenarios)
                document.cookie = `my_carwash_id=${customerId}; path=/; max-age=31536000; SameSite=Lax`;

                // 1. Fetch Customer Info
                const { data: custData, error: custError } = await supabase
                    .from('customers')
                    .select('*')
                    .eq('id', customerId)
                    .single();

                if (custError) {
                    console.error("Error fetching customer:", custError);
                    setLoading(false);
                    return;
                }
                setCustomer(custData);

                // 2. Fetch Vehicles
                const { data: vData } = await supabase
                    .from('vehicles')
                    .select('*')
                    .eq('customer_id', customerId);

                if (vData) {
                    setVehicles(vData);
                    // Default to Global View (null) to show ALL visits/points
                    setSelectedVehicleId(null);
                }

                // 3. Fetch History & Check Feedback
                const { data: txData, error: txError } = await supabase
                    .from('transactions')
                    .select(`
                        *,
                        services (name),
                        vehicles (model, brand, plate),
                        customer_feedback (id, rating),
                        transaction_assignments (
                            employees (name)
                        )
                    `)
                    .eq('customer_id', customerId)
                    .order('created_at', { ascending: false });

                if (!txError && txData) {
                    setHistory(txData);

                    // Active Service?
                    const active = txData.find(t =>
                        t.status === 'waiting' || t.status === 'in_progress' || t.status === 'ready'
                    );
                    setActiveService(active);

                    // Latest Completed Service for Feedback
                    const lastCompleted = txData.find(t => t.status === 'completed' || t.status === 'paid');
                    if (lastCompleted) {
                        setLatestTx(lastCompleted);
                        if (lastCompleted.customer_feedback && lastCompleted.customer_feedback.length > 0) {
                            setHasRated(true);
                        }
                    }
                }

                // 3. Fetch Queue Count (GLOBAL)
                const { count, error: queueError } = await supabase
                    .from('transactions')
                    .select('*', { count: 'exact', head: true })
                    .eq('status', 'waiting');

                if (!queueError) {
                    setQueueCount(count);
                }

                // Check and Renew Membership (if month passed)
                await supabase.rpc('check_and_renew_membership', { p_customer_id: customerId });

                // 4. Fetch Membership Details (ALL active)
                const { data: memberData } = await supabase
                    .from('customer_memberships')
                    .select('*, memberships(*)')
                    .eq('customer_id', customerId)
                    .in('status', ['active', 'pending_payment']);

                if (memberData) {
                    setAllMemberships(memberData);
                    // Initial membership will be set by the useMemo or useEffect below
                }

                // 5. Fetch Subscription Payments
                const { data: payments } = await supabase
                    .from('subscription_payments')
                    .select('*')
                    .eq('customer_id', customerId)
                    .order('payment_date', { ascending: false });
                if (payments) setSubPayments(payments);
                // 4.1 Fetch Available Plans (for Modal) - SORTED: Unlimited First, then Price
                const { data: plans } = await supabase
                    .from('memberships')
                    .select('*')
                    .eq('active', true);

                if (plans) {
                    const sortedPlans = plans.sort((a, b) => {
                        // Helper to determine if a plan is effectively unlimited
                        const isUnlimited = (p) => (p.type === 'unlimited' || p.name.toLowerCase().includes('ilimitado') || p.name.toLowerCase().includes('unlimited'));

                        const aUnlimited = isUnlimited(a) ? 1 : 0;
                        const bUnlimited = isUnlimited(b) ? 1 : 0;

                        // 1. Unlimited priority
                        if (aUnlimited !== bUnlimited) return bUnlimited - aUnlimited;

                        // 2. Price ascending
                        return a.price - b.price;
                    });
                    setAvailablePlans(sortedPlans);
                }

                // 6. Fetch Global Settings (Stripe Link)
                const { data: settings } = await supabase
                    .from('settings')
                    .select('key, value');

                if (settings) {
                    const sLink = settings.find(s => s.key === 'stripe_link');
                    if (sLink) setStripeLink(sLink.value);
                }

                // 7. Fetch All Services for "Extras" section
                const { data: srvData } = await supabase
                    .from('services')
                    .select('*')
                    .order('name', { ascending: true });
                if (srvData) setAllServices(srvData);

            } catch (err) {
                console.error("General Portal Error:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();

        const channel = supabase
            .channel(`public:transactions:customer:${customerId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `customer_id=eq.${customerId}` },
                () => fetchData()
            )
            .subscribe();

        return () => supabase.removeChannel(channel);

    }, [customerId]);

    // Update current display membership when vehicle changes
    useEffect(() => {
        if (!allMemberships || allMemberships.length === 0) {
            setMembership(null);
            return;
        }

        let match = null;
        if (selectedVehicleId) {
            // STRICT MODE: Find ONLY the membership for THIS specific vehicle
            match = allMemberships.find(m => m.vehicle_id === selectedVehicleId);
            // No fallback to null vehicle_id here to avoid confusion between different cars
        } else {
            // Global view: show global plan if exists
            match = allMemberships.find(m => m.vehicle_id === null);
        }

        setMembership(match || null);
    }, [selectedVehicleId, allMemberships]);

    const channelMemberships = useEffect(() => {
        if (!customerId) return;
        const channel = supabase
            .channel(`public:memberships:customer:${customerId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_memberships', filter: `customer_id=eq.${customerId}` },
                () => {
                    const refreshMemberships = async () => {
                        const { data } = await supabase
                            .from('customer_memberships')
                            .select('*, memberships(*)')
                            .eq('customer_id', customerId)
                            .in('status', ['active', 'pending_payment']);
                        if (data) setAllMemberships(data);
                    };
                    refreshMemberships();
                }
            )
            .subscribe();
        return () => supabase.removeChannel(channel);
    }, [customerId]);

    const submitFeedback = async () => {
        if (rating === 0) return alert("Por favor selecciona las estrellas.");
        setSubmittingFeedback(true);

        const { error } = await supabase.from('customer_feedback').insert([
            {
                transaction_id: latestTx.id,
                rating: rating,
                comment: comment
            }
        ]);

        setSubmittingFeedback(false);

        if (error) {
            console.error("Feedback error:", error);
            alert("Error al enviar: " + (error.message || "Intente nuevamente."));
        } else {
            setShowPromo(true);
            setHasRated(true);
        }
    };

    const handleAddExtra = async (service) => {
        if (!activeService || isUpdatingExtras) return;

        // Confirm before adding
        if (!window.confirm(`¿Deseas añadir "${service.name}" por $${service.price} a tu servicio actual?`)) return;

        setIsUpdatingExtras(true);
        try {
            const currentExtras = activeService.extras || [];
            const newExtra = {
                description: service.name,
                price: parseFloat(service.price),
                commission: parseFloat(service.commission || 0),
                addedBy: 'customer'
            };

            const updatedExtras = [...currentExtras, newExtra];
            const updatedPrice = parseFloat(activeService.price || 0) + parseFloat(service.price);

            const { error } = await supabase
                .from('transactions')
                .update({
                    extras: updatedExtras,
                    price: updatedPrice
                })
                .eq('id', activeService.id);

            if (error) throw error;

            // Local state will be updated via REALTIME subscription already active in useEffect
            alert("¡Servicio adicional añadido correctamente!");
        } catch (err) {
            console.error("Error adding extra:", err);
            alert("Error al añadir servicio: " + err.message);
        } finally {
            setIsUpdatingExtras(false);
        }
    };

    const handleSubscribe = async () => {
        if (!selectedPlanId) return alert("Por favor selecciona un plan.");
        if (!acceptedTerms) return alert("Debes aceptar los Términos y Condiciones para continuar.");
        
        setSubmittingSubscription(true);
        try {
            const plan = availablePlans.find(p => p.id === selectedPlanId);
            
            // 1. Create the pending membership
            const { data: subData, error } = await supabase
                .from('customer_memberships')
                .insert([{
                    customer_id: customerId,
                    membership_id: selectedPlanId,
                    vehicle_id: selectedVehicleId,
                    status: 'pending_payment',
                    start_date: new Date().toISOString().split('T')[0],
                    usage_count: 0
                }])
                .select();

            if (error) throw error;

            alert("¡Solicitud enviada! Tu membresía está en estado 'Pendiente de Pago'. Por favor, realiza el pago en el carwash para activarla.");
            setShowMembershipModal(false);
            setAcceptedTerms(false);
            setSelectedPlanId(null);
            
            // Refresh memberships locally
            const { data: refreshData } = await supabase
                .from('customer_memberships')
                .select('*, memberships(*)')
                .eq('customer_id', customerId);
            if (refreshData) setAllMemberships(refreshData);

        } catch (err) {
            console.error("Error subscribing:", err);
            alert("Error al procesar la suscripción: " + err.message);
        } finally {
            setSubmittingSubscription(false);
        }
    };

    const handleDownloadTerms = () => {
        if (!selectedPlanId) return;
        const plan = availablePlans.find(p => p.id === selectedPlanId);
        
        import('../utils/pdfGenerator').then(async (module) => {
            const vehicleInfo = selectedVehicleId ? getVehicleDisplayName(vehicles.find(v => v.id === selectedVehicleId), customer) : (vehicles.length > 0 ? getVehicleDisplayName(vehicles[0], customer) : 'Vehículo general');
            const { blob, fileName } = await module.generateMembershipTermsPDF(
                customer?.name || '',
                plan?.name || '',
                vehicleInfo,
                new Date().toLocaleDateString('es-PR')
            );
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        });
    };

    const [queueCount, setQueueCount] = useState(0);
    const [selectedTxId, setSelectedTxId] = useState(null); // Modal State (ID)
    const selectedTransaction = useMemo(() => {
        if (!selectedTxId) return null;
        // Search in history or active service
        if (activeService && activeService.id === selectedTxId) return activeService;
        return history.find(tx => tx.id === selectedTxId);
    }, [selectedTxId, history, activeService]);

    // ... useEffect ...

    const unpaidTxs = useMemo(() => history.filter(t => t.status === 'unpaid'), [history]);
    const prTime = new Date().toLocaleString("en-US", { timeZone: "America/Puerto_Rico" });
    const prDate = new Date(prTime);
    const showsDebtAlert = unpaidTxs.length > 0 && (prDate.getHours() > 16 || (prDate.getHours() === 16 && prDate.getMinutes() >= 30));

    if (loading) return <div className="p-8 text-center text-white bg-slate-900 min-h-screen">Cargando perfil...</div>;
    if (!customer) return <div className="p-8 text-center text-white bg-slate-900 min-h-screen">Cliente no encontrado.</div>;

    return (
        <div style={{ fontFamily: "'Outfit', sans-serif", backgroundColor: '#f3f4f6', minHeight: '100vh', paddingBottom: '2rem' }}>
            {/* DEBT ALERT BANNER */}
            {showsDebtAlert && (
                <div style={{
                    backgroundColor: '#ef4444',
                    color: 'white',
                    padding: '1rem',
                    textAlign: 'center',
                    fontWeight: 'bold',
                    fontSize: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.25rem',
                    position: 'sticky',
                    top: 0,
                    zIndex: 1000,
                    boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <DollarSign size={20} />
                        PAGO PENDIENTE REQUERIDO
                    </div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.9, fontWeight: 'normal' }}>
                        Tienes {unpaidTxs.length} servicio{unpaidTxs.length > 1 ? 's' : ''} pendiente{unpaidTxs.length > 1 ? 's' : ''} de pago.
                    </div>
                </div>
            )}
            {/* HERDER */}
            <div style={{ backgroundColor: '#1e293b', color: 'white', padding: '2rem 1rem 3.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <img src={branding.logo} alt="Logo" style={{ width: '80px', height: '80px', borderRadius: '1rem', marginBottom: '1rem', objectFit: 'contain', backgroundColor: 'transparent' }} />
                <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>{branding.name}</h1>
                <p style={{ fontSize: '1rem', opacity: 0.8, marginBottom: '0.2rem' }}>Centro de Cuidado Automotriz</p>
                <p style={{ fontSize: '0.9rem', opacity: 0.7, marginBottom: '1.5rem', fontWeight: '500' }}>Martes a Sábado de 8:00 am a 4:30 pm</p>

                {/* QUEUE COUNTER & STATUS (RESTORED TO HEADER) */}
                <div style={{ display: 'flex', gap: '2.5rem', marginBottom: '1.5rem' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#60a5fa' }}>{queueCount}</div>
                        <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>Fila de Espera</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: isBusinessOpen ? '#4ade80' : '#ef4444' }}>
                            {isBusinessOpen ? 'Abierto' : 'Cerrado'}
                        </div>
                        <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>Estado</div>
                    </div>
                </div>

                {/* SMALLER INSTALL BUTTON */}
                <div
                    onClick={handleInstallClick}
                    style={{
                        fontSize: '0.8rem',
                        opacity: (deferredPrompt || isIOS) ? 1 : 0.5,
                        backgroundColor: (deferredPrompt || isIOS) ? '#4f46e5' : 'rgba(255,255,255,0.1)',
                        color: 'white',
                        padding: '0.5rem 1rem',
                        borderRadius: '2rem',
                        cursor: (deferredPrompt || isIOS) ? 'pointer' : 'default',
                        fontWeight: '600',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem'
                    }}>
                    📲 {isIOS ? 'Instalar App (iOS)' : 'Instalar App'}
                </div>
            </div>

            {/* IOS INSTRUCTIONS MODAL */}
            {showIOSInstructions && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 9999,
                    display: 'flex', flexDirection: 'column', justifyContent: 'end', alignItems: 'center',
                    paddingBottom: '2rem'
                }} onClick={() => setShowIOSInstructions(false)}>

                    <div style={{ color: 'white', textAlign: 'center', marginBottom: '2rem', animation: 'bounce 2s infinite' }}>
                        <div style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Para instalar la App:</div>
                        <div style={{ fontSize: '1rem', opacity: 0.8 }}>Debes usar Safari</div>
                    </div>

                    <div style={{
                        backgroundColor: '#1e1e1e', color: 'white', padding: '1.5rem',
                        borderRadius: '1rem', width: '90%', maxWidth: '400px',
                        textAlign: 'center', position: 'relative'
                    }} onClick={e => e.stopPropagation()}>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', textAlign: 'left' }}>
                            <div style={{ fontSize: '1.5rem', color: '#3b82f6' }}><Share size={32} /></div>
                            <div>
                                <div style={{ fontSize: '0.9rem', color: '#9ca3af' }}>Paso 1</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>Toca el botón 'Compartir'</div>
                                <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Suele estar abajo en el centro</div>
                            </div>
                        </div>

                        <div style={{ width: '100%', height: '1px', backgroundColor: '#374151', marginBottom: '1.5rem' }}></div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', textAlign: 'left' }}>
                            <div style={{ fontSize: '1.5rem' }}>📱</div>
                            <div>
                                <div style={{ fontSize: '0.9rem', color: '#9ca3af' }}>Paso 2</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>Selecciona 'Agregar a Inicio'</div>
                                <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>(Add to Home Screen)</div>
                            </div>
                        </div>

                        <button
                            onClick={() => setShowIOSInstructions(false)}
                            style={{
                                width: '100%', padding: '1rem',
                                backgroundColor: '#3b82f6', color: 'white',
                                borderRadius: '0.8rem', border: 'none',
                                fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer'
                            }}
                        >
                            Entendido
                        </button>
                    </div>

                    {/* Arrow pointing down for emphasis */}
                    <div style={{
                        marginTop: '1rem', fontSize: '2rem', color: 'white',
                        transform: 'translateY(10px)', opacity: 0.5
                    }}>
                        ⬇️
                    </div>
                </div>
            )}

            {/* VEHICLES LIST MODAL */}
            {showVehiclesModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 9999,
                    display: 'flex', justifyContent: 'center', alignItems: 'center',
                    padding: '1rem'
                }} onClick={() => setShowVehiclesModal(false)}>
                    <div style={{
                        backgroundColor: 'white', padding: '1.5rem',
                        borderRadius: '1rem', width: '100%', maxWidth: '450px',
                        maxHeight: '80vh', overflowY: 'auto'
                    }} onClick={e => e.stopPropagation()}>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#1e293b' }}>Mis Vehículos y Visitas</h2>
                            <button onClick={() => setShowVehiclesModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                                <X size={24} />
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {vehicles.map(v => (
                                <div key={v.id} style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    padding: '1rem', borderRadius: '0.8rem',
                                    backgroundColor: selectedVehicleId === v.id ? '#eff6ff' : '#f8fafc',
                                    border: selectedVehicleId === v.id ? '2px solid #3b82f6' : '1px solid #e2e8f0'
                                }}>
                                    <div>
                                        <div style={{ fontWeight: 'bold', color: '#1e293b', fontSize: '1rem' }}>
                                            {getVehicleDisplayName(v, customer)}
                                        </div>
                                        <div style={{ color: '#64748b', fontSize: '0.85rem' }}>
                                            {clean(v.plate) || 'Sin Placa'}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        {(() => {
                                            const vVisits = history.filter(tx =>
                                                tx.vehicle_id === v.id &&
                                                tx.status !== 'cancelled' &&
                                                getTransactionCategory(tx) !== 'membership_sale'
                                            ).length;
                                            const vCoupons = Math.floor(vVisits / 10);
                                            const vRedeemed = v.redeemed_coupons || 0;
                                            const vCouponsAvailable = Math.max(0, vCoupons - vRedeemed);
                                            return (
                                                <>
                                                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#10b981' }}>
                                                        {vVisits} visitas
                                                    </div>
                                                    {vCouponsAvailable > 0 && (
                                                        <div style={{ fontSize: '0.7rem', color: '#4f46e5', fontWeight: 'bold', marginTop: '0.1rem' }}>
                                                            🎁 {vCouponsAvailable} 50% OFF
                                                        </div>
                                                    )}
                                                    {vCouponsAvailable === 0 && (
                                                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.1rem' }}>
                                                            {10 - (vVisits % 10)} para 50%
                                                        </div>
                                                    )}
                                                </>
                                            );
                                        })()}
                                        <button
                                            onClick={() => {
                                                setSelectedVehicleId(v.id);
                                                setShowVehiclesModal(false);
                                            }}
                                            style={{
                                                fontSize: '0.75rem', padding: '0.3rem 0.6rem',
                                                backgroundColor: '#3b82f6', color: 'white',
                                                border: 'none', borderRadius: '0.4rem',
                                                marginTop: '0.3rem', cursor: 'pointer'
                                            }}
                                        >
                                            Ver Historial
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                            <button
                                onClick={() => {
                                    setSelectedVehicleId(null);
                                    setShowVehiclesModal(false);
                                }}
                                style={{
                                    width: '100%', padding: '0.8rem',
                                    backgroundColor: '#94a3b8', color: 'white',
                                    border: 'none', borderRadius: '0.8rem',
                                    fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer'
                                }}
                            >
                                Ver Resumen General (Todos)
                            </button>
                        </div>

                    </div>
                </div>
            )}

            <div style={{ maxWidth: '600px', margin: '-1.5rem auto 0', padding: '0 1rem', position: 'relative', zIndex: 10 }}>

                {/* --- GLOBAL ANNOUNCEMENT BANNER --- */}
                {portalMessage && (
                    <div style={{
                        backgroundColor: '#fef9c3',
                        color: '#854d0e',
                        padding: '1rem',
                        borderRadius: '1rem',
                        marginBottom: '1rem',
                        borderLeft: '5px solid #eab308',
                        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                        fontSize: '0.95rem',
                        fontWeight: '500',
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: '0.5rem'
                    }}>
                        <span style={{ fontSize: '1.2rem' }}>📢</span>
                        <span>{portalMessage}</span>
                    </div>
                )}

                {/* VEHICLE SELECTOR (TABS) */}
                {vehicles.length > 0 && (
                    <div style={{
                        display: 'flex', gap: '0.8rem', overflowX: 'auto',
                        padding: '0.5rem 0.2rem 1rem', marginBottom: '0.5rem',
                        scrollbarWidth: 'none', msOverflowStyle: 'none'
                    }} className="no-scrollbar">

                        {vehicles.map(v => (
                            <button
                                key={v.id}
                                onClick={() => setSelectedVehicleId(v.id)}
                                style={{
                                    flexShrink: 0, padding: '0.6rem 1.2rem',
                                    borderRadius: '2rem', border: 'none',
                                    backgroundColor: selectedVehicleId === v.id ? '#3b82f6' : 'white',
                                    color: selectedVehicleId === v.id ? 'white' : '#64748b',
                                    fontWeight: 'bold', fontSize: '0.9rem',
                                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                                    transition: 'all 0.2s'
                                }}
                            >
                                🚗 {getVehicleDisplayName(v, customer)}
                            </button>
                        ))}
                    </div>
                )}

                {/* CUSTOMER GREETING & STATS (INTEGRATED LOYALTY) */}
                <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', marginBottom: '1.5rem', position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <h2 style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>Hola, {customer.name}</h2>
                            {customer.customer_number && (
                                <span style={{ fontSize: '0.9rem', color: '#64748b', backgroundColor: '#f1f5f9', padding: '0.2rem 0.5rem', borderRadius: '6px', fontWeight: 'bold' }}>
                                    #{customer.customer_number.toString().padStart(2, '0')}
                                </span>
                            )}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#3b82f6', fontWeight: 'bold', backgroundColor: '#eff6ff', padding: '0.2rem 0.6rem', borderRadius: '0.5rem' }}>
                            {selectedVehicle ? getVehicleDisplayName(selectedVehicle, customer) : 'Vista General'}
                        </div>
                    </div>
                    <div style={{ marginTop: '1.2rem', display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
                        <div style={{ textAlign: 'center', flex: 1 }}>
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1e293b' }}>
                                {visitsCount}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Visitas</div>
                        </div>
                        {!membership && (
                            <>
                                <div style={{ textAlign: 'center', flex: 1.5, borderLeft: '1px solid #e2e8f0', paddingLeft: '0.75rem' }}>
                                    {availableCouponsCount > 0 ? (
                                        <button
                                            onClick={() => setShowCouponModal(true)}
                                            style={{
                                                backgroundColor: '#4f46e5', color: 'white', padding: '0.4rem 0.6rem',
                                                borderRadius: '0.5rem', border: 'none', fontWeight: 'bold',
                                                fontSize: '0.8rem', cursor: 'pointer', boxShadow: '0 4px 6px rgba(79, 70, 229, 0.3)'
                                            }}>
                                            🎁 USAR 50% OFF
                                        </button>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                            <div style={{ fontSize: '1.3rem', filter: 'grayscale(0.5)', opacity: 0.8 }}>🎁</div>
                                            <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '0.2rem' }}>
                                                {10 - (visitsCount % 10)} visitas para 50%
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                        {membership && (
                            <div style={{ flex: 2.5, borderLeft: '1px solid #e2e8f0', paddingLeft: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div style={{ fontSize: '1.1rem', color: '#10b981' }}>✨</div>
                                <div style={{ fontSize: '0.8rem', color: '#166534', fontWeight: 'bold' }}>
                                    {selectedVehicle ? `Beneficios Activos (${getVehicleDisplayName(selectedVehicle, customer)})` : "Beneficios Activos"}
                                </div>
                            </div>
                        )}
                    </div>
                    {/* INFO LABEL */}
                    {selectedVehicle && (
                        <div style={{
                            marginTop: '1rem',
                            fontSize: '0.75rem',
                            color: '#3b82f6',
                            backgroundColor: '#eff6ff',
                            padding: '0.4rem 0.8rem',
                            borderRadius: '0.5rem',
                            display: 'inline-block',
                            fontWeight: '600'
                        }}>
                            📍 Viendo información exclusiva de este vehículo
                        </div>
                    )}

                    {/* MEMBERSHIP STATUS BANNER */}
                    {membership && (
                        <div style={{
                            marginTop: '1.25rem',
                            padding: '1rem',
                            backgroundColor: 'rgba(34, 197, 94, 0.05)',
                            border: '1px solid rgba(34, 197, 94, 0.2)',
                            borderRadius: '0.75rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.5rem'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '1.25rem' }}>💎</span>
                                    <span style={{ fontWeight: 'bold', color: '#166534', fontSize: '1.1rem' }}>
                                        {membership.memberships?.name}
                                        {membership.vehicle_id && vehicles.find(v => v.id === membership.vehicle_id) && (
                                            <span style={{ fontSize: '0.7rem', opacity: 0.7, display: 'block' }}>
                                                Vinculado a: {getVehicleDisplayName(vehicles.find(v => v.id === membership.vehicle_id), customer)}
                                            </span>
                                        )}
                                    </span>
                                </div>

                                <div style={{
                                    fontSize: '0.75rem',
                                    backgroundColor: membership.status === 'pending_payment' ? '#f59e0b' : '#22c55e',
                                    color: 'white',
                                    padding: '0.2rem 0.6rem',
                                    borderRadius: '1rem',
                                    fontWeight: 'bold',
                                    alignSelf: 'flex-start'
                                }}>
                                    {membership.status === 'pending_payment' ? 'PENDIENTE DE PAGO' : 'ACTIVO'}
                                </div>
                            </div>

                            {membership.status === 'pending_payment' && (
                                <p style={{ fontSize: '0.8rem', color: '#b45309', margin: 0, fontWeight: '500' }}>
                                    Tu solicitud ha sido recibida. Visítanos para pagar y activar tus beneficios.
                                </p>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', color: '#166534', marginTop: '0.25rem' }}>
                                <span style={{ fontWeight: '500' }}>
                                    {membership.memberships?.type === 'unlimited'
                                        ? 'Lavados Ilimitados'
                                        : `Lavados disponibles: ${Math.max(0, (membership.memberships?.limit_count || 0) - (membership.usage_count || 0))} de ${membership.memberships?.limit_count || 0}`}
                                </span>
                                {membership.last_reset_at && (
                                    <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                        <Calendar size={16} />
                                        Renovación: {(() => {
                                            try {
                                                const d = new Date(membership.last_reset_at);
                                                d.setMonth(d.getMonth() + 1);
                                                return d.toLocaleDateString();
                                            } catch (e) { return 'N/A'; }
                                        })()}
                                    </span>
                                )}
                            </div>

                            {/* Membership Progress Bar (for limited plans) */}
                            {membership.memberships?.type !== 'unlimited' && membership.memberships?.limit_count > 0 && (
                                <div style={{ width: '100%', height: '6px', backgroundColor: 'rgba(34, 197, 94, 0.2)', borderRadius: '3px', overflow: 'hidden', marginTop: '0.5rem' }}>
                                    <div style={{
                                        height: '100%',
                                        backgroundColor: '#22c55e',
                                        width: `${Math.max(0, 100 - ((membership.usage_count || 0) / membership.memberships.limit_count) * 100)}%`,
                                        transition: 'width 0.5s ease-out'
                                    }}></div>
                                </div>
                            )}
                        </div>
                    )}
                </div>


                {/* ACTIVE SERVICE (MOVED TO TOP) */}
                {activeService && (
                    <div
                        onClick={() => setSelectedTxId(activeService.id)}
                        style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1rem', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', marginBottom: '0.75rem', borderLeft: '5px solid #3b82f6', cursor: 'pointer' }}
                    >
                        <h3 style={{ fontWeight: 'bold', color: '#3b82f6', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                            SERVICIO EN CURSO
                            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Ver detalles &rarr;</span>
                        </h3>

                        {/* Service Name with High Contrast */}
                        <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '0.2rem' }}>
                            {activeService.services?.name || 'Lavado'}
                        </div>

                        {/* Vehicle Info */}
                        <div style={{ fontSize: '0.95rem', color: '#475569', marginBottom: '0.5rem', fontWeight: '600' }}>
                            🚗 {getVehicleDisplayName(activeService.vehicles || activeService, customer)}
                            <span style={{ marginLeft: '0.5rem', backgroundColor: '#f1f5f9', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.8rem' }}>
                                {clean(activeService.vehicles?.plate) || clean(activeService.plate) || clean(customer.vehicle_plate) || 'Sin Placa'}
                            </span>
                        </div>

                        {/* Extras Count & Text */}
                        {activeService.extras && activeService.extras.length > 0 && (
                            <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.4rem' }}>
                                + {activeService.extras.length} extras <span style={{ fontSize: '0.75rem' }}>({activeService.extras.map(e => e.description).join(', ')})</span>
                            </div>
                        )}

                        {/* TOTAL COST DISPLAY */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', marginBottom: '0.8rem' }}>
                            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#10b981' }}>
                                Total: ${parseFloat(activeService.price || 0).toFixed(2)}
                            </div>
                            {stripeLink && (
                                <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 'normal' }}>
                                    Total con tarjeta crédito o débito: ${(parseFloat(activeService.price || 0) * 1.03).toFixed(2)}
                                </div>
                            )}
                        </div>

                        <div style={{ marginTop: '0.5rem' }}>
                            {/* EMPLOYEES LIST */}
                            {activeService.transaction_assignments && activeService.transaction_assignments.length > 0 && (
                                <div style={{ marginBottom: '0.8rem' }}>
                                    <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.3rem' }}>Atendido por:</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                        {activeService.transaction_assignments.map((assign, idx) => (
                                            <span key={idx} style={{
                                                backgroundColor: '#eff6ff', color: '#1e40af',
                                                padding: '0.25rem 0.6rem', borderRadius: '0.5rem',
                                                fontSize: '0.8rem', fontWeight: '600',
                                                display: 'flex', alignItems: 'center', gap: '0.3rem'
                                            }}>
                                                👤 {assign.employees?.name || 'Empleado'}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* QUEUE POSITION BANNER (waiting only) */}
                            {activeService.status === 'waiting' && queuePosition !== null && (
                                <div style={{
                                    backgroundColor: '#fefce8',
                                    border: '1px solid #fde047',
                                    borderRadius: '0.75rem',
                                    padding: '0.75rem 1rem',
                                    marginBottom: '0.75rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '0.5rem'
                                }}>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: '#854d0e', fontWeight: '600', marginBottom: '0.1rem' }}>Tu posición en la fila</div>
                                        <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#92400e', lineHeight: 1 }}>
                                            {queuePosition === 1 ? '¡Eres el próximo! 🚗💨' : `#${queuePosition}`}
                                        </div>
                                        {queuePosition > 1 && (
                                            <div style={{ fontSize: '0.75rem', color: '#b45309', marginTop: '0.1rem' }}>
                                                {queuePosition - 1} auto{queuePosition - 1 > 1 ? 's' : ''} antes que tú
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ fontSize: '2rem' }}>⏳</div>
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ padding: '0.25rem 0.75rem', borderRadius: '1rem', backgroundColor: '#eff6ff', color: '#3b82f6', fontSize: '0.9rem', fontWeight: 'bold' }}>
                                    {activeService.status === 'waiting' && '⏳ En Espera'}
                                    {activeService.status === 'in_progress' && '🚿 En Proceso'}
                                    {activeService.status === 'ready' && '✅ Listo para Recoger'}
                                </span>
                                <span style={{ fontWeight: 'bold', color: '#3b82f6', fontSize: '1.1rem' }}>
                                    {progress}%
                                </span>
                            </div>

                            {/* PROGRESS BAR */}
                            <div style={{
                                width: '100%',
                                height: '10px',
                                backgroundColor: '#e2e8f0',
                                borderRadius: '5px',
                                marginTop: '1rem',
                                overflow: 'hidden',
                                border: '1px solid #cbd5e1'
                            }}>
                                <div style={{
                                    width: `${progress}%`,
                                    height: '100%',
                                    backgroundColor: progress === 100 ? '#10b981' : '#3b82f6',
                                    borderRadius: '5px',
                                    transition: 'width 1s ease-in-out',
                                    backgroundImage: progress < 100 ? 'linear-gradient(45deg, rgba(255,255,255,0.15) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.15) 75%, transparent 75%, transparent)' : 'none',
                                    backgroundSize: '1rem 1rem',
                                    animation: progress < 100 ? 'progress-shimmer 2s linear infinite' : 'none'
                                }}></div>
                            </div>

                            {/* --- ADD EXTRA BUTTON INSIDE CARD --- */}
                            {(activeService.status === 'waiting' || activeService.status === 'in_progress') && (
                                <div style={{ marginTop: '1.25rem', borderTop: '1px dashed #e2e8f0', paddingTop: '1rem' }}>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowExtras(!showExtras);
                                        }}
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem',
                                            borderRadius: '0.75rem',
                                            border: '1px solid #4f46e5',
                                            backgroundColor: showExtras ? 'rgba(79, 70, 229, 0.05)' : 'white',
                                            color: '#4f46e5',
                                            fontWeight: 'bold',
                                            fontSize: '0.9rem',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '0.5rem',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <span>✨</span>
                                        {showExtras ? 'Ocultar Servicios Extras' : '¿Deseas añadir algo más?'}
                                    </button>

                                    {/* --- MINI CAROUSEL INSIDE CARD --- */}
                                    {showExtras && (
                                        <div style={{
                                            marginTop: '1rem',
                                            display: 'flex',
                                            gap: '0.75rem',
                                            overflowX: 'auto',
                                            padding: '0.25rem 0.25rem 0.75rem',
                                            scrollbarWidth: 'none',
                                            msOverflowStyle: 'none'
                                        }} className="no-scrollbar">
                                            {allServices
                                                .filter(s => s.active !== false) // ONLY filter extras here
                                                .filter(s => s.id !== activeService.service_id)
                                                .filter(s => !(activeService.extras || []).some(e => e.description === s.name))
                                                .map(service => (
                                                    <div
                                                        key={service.id}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleAddExtra(service);
                                                        }}
                                                        style={{
                                                            flexShrink: 0,
                                                            width: '125px',
                                                            backgroundColor: '#f8fafc',
                                                            borderRadius: '0.75rem',
                                                            padding: '0.75rem',
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            alignItems: 'center',
                                                            textAlign: 'center',
                                                            justifyContent: 'space-between',
                                                            minHeight: '135px',
                                                            cursor: isUpdatingExtras ? 'default' : 'pointer',
                                                            opacity: isUpdatingExtras ? 0.7 : 1,
                                                            border: '1px solid #e2e8f0'
                                                        }}
                                                    >
                                                        <div style={{
                                                            fontSize: '0.75rem',
                                                            fontWeight: 'bold',
                                                            color: '#1e293b',
                                                            marginBottom: '0.4rem',
                                                            lineHeight: '1.2',
                                                            width: '100%',
                                                            wordBreak: 'break-word'
                                                        }}>
                                                            {service.name}
                                                        </div>
                                                        <div style={{ fontSize: '0.9rem', fontWeight: '800', color: '#10b981' }}>
                                                            ${parseFloat(service.price).toFixed(0)}
                                                        </div>
                                                        <div style={{
                                                            marginTop: '0.4rem',
                                                            backgroundColor: '#4f46e5',
                                                            color: 'white',
                                                            borderRadius: '50%',
                                                            width: '20px',
                                                            height: '20px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            fontSize: '0.8rem'
                                                        }}>+</div>
                                                    </div>
                                                ))
                                            }
                                        </div>
                                    )}
                                </div>
                            )}

                            <style>
                                {`
                                    @keyframes progress-shimmer {
                                        0% { background-position: 1rem 0; }
                                        100% { background-position: 0 0; }
                                    }
                                `}
                            </style>
                        </div>
                    </div>
                )}

                {/* --- REMOVED OLD ADDITIONAL SERVICES SELECTION --- */}


                {/* --- NEW GRID LAYOUT (SQUARES OF 3) --- */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>

                    {/* 1. VEHICLES CARD */}
                    <div
                        onClick={() => setShowVehiclesModal(true)}
                        style={{
                            backgroundColor: 'white', borderRadius: '1rem', padding: '1rem',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.05)', cursor: 'pointer',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            textAlign: 'center', aspectRatio: '1', transition: 'transform 0.1s',
                            maxWidth: '110px', width: '100%'
                        }}
                        onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
                        onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        <div style={{ backgroundColor: '#eff6ff', padding: '0.6rem', borderRadius: '50%', marginBottom: '0.5rem' }}>
                            <List size={22} color="#3b82f6" />
                        </div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#1e293b' }}>Mis Autos</div>
                    </div>

                    {/* 2. FEEDBACK CARD */}
                    <div
                        onClick={() => {
                            if (!hasRated && latestTx) {
                                setShowFeedbackModal(true);
                            }
                        }}
                        style={{
                            backgroundColor: 'white', borderRadius: '1rem', padding: '1rem',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.05)', cursor: 'pointer',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            textAlign: 'center', aspectRatio: '1', transition: 'transform 0.1s',
                            maxWidth: '110px', width: '100%',
                            opacity: (hasRated || !latestTx) ? 0.6 : 1
                        }}
                        onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
                        onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        <div style={{ backgroundColor: '#fef9c3', padding: '0.6rem', borderRadius: '50%', marginBottom: '0.5rem' }}>
                            <span style={{ fontSize: '1.2rem' }}>⭐</span>
                        </div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#1e293b' }}>
                            {hasRated ? 'Calificado' : 'Opinar'}
                        </div>
                    </div>

                    {/* 3. REFERRAL CARD */}
                    <div
                        onClick={() => {
                            const message = `¡Hola! Te recomiendo Express CarWash. Si vas, diles que te refirió *${customer.name}*. ¡Gracias! 🚗✨`;
                            const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
                            window.open(whatsappUrl, '_blank');
                        }}
                        style={{
                            backgroundColor: 'white', borderRadius: '1rem', padding: '1rem',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.05)', cursor: 'pointer',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            textAlign: 'center', aspectRatio: '1', transition: 'transform 0.1s',
                            maxWidth: '110px', width: '100%'
                        }}
                        onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
                        onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        <div style={{ backgroundColor: '#dcfce7', padding: '0.6rem', borderRadius: '50%', marginBottom: '0.5rem' }}>
                            <Gift size={22} color="#10b981" />
                        </div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#1e293b' }}>Referir</div>
                    </div>

                </div>

                {/* --- MEMBERSHIP PLANS CARD (NEW) --- */}
                {!membership && (
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
                        <div
                            onClick={() => setShowMembershipModal(true)}
                            style={{
                                width: '100%', maxWidth: '100%', // take full width of container
                                backgroundColor: 'white',
                                borderRadius: '1rem', padding: '1.25rem',
                                boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
                                cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                transition: 'transform 0.1s',
                                border: '1px solid #e2e8f0'
                            }}
                            onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
                            onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div style={{ backgroundColor: '#eff6ff', padding: '0.8rem', borderRadius: '50%' }}>
                                    <Award size={26} color="#3b82f6" />
                                </div>
                                <div style={{ textAlign: 'left' }}>
                                    <div style={{ fontWeight: 'bold', fontSize: '1.15rem', color: '#1e293b' }}>Membresías VIP</div>
                                    <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Ahorra con planes mensuales</div>
                                </div>
                            </div>
                            <div>
                                <div style={{ backgroundColor: '#3b82f6', color: 'white', fontWeight: 'bold', padding: '0.5rem 1rem', borderRadius: '2rem', fontSize: '0.85rem', boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)' }}>
                                    Ver Planes
                                </div>
                            </div>
                        </div>
                    </div>
                )}


                {/* LOYALTY SECTION REMOVED (INTEGRATED ABOVE) */}

                {/* MEMBERSHIP CARD */}
                {membership && (
                    <div style={{
                        background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
                        color: 'white',
                        padding: '1rem',
                        borderRadius: '1rem',
                        marginBottom: '0.75rem',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        position: 'relative',
                        overflow: 'hidden'
                    }}>
                        <div style={{ position: 'absolute', top: '-10px', right: '-10px', opacity: 0.1 }}>
                            <Gift size={100} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                            <div>
                                <div style={{ fontSize: '0.8rem', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Membresía Activa</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                                    {membership.memberships.name}
                                    {membership.vehicle_id && (
                                        <span style={{ fontSize: '0.8rem', opacity: 0.8, display: 'block' }}>
                                            🚗 {getVehicleDisplayName(vehicles.find(v => v.id === membership.vehicle_id), customer)}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div style={{ backgroundColor: 'rgba(34, 197, 94, 0.2)', color: '#4ade80', padding: '0.2rem 0.6rem', borderRadius: '1rem', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                ACTIVO
                            </div>
                        </div>

                        <div style={{ marginBottom: '1rem' }}>
                            <div style={{ fontSize: '0.9rem', marginBottom: '0.25rem' }}>Beneficios:</div>
                            <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>
                                {membership.memberships.type === 'unlimited'
                                    ? '✨ Lavados Ilimitados'
                                    : `📦 ${membership.memberships.limit_count} Lavados Premium`}
                            </div>
                        </div>

                        {membership.memberships.type === 'limited' && (
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.4rem' }}>
                                    <span>Uso del Plan</span>
                                    <span>{membership.usage_count} / {membership.memberships.limit_count}</span>
                                </div>
                                <div style={{ width: '100%', height: '8px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '4px' }}>
                                    <div style={{
                                        width: `${(membership.usage_count / membership.memberships.limit_count) * 100}%`,
                                        height: '100%',
                                        backgroundColor: '#4ade80',
                                        borderRadius: '4px',
                                        transition: 'width 0.5s ease-out'
                                    }}></div>
                                </div>
                            </div>
                        )}
                        {membership.memberships.type === 'unlimited' && (
                            <div style={{ fontSize: '0.8rem', opacity: 0.7, fontStyle: 'italic' }}>
                                Disfruta de lavados sin límites mientras tu plan esté activo.
                            </div>
                        )}

                        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between' }}>
                            <div>
                                <div style={{ opacity: 0.7 }}>Próximo Pago</div>
                                <div style={{ fontWeight: 'bold' }}>
                                    {(() => {
                                        try {
                                            const d = new Date(membership.last_reset_at || membership.start_date);
                                            d.setMonth(d.getMonth() + 1);
                                            return d.toLocaleDateString();
                                        } catch (e) { return 'N/A'; }
                                    })()}
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ opacity: 0.7 }}>Costo Mensual</div>
                                <div style={{ fontWeight: 'bold' }}>${membership.memberships.price}</div>
                            </div>
                        </div>

                        <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                            <button
                                onClick={() => {
                                    const message = `Hola, soy ${customer.name}, me gustaría cancelar mi suscripción ${membership.memberships.name}.`;
                                    const whatsappUrl = `https://wa.me/17878578983?text=${encodeURIComponent(message)}`;
                                    window.open(whatsappUrl, '_blank');
                                }}
                                style={{
                                    backgroundColor: 'rgba(239, 68, 68, 0.2)',
                                    color: '#fca5a5',
                                    border: '1px solid rgba(239, 68, 68, 0.5)',
                                    padding: '0.4rem 1rem',
                                    borderRadius: '0.5rem',
                                    fontSize: '0.8rem',
                                    cursor: 'pointer',
                                    width: '100%',
                                    fontWeight: '500'
                                }}
                            >
                                Cancelar Suscripción
                            </button>
                        </div>
                    </div>
                )}

                {/* SUBSCRIPTION PAYMENT HISTORY */}
                {membership && subPayments.length > 0 && (
                    <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', marginBottom: '1.5rem' }}>
                        <h3 style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#1e293b', marginBottom: '1rem' }}>Historial de Pagos (Suscripción)</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {subPayments.map(p => (
                                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }}></div>
                                        <span style={{ color: '#4b5563' }}>{new Date(p.payment_date).toLocaleDateString()}</span>
                                    </div>
                                    <span style={{ fontWeight: 'bold', color: '#1e293b' }}>${p.amount}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* COUPON MODAL */}
                {showCouponModal && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 5000
                    }} onClick={() => setShowCouponModal(false)}>
                        <div style={{
                            backgroundColor: 'white', padding: '2rem', borderRadius: '1rem',
                            width: '90%', maxWidth: '350px', textAlign: 'center', position: 'relative'
                        }} onClick={e => e.stopPropagation()}>
                            <button onClick={() => setShowCouponModal(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer' }}>
                                <X size={24} color="#64748b" />
                            </button>

                            <h2 style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#4f46e5', marginBottom: '0.5rem' }}>¡Felicidades!</h2>
                            <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>Muestra este código al cajero para reclamar tu 50% de descuento.</p>

                            <div style={{ background: 'white', padding: '1rem', borderRadius: '0.5rem', border: '2px dashed #4f46e5', display: 'inline-block', marginBottom: '1.5rem' }}>
                                <QRCode
                                    value={`${window.location.origin}/verify-coupon?customerId=${customer.id}&couponIndex=${nextCouponIndex}`}
                                    size={200}
                                />
                            </div>

                            <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Cupón #{nextCouponIndex} • Válido por un solo uso</p>

                            <button
                                onClick={() => setShowCouponModal(false)}
                                style={{
                                    marginTop: '1.5rem',
                                    width: '100%',
                                    padding: '0.75rem',
                                    backgroundColor: '#4f46e5',
                                    color: 'white',
                                    fontWeight: 'bold',
                                    borderRadius: '0.5rem',
                                    border: 'none',
                                    fontSize: '1rem'
                                }}
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                )}

                {/* PROMO WINNER CARD */}
                {showPromo && (
                    <div style={{ backgroundColor: '#4f46e5', color: 'white', borderRadius: '1rem', padding: '1rem', marginBottom: '0.75rem', textAlign: 'center', boxShadow: '0 10px 15px -3px rgba(79, 70, 229, 0.4)' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🎉</div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>¡Gracias x tu Feedback!</h2>
                        <p style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Tienes un</p>
                        <div style={{ fontSize: '2.5rem', fontWeight: '900', backgroundColor: 'white', color: '#4f46e5', display: 'inline-block', padding: '0.5rem 1.5rem', borderRadius: '0.5rem', transform: 'rotate(-2deg)' }}>
                            10% OFF
                        </div>
                        <p style={{ marginTop: '1rem', opacity: 0.9 }}>Muestra esta pantalla en tu próxima visita.</p>
                    </div>
                )}

                {/* FEEDBACK CARD (If available and not rated yet) */}
                {/* FEEDBACK MODAL (Replaces the inline card) */}
                {showFeedbackModal && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 9999,
                        display: 'flex', justifyContent: 'center', alignItems: 'center',
                        padding: '1rem'
                    }} onClick={() => setShowFeedbackModal(false)}>
                        <div style={{
                            backgroundColor: 'white', padding: '1.5rem',
                            borderRadius: '1rem', width: '100%', maxWidth: '400px',
                            textAlign: 'center'
                        }} onClick={e => e.stopPropagation()}>
                            <h3 style={{ fontWeight: 'bold', color: '#1e293b', marginBottom: '0.5rem', fontSize: '1.2rem' }}>¡Tu Opinión Cuenta!</h3>
                            <p style={{ color: '#64748b', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                                ¿Qué tal estuvo tu servicio de hoy?
                            </p>

                            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.8rem', marginBottom: '1.5rem' }}>
                                {[1, 2, 3, 4, 5].map(star => (
                                    <button key={star} onClick={() => setRating(star)} style={{ background: 'none', border: 'none', fontSize: '2.5rem', cursor: 'pointer', transition: 'transform 0.1s' }} onMouseDown={e => e.target.style.transform = 'scale(0.9)'} onMouseUp={e => e.target.style.transform = 'scale(1)'}>
                                        {star <= rating ? '⭐' : '☆'}
                                    </button>
                                ))}
                            </div>

                            {rating > 0 && (
                                <div style={{ animation: 'fadeIn 0.5s', textAlign: 'left' }}>
                                    <textarea
                                        placeholder="¿Algún comentario extra?"
                                        value={comment}
                                        onChange={e => setComment(e.target.value)}
                                        style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb', marginBottom: '1rem', fontFamily: 'inherit' }}
                                        rows="3"
                                    />
                                    <button
                                        onClick={() => {
                                            submitFeedback();
                                            setShowFeedbackModal(false);
                                        }}
                                        disabled={submittingFeedback}
                                        style={{ width: '100%', padding: '0.8rem', backgroundColor: '#EAB308', color: 'white', fontWeight: 'bold', borderRadius: '0.5rem', border: 'none', cursor: 'pointer', fontSize: '1rem' }}
                                    >
                                        {submittingFeedback ? 'Enviando...' : 'Enviar Calificación'}
                                    </button>
                                </div>
                            )}

                            <button
                                onClick={() => setShowFeedbackModal(false)}
                                style={{ marginTop: '1rem', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', textDecoration: 'underline' }}
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                )}


                {/* MEMBERSHIP SELECTION MODAL */}
                {showMembershipModal && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 9999,
                        display: 'flex', justifyContent: 'center', alignItems: 'center',
                        padding: '1rem'
                    }} onClick={() => setShowMembershipModal(false)}>
                        <div style={{
                            backgroundColor: '#f8fafc', padding: '0',
                            borderRadius: '1.5rem', width: '100%', maxWidth: '400px',
                            maxHeight: '85vh', overflowY: 'auto',
                            position: 'relative'
                        }} onClick={e => e.stopPropagation()}>

                            {/* Header */}
                            <div style={{
                                backgroundColor: 'white', padding: '1.5rem',
                                borderBottom: '1px solid #e2e8f0',
                                position: 'sticky', top: 0, zIndex: 10,
                                borderTopLeftRadius: '1.5rem', borderTopRightRadius: '1.5rem'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <h2 style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#1e293b' }}>Membresías</h2>
                                        <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Elige el plan ideal para ti</p>
                                    </div>
                                    <button onClick={() => setShowMembershipModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem', borderRadius: '50%', backgroundColor: '#f1f5f9' }}>
                                        <X size={20} color="#64748b" />
                                    </button>
                                </div>
                            </div>

                            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {!selectedPlanId ? availablePlans.map(plan => {
                                    const isUnlimited = (plan.type === 'unlimited' || plan.name.toLowerCase().includes('ilimitado') || plan.name.toLowerCase().includes('unlimited'));

                                    return (
                                        <div key={plan.id} style={{
                                            backgroundColor: isUnlimited ? '#f0fdf4' : 'white', // Light Green hint for unlimited
                                            background: isUnlimited ? 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)' : 'white',
                                            borderRadius: '1rem', padding: '1.5rem',
                                            boxShadow: isUnlimited ? '0 10px 15px -3px rgba(16, 185, 129, 0.2)' : '0 4px 6px -1px rgba(0,0,0,0.05)',
                                            border: isUnlimited ? '2px solid #10b981' : '1px solid #e2e8f0',
                                            position: 'relative', overflow: 'hidden',
                                            transform: isUnlimited ? 'scale(1.02)' : 'scale(1)',
                                            transition: 'all 0.2s',
                                            marginBottom: '1rem' // spacing fix
                                        }}>
                                            {isUnlimited && (
                                                <div style={{
                                                    position: 'absolute', top: '12px', right: '-30px',
                                                    backgroundColor: '#10b981', color: 'white',
                                                    fontSize: '0.7rem', fontWeight: 'bold',
                                                    padding: '0.2rem 2.5rem', transform: 'rotate(45deg)',
                                                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                                }}>
                                                    POPULAR
                                                </div>
                                            )}

                                            <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '0.2rem' }}>{plan.name}</h3>
                                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.2rem', marginBottom: '1rem' }}>
                                                <span style={{ fontSize: '1.8rem', fontWeight: '900', color: '#3b82f6' }}>${parseInt(plan.price)}</span>
                                                <span style={{ color: '#64748b' }}>/ mes</span>
                                            </div>

                                            <ul style={{ marginBottom: '1.5rem', paddingLeft: '1.2rem', color: '#475569', fontSize: '0.9rem', lineHeight: '1.6' }}>
                                                {plan.description ? plan.description.split('.').filter(i => i.trim()).map((feat, i) => (
                                                    <li key={i}>{feat.trim()}</li>
                                                )) : (
                                                    <li>Beneficios exclusivos</li>
                                                )}
                                            </ul>

                                            <button
                                                onClick={() => setSelectedPlanId(plan.id)}
                                                style={{
                                                    width: '100%', padding: '0.8rem',
                                                    backgroundColor: '#3b82f6', color: 'white',
                                                    fontWeight: 'bold', borderRadius: '0.8rem',
                                                    border: 'none', fontSize: '1rem',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                                                    cursor: 'pointer', boxShadow: '0 4px 6px rgba(59, 130, 246, 0.3)'
                                                }}
                                            >
                                                Seleccionar Plan
                                            </button>
                                        </div>
                                    );
                                }) : (
                                    <div style={{ padding: '0.5rem' }}>
                                        <div style={{ marginBottom: '1.5rem', backgroundColor: '#eff6ff', padding: '1.25rem', borderRadius: '1rem', border: '1px solid #bfdbfe' }}>
                                            <h4 style={{ fontWeight: 'bold', color: '#1e40af', marginBottom: '0.75rem' }}>Resumen de Suscripción:</h4>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#1e293b' }}>{availablePlans.find(p => p.id === selectedPlanId)?.name}</span>
                                                <span style={{ fontSize: '1.2rem', fontWeight: '900', color: '#3b82f6' }}>${availablePlans.find(p => p.id === selectedPlanId)?.price}/mes</span>
                                            </div>
                                            {selectedVehicleId && (
                                                <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#3b82f6', fontWeight: '600' }}>
                                                    🚗 Vinculado a: {getVehicleDisplayName(vehicles.find(v => v.id === selectedVehicleId), customer)}
                                                </div>
                                            )}
                                        </div>

                                        <div style={{ marginBottom: '1.5rem' }}>
                                            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}>
                                                <input 
                                                    type="checkbox" 
                                                    checked={acceptedTerms}
                                                    onChange={e => setAcceptedTerms(e.target.checked)}
                                                    style={{ width: '20px', height: '20px', marginTop: '0.1rem', cursor: 'pointer' }}
                                                />
                                                <span style={{ fontSize: '0.9rem', color: '#475569', lineHeight: '1.5' }}>
                                                    Acepto los términos y condiciones. Entiendo que esta es una suscripción mensual. Solo aplica al vehículo especificado.
                                                </span>
                                            </label>
                                        </div>

                                        <button 
                                            onClick={handleDownloadTerms}
                                            style={{ 
                                                width: '100%', padding: '0.75rem', backgroundColor: 'transparent',
                                                border: '1px solid #3b82f6', color: '#3b82f6', fontWeight: 'bold',
                                                borderRadius: '0.5rem', marginBottom: '1rem', cursor: 'pointer',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                                            }}
                                        >
                                            <FileText size={18} /> Leer Términos Completos
                                        </button>

                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button 
                                                onClick={() => { setSelectedPlanId(null); setAcceptedTerms(false); }}
                                                style={{ flex: 1, padding: '0.8rem', backgroundColor: '#f1f5f9', color: '#64748b', fontWeight: 'bold', borderRadius: '0.5rem', border: 'none', cursor: 'pointer' }}
                                            >
                                                Atrás
                                            </button>
                                            <button 
                                                onClick={handleSubscribe}
                                                disabled={!acceptedTerms || submittingSubscription}
                                                style={{ 
                                                    flex: 2, padding: '0.8rem', backgroundColor: '#10b981', color: 'white', fontWeight: 'bold', borderRadius: '0.5rem', border: 'none', 
                                                    cursor: (!acceptedTerms || submittingSubscription) ? 'not-allowed' : 'pointer',
                                                    opacity: (!acceptedTerms || submittingSubscription) ? 0.6 : 1
                                                }}
                                            >
                                                {submittingSubscription ? 'Procesando...' : 'Confirmar Petición'}
                                            </button>
                                        </div>
                                        <p style={{ textAlign: 'center', fontSize: '0.75rem', color: '#64748b', marginTop: '1rem' }}>
                                            Completarás tu suscripción al realizar el primer pago en el carwash.
                                        </p>
                                    </div>
                                )}
                            </div>

                            {!selectedPlanId && (
                                <div style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>
                                    Puedes cancelar en cualquier momento.
                                </div>
                            )}
                        </div>
                    </div>
                )}



                {/* PAYMENT METHODS CARD */}
                <div style={{ backgroundColor: '#10b981', color: 'white', borderRadius: '1rem', padding: '0.85rem', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', marginBottom: '0.75rem' }}>
                    <h3 style={{ fontWeight: 'bold', marginBottom: '0.75rem', fontSize: '1.05rem' }}>
                        💳 Métodos de Pago
                    </h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {/* CASH OPTION */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <div style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: '0.4rem', borderRadius: '0.5rem' }}>
                                <DollarSign size={20} color="white" />
                            </div>
                            <div style={{ fontSize: '0.95rem', fontWeight: '600' }}>Efectivo</div>
                        </div>

                        {/* Stripe OPTION */}
                        {stripeLink && (
                            <>
                                <hr style={{ borderColor: 'rgba(255,255,255,0.3)', margin: '0' }} />
                                <a
                                    href={`${stripeLink}${stripeLink.includes('?') ? '&' : '?'}__prefilled_amount=${Math.round((parseFloat(activeService?.price || 0) * 1.03) * 100)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.6rem',
                                        textDecoration: 'none',
                                        color: 'white',
                                        backgroundColor: 'rgba(255,255,255,0.1)',
                                        padding: '0.6rem',
                                        borderRadius: '0.6rem'
                                    }}
                                >
                                    <div style={{ backgroundColor: '#6366f1', padding: '0.4rem', borderRadius: '0.5rem' }}>
                                        <CreditCard size={20} color="white" />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '0.95rem', fontWeight: '600' }}>Pagar con Tarjeta</div>
                                        <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>
                                            Total: ${(parseFloat(activeService?.price || 0) * 1.03).toFixed(2)} (incl. 3%)
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '1rem', opacity: 0.7 }}>&rarr;</div>
                                </a>
                                <p style={{ fontSize: '0.65rem', opacity: 0.8, marginTop: '0.25rem', fontStyle: 'italic' }}>
                                    * Los pagos con tarjeta incluyen un cargo por procesamiento del 3%.
                                </p>
                            </>
                        )}

                        {/* LINE SEPARATOR */}
                        <hr style={{ borderColor: 'rgba(255,255,255,0.3)', margin: '0' }} />

                        {/* ATH MOVIL OPTION */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <div style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: '0.4rem', borderRadius: '0.5rem' }}>
                                <Phone size={20} color="white" />
                            </div>
                            <div>
                                <div style={{ fontSize: '0.95rem', fontWeight: '600' }}>ATH Móvil</div>
                                <div style={{ fontSize: '1.15rem', fontWeight: '800', marginTop: '0.1rem' }}>787-857-8983</div>
                                <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>Express CarWash</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* HISTORY LIST */}
                <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '1rem', paddingLeft: '0.5rem' }}>Historial Reciente</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                    {filteredHistory.map(tx => (
                        <div
                            key={tx.id}
                            onClick={() => setSelectedTxId(tx.id)}
                            style={{ backgroundColor: 'white', borderRadius: '0.8rem', padding: '1rem', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', cursor: 'pointer' }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                                <span style={{
                                    fontWeight: 'bold',
                                    color: getTransactionCategory(tx) === 'membership_usage' ? '#10b981' :
                                        getTransactionCategory(tx) === 'membership_sale' ? '#ec4899' : '#1e293b'
                                }}>
                                    {getTransactionCategory(tx) === 'membership_usage' ? 'Beneficio de Membresía' :
                                        getTransactionCategory(tx) === 'membership_sale' ? 'Renovación de Membresía' :
                                            (tx.services?.name || 'Servicio')}
                                </span>
                                <span style={{ color: '#64748b', fontSize: '0.9rem' }}>{new Date(tx.created_at).toLocaleDateString()}</span>
                            </div>
                            <div style={{ fontSize: '0.9rem', color: '#64748b' }}>
                                {(() => {
                                    // 1. Linked Vehicle
                                    const v = tx.vehicles || vehicles.find(v => v.id === tx.vehicle_id);
                                    if (v && (clean(v.brand) || clean(v.model))) {
                                        return `${getVehicleDisplayName(v, customer)} (${clean(v.plate) || 'Sin Placa'})`;
                                    }

                                    // 2. Transaction Metadata (FROM EXTRAS JSON)
                                    const extraBrand = Array.isArray(tx.extras) ? tx.extras.find(e => e.vehicle_brand)?.vehicle_brand : tx.extras?.vehicle_brand;
                                    const extraModel = Array.isArray(tx.extras) ? tx.extras.find(e => e.vehicle_model)?.vehicle_model : tx.extras?.vehicle_model;
                                    const extraPlate = Array.isArray(tx.extras) ? tx.extras.find(e => e.vehicle_plate)?.vehicle_plate : tx.extras?.vehicle_plate;

                                    if (clean(extraModel) || clean(extraPlate)) {
                                        return `${clean(extraBrand)} ${clean(extraModel) || 'Vehículo'} (${clean(extraPlate) || 'Sin Placa'})`.trim();
                                    }

                                    // 3. Customer Legacy
                                    if (v) return `${getVehicleDisplayName(v, customer)} (${clean(v.plate) || 'Sin Placa'})`;
                                    if (clean(customer?.vehicle_model) || clean(customer?.vehicle_plate)) {
                                        return `${clean(customer?.vehicle_brand)} ${clean(customer?.vehicle_model) || 'Vehículo'} (${clean(customer?.vehicle_plate) || 'Sin Placa'})`.trim();
                                    }

                                    return 'Vehículo no especificado';
                                })()}
                            </div>
                            <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', fontWeight: 'bold', color: tx.status === 'completed' || tx.status === 'paid' ? '#10b981' : '#f59e0b' }}>
                                {tx.status === 'completed' || tx.status === 'paid' ? 'Completado' : 'En Proceso'}
                            </div>
                        </div>
                    ))}
                    {filteredHistory.length === 0 && (
                        <p style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>No hay historial disponible para este vehículo.</p>
                    )}
                </div>

                {/* VERSION TAG */}
                <div style={{ textAlign: 'center', marginTop: '2rem', padding: '1rem', opacity: 0.3, fontSize: '0.7rem' }}>
                    Diseño Optimizado v1.2 Grid • {new Date().toLocaleTimeString()}
                </div>

                {/* DETAIL MODAL */}
                {selectedTransaction && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000,
                        padding: '1rem'
                    }} onClick={() => setSelectedTxId(null)}>
                        <div style={{ backgroundColor: 'white', width: '100%', maxWidth: '400px', borderRadius: '1rem', padding: '1rem', position: 'relative' }} onClick={e => e.stopPropagation()}>
                            <button onClick={() => setSelectedTxId(null)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}>
                                &times;
                            </button>

                            <h2 style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '0.5rem' }}>Detalle del Servicio</h2>
                            <p style={{ color: '#64748b', marginBottom: '1rem' }}>{new Date(selectedTransaction.created_at).toLocaleString()}</p>

                            <div style={{ marginBottom: '1rem', backgroundColor: '#f8fafc', padding: '0.75rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
                                <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Vehículo</div>
                                <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#1e293b' }}>
                                    {getVehicleDisplayName(selectedTransaction.vehicles || selectedTransaction, customer)}
                                </div>
                                <div style={{ fontSize: '0.9rem', color: '#3b82f6', fontWeight: '600', marginTop: '0.1rem' }}>
                                    {clean(selectedTransaction.vehicles?.plate) || clean(selectedTransaction.plate) || clean(customer?.vehicle_plate) || 'Sin Placa'}
                                </div>
                            </div>

                            <div style={{ marginBottom: '1rem' }}>
                                <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Servicios Realizados</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', backgroundColor: '#eff6ff', borderRadius: '0.5rem', borderLeft: '4px solid #3b82f6' }}>
                                        <span style={{ fontWeight: 'bold', color: '#1e40af', fontSize: '0.9rem' }}>{selectedTransaction.services?.name || 'Lavado'}</span>
                                        <span style={{ fontWeight: 'bold', color: '#1e40af', fontSize: '0.9rem' }}>${parseFloat(selectedTransaction.price || 0).toFixed(2)}</span>
                                    </div>
                                    {Array.isArray(selectedTransaction.extras) && selectedTransaction.extras.map((extra, idx) => (
                                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0.5rem', backgroundColor: '#f8fafc', borderRadius: '0.5rem', borderLeft: '4px solid #94a3b8', fontSize: '0.85rem' }}>
                                            <span style={{ color: '#475569' }}>{extra.description || 'Servicio Extra'}</span>
                                            <span style={{ fontWeight: '600', color: '#475569' }}>${parseFloat(extra.price || 0).toFixed(2)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div style={{ marginBottom: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Inicio</div>
                                    <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#000' }}>
                                        {selectedTransaction.started_at ? new Date(selectedTransaction.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) :
                                            (selectedTransaction.status === 'waiting' ? 'Pendiente' :
                                                new Date(selectedTransaction.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fin</div>
                                    <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#000' }}>{selectedTransaction.finished_at ? new Date(selectedTransaction.finished_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (selectedTransaction.status === 'ready' ? '---' : 'En proceso')}</div>
                                </div>
                                <div style={{ gridColumn: 'span 2' }}>
                                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tiempo en Proceso</div>
                                    <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#000' }}>
                                        {formatDuration(selectedTransaction.started_at || selectedTransaction.created_at, selectedTransaction.finished_at) || (selectedTransaction.status === 'waiting' ? '---' : 'Calculando...')}
                                    </div>
                                </div>
                            </div>

                            {/* PROGRESS BAR IN MODAL */}
                            {(selectedTransaction.status === 'in_progress' || selectedTransaction.status === 'waiting' || selectedTransaction.status === 'ready') && (
                                <div style={{ marginBottom: '1rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                                        <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Progreso</span>
                                        <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#3b82f6' }}>{calculateProgress(selectedTransaction)}%</span>
                                    </div>
                                    <div style={{ width: '100%', height: '10px', backgroundColor: '#e2e8f0', borderRadius: '5px', overflow: 'hidden', border: '1px solid #cbd5e1' }}>
                                        <div style={{
                                            width: `${calculateProgress(selectedTransaction)}%`,
                                            height: '100%',
                                            backgroundColor: calculateProgress(selectedTransaction) === 100 ? '#10b981' : '#3b82f6',
                                            borderRadius: '5px',
                                            transition: 'width 1s ease-in-out',
                                            backgroundImage: calculateProgress(selectedTransaction) < 100 ? 'linear-gradient(45deg, rgba(255,255,255,0.15) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.15) 75%, transparent 75%, transparent)' : 'none',
                                            backgroundSize: '1rem 1rem',
                                            animation: calculateProgress(selectedTransaction) < 100 ? 'progress-shimmer 2s linear infinite' : 'none'
                                        }}></div>
                                    </div>
                                </div>
                            )}

                            <div style={{ marginBottom: '1rem' }}>
                                <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Atendido por:</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    {selectedTransaction.transaction_assignments && selectedTransaction.transaction_assignments.length > 0 ? (
                                        selectedTransaction.transaction_assignments.map((assign, idx) => (
                                            <span key={idx} style={{
                                                backgroundColor: '#f1f5f9', color: '#334155',
                                                padding: '0.25rem 0.75rem', borderRadius: '0.5rem',
                                                fontSize: '0.9rem', fontWeight: '600',
                                                display: 'flex', alignItems: 'center', gap: '0.4rem',
                                                border: '1px solid #e2e8f0'
                                            }}>
                                                👤 {assign.employees?.name || 'Empleado'}
                                            </span>
                                        ))
                                    ) : (
                                        <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>Sin asignar aún</span>
                                    )}
                                </div>
                            </div>

                            <button
                                onClick={() => setSelectedTxId(null)}
                                style={{ width: '100%', padding: '0.85rem', backgroundColor: '#1e293b', color: 'white', fontWeight: 'bold', borderRadius: '0.75rem', border: 'none', cursor: 'pointer', fontSize: '1rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                )}

                <div style={{ textAlign: 'center', marginTop: '3rem', opacity: 0.5, fontSize: '0.8rem', paddingBottom: '2rem' }}>
                    <p>Express CarWash System v4.80</p>
                </div>
            </div>
        </div >
    );
};

export default CustomerPortal;
