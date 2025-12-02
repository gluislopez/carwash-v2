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

// Componente para proteger rutas
const RequireAuth = ({ children }) => {
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const location = useLocation();

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setLoading(false);
        });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });

        return () => subscription.unsubscribe();
    }, []);

    if (loading) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#0f172a', color: 'white' }}>Cargando...</div>;
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
