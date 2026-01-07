import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Loader, Gift } from 'lucide-react';
import { supabase } from '../supabase';

const CouponVerifier = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const customerId = searchParams.get('customerId');
    const couponIndex = searchParams.get('couponIndex'); // e.g., 1 for 1st coupon (5th visit), 2 for 2nd (10th)

    const [status, setStatus] = useState('loading'); // loading, valid, invalid, used, error
    const [customer, setCustomer] = useState(null);
    const [verifyingDetails, setVerifyingDetails] = useState(null);

    useEffect(() => {
        checkCoupon();
    }, [customerId, couponIndex]);

    const checkCoupon = async () => {
        if (!customerId || !couponIndex) {
            setStatus('error');
            return;
        }

        try {
            // 1. Get Customer & Transaction Count
            const { data: cust, error: custError } = await supabase
                .from('customers')
                .select('*, transactions(count)')
                .eq('id', customerId)
                .single();

            if (custError || !cust) throw new Error('Cliente no encontrado');
            setCustomer(cust);

            // Fetch actual count manually if aggregate not working easily or precise count needed
            const { count: visitCount, error: countError } = await supabase
                .from('transactions')
                .select('*', { count: 'exact', head: true })
                .eq('customer_id', customerId);

            if (countError) throw countError;

            const couponsEarned = Math.floor(visitCount / 5);
            const couponsRedeemed = cust.redeemed_coupons || 0;
            const targetCouponIndex = parseInt(couponIndex);

            setVerifyingDetails({
                visitCount,
                couponsEarned,
                couponsRedeemed,
                targetCouponIndex
            });

            // LOGIC CHECKS
            if (targetCouponIndex > couponsEarned) {
                // Trying to redeem a coupon they haven't earned yet (e.g. trying to redeem #2 but only visited 8 times)
                setStatus('invalid');
            } else if (targetCouponIndex <= couponsRedeemed) {
                // Already redeemed this one (e.g. redeeming #1, but redeemed_coupons is 1 or more)
                setStatus('used');
            } else if (targetCouponIndex === couponsRedeemed + 1) {
                // Exactly the next available coupon
                setStatus('valid');
            } else {
                // trying to redeem #3 when haven't redeemed #2? 
                // Flexible policy: Allow redeeming ANY unredeemed earned coupon.
                // Strict policy: Must redeem in order. Let's start with IN ORDER for simplicity.
                setStatus('error_sequence');
            }

        } catch (err) {
            console.error(err);
            setStatus('error');
        }
    };

    const handleRedeem = async () => {
        try {
            const newCount = (customer.redeemed_coupons || 0) + 1;
            const { error } = await supabase
                .from('customers')
                .update({ redeemed_coupons: newCount })
                .eq('id', customerId);

            if (error) throw error;
            setStatus('success');
        } catch (err) {
            alert('Error al canjear: ' + err.message);
        }
    };

    if (status === 'loading') return <div className="p-8 text-center">Verificando...</div>;

    return (
        <div style={{ maxWidth: '400px', margin: '2rem auto', padding: '1rem', textAlign: 'center' }}>
            <div className="card" style={{ padding: '2rem' }}>
                {status === 'valid' && (
                    <>
                        <Gift size={64} className="text-primary mx-auto mb-4" />
                        <h1 className="text-2xl font-bold mb-2">¡Cupón Válido!</h1>
                        <p className="mb-4">Cliente: <strong>{customer.name}</strong></p>
                        <div className="bg-green-100 text-green-800 p-3 rounded mb-6">
                            10% OFF en este servicio
                            <div className="text-sm opacity-75">Cupón #{couponIndex} (Visita #{verifyingDetails?.visitCount})</div>
                        </div>
                        <button onClick={handleRedeem} className="btn btn-primary w-full text-lg py-3">
                            ✅ CANJEAR AHORA
                        </button>
                    </>
                )}

                {status === 'used' && (
                    <>
                        <XCircle size={64} className="text-gray-400 mx-auto mb-4" />
                        <h1 className="text-xl font-bold text-gray-500 mb-2">Este cupón ya fue usado</h1>
                        <p className="text-sm text-gray-400">Canjeado anteriormente.</p>
                        <button onClick={() => navigate('/dashboard')} className="btn mt-6">Volver al Dashboard</button>
                    </>
                )}

                {status === 'invalid' && (
                    <>
                        <XCircle size={64} className="text-red-500 mx-auto mb-4" />
                        <h1 className="text-xl font-bold text-red-600 mb-2">Cupón Inválido</h1>
                        <p className="mb-2">El cliente aún no cumple los requisitos.</p>
                        <p className="text-sm">Visitas actuales: {verifyingDetails?.visitCount} (Necesita {parseInt(couponIndex) * 5})</p>
                    </>
                )}

                {status === 'success' && (
                    <>
                        <CheckCircle size={64} className="text-green-500 mx-auto mb-4" />
                        <h1 className="text-2xl font-bold text-green-600 mb-2">¡Canjeado con Éxito!</h1>
                        <p>Puedes aplicar el descuento en la venta.</p>
                        <button onClick={() => navigate('/dashboard')} className="btn btn-primary mt-6">Ir al Dashboard</button>
                    </>
                )}
            </div>
        </div>
    );
};

export default CouponVerifier;
