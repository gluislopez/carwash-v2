import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';

const SmartRoot = () => {
    const navigate = useNavigate();

    useEffect(() => {
        const checkRouting = async () => {
            // Give storage/cookies a moment to settle in PWA mode
            await new Promise(resolve => setTimeout(resolve, 500));

            // 1. Check for Active Session (Admin/Employee/Owner)
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                const userId = session.user.id;

                // Check if this user has a profile (multi-tenant) or is a legacy employee
                const { data: profile } = await supabase
                    .from('user_profiles')
                    .select('role, organization_id, organizations(onboarding_completed, name)')
                    .eq('id', userId)
                    .single();

                if (profile && (profile.role === 'owner' || profile.role === 'superadmin')) {
                    // Owner: check if onboarding is done
                    const org = profile.organizations;
                    if (org && !org.onboarding_completed) {
                        navigate('/onboarding', { replace: true });
                    } else {
                        navigate('/dashboard', { replace: true });
                    }
                } else {
                    // Legacy employee or no profile → go to dashboard
                    navigate('/dashboard', { replace: true });
                }
                return;
            }

            // 2. Check for Saved Client ID (PWA Mode)
            let savedClientId = localStorage.getItem('my_carwash_id');

            // Fallback for cookie (iOS PWA)
            if (!savedClientId) {
                const cookieValue = document.cookie
                    .split('; ')
                    .find(row => row.startsWith('my_carwash_id='))
                    ?.split('=')[1];
                if (cookieValue) {
                    savedClientId = cookieValue;
                    localStorage.setItem('my_carwash_id', savedClientId);
                }
            }

            if (savedClientId && savedClientId !== 'null' && savedClientId !== 'undefined') {
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
                border: '4px solid #6366f1', borderTopColor: 'transparent',
                borderRadius: '50%', animation: 'spin 1s linear infinite'
            }} />
            <h2 style={{ marginTop: '1rem', fontFamily: "'Outfit', sans-serif" }}>Cargando...</h2>
            <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

export default SmartRoot;
