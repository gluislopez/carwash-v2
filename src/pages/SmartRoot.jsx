import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';

const SmartRoot = () => {
    const navigate = useNavigate();
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        const checkRouting = async () => {
            // 1. Check for Active Session (Admin/Employee)
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                // User is logged in, go to Dashboard
                navigate('/dashboard', { replace: true });
                return;
            }

            // 2. Check for Saved Client ID (PWA Mode)
            const savedClientId = localStorage.getItem('my_carwash_id');
            if (savedClientId) {
                // Client has "installed" the app, go to their portal
                navigate(`/portal/${savedClientId}`, { replace: true });
                return;
            }

            // 3. Default: Login
            navigate('/login', { replace: true });
        };

        checkRouting();
    }, [navigate]);

    return (
        <div style={{
            display: 'flex', flexDirection: 'column',
            justifyContent: 'center', alignItems: 'center',
            height: '100vh', backgroundColor: '#0f172a', color: 'white'
        }}>
            <div style={{
                width: '50px', height: '50px',
                border: '4px solid #3b82f6', borderTopColor: 'transparent',
                borderRadius: '50%', animation: 'spin 1s linear infinite'
            }} />
            <h2 style={{ marginTop: '1rem', fontFamily: 'sans-serif' }}>Cargando App...</h2>
            <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

export default SmartRoot;
