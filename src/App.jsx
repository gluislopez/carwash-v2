import React, { useEffect, useState } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { supabase } from './supabase'; // Asegúrate de que la ruta sea correcta

import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Services from './pages/Services';
import Employees from './pages/Employees';
import Customers from './pages/Customers';
import Reports from './pages/Reports';
import Expenses from './pages/Expenses';

// Componente para proteger rutas
const RequireAuth = ({ children }) => {
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const location = useLocation();

    useEffect(() => {
        // Timeout de seguridad: si Supabase no responde en 5 segundos, mostramos error
        const timer = setTimeout(() => {
            if (loading) {
                setLoading(false);
                setError("Tiempo de espera agotado conectando a Supabase. Verifica tu conexión o configuración.");
            }
        }, 5000);

        supabase.auth.getSession().then(({ data: { session }, error }) => {
            if (error) {
                console.error("Error getting session:", error);
                setError(error.message);
            }
            setSession(session);
            setLoading(false);
            clearTimeout(timer);
        }).catch(err => {
            console.error("Critical Auth Error:", err);
            setError(err.message || "Error desconocido al iniciar sesión");
            setLoading(false);
            clearTimeout(timer);
        });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });

        return () => {
            subscription.unsubscribe();
            clearTimeout(timer);
        };
    }, []);

    if (loading) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#0f172a', color: 'white' }}>Cargando... (Esperando a Supabase)</div>;
    }

    if (error) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#0f172a', color: 'red', padding: '20px', textAlign: 'center' }}>
                <h2>Error de Conexión</h2>
                <p>{error}</p>
                <button onClick={() => window.location.reload()} style={{ marginTop: '20px', padding: '10px 20px' }}>Reintentar</button>
            </div>
        );
    }

    if (!session) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return children;
};

function App() {
    return (
        <Routes>
            <Route path="/login" element={<Login />} />

            <Route
                path="*"
                element={
                    <RequireAuth>
                        <Layout>
                            <Routes>
                                <Route path="/" element={<Dashboard />} />
                                <Route path="/services" element={<Services />} />
                                <Route path="/employees" element={<Employees />} />
                                <Route path="/customers" element={<Customers />} />
                                <Route path="/reports" element={<Reports />} />
                                <Route path="/expenses" element={<Expenses />} />
                                <Route path="/gamification-settings" element={<GamificationSettings />} />
                                <Route path="/settings" element={<div>Configuración (Próximamente)</div>} />
                            </Routes>
                        </Layout>
                    </RequireAuth>
                }
            />
        </Routes>
    );
}

export default App;
