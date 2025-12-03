import React, { useEffect, useState } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { supabase } from './supabase'; // Asegúrate de que la ruta sea correcta

import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/DashboardPanel';
import Services from './pages/Services';
import Employees from './pages/Employees';
import Customers from './pages/Customers';
import Reports from './pages/Reports';
import Expenses from './pages/Expenses';
import GamificationSettings from './pages/GamificationSettings';

import Commissions from './pages/Commissions';
import TestDeployment from './pages/TestDeployment';

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
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: 'yellow', color: 'black', fontSize: '2rem', fontWeight: 'bold' }}>🟡 CARGANDO...</div>;
    }

    if (error) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: 'orange', color: 'white', padding: '20px', textAlign: 'center' }}>
                <h2>🟠 Error de Conexión</h2>
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

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({ error, errorInfo });
        console.error("Uncaught error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '2rem', color: '#DC2626', backgroundColor: '#FEF2F2', minHeight: '100vh', fontFamily: 'monospace' }}>
                    <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>💥 CRASH DETECTED</h1>
                    <div style={{ backgroundColor: 'white', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #FCA5A5', overflow: 'auto' }}>
                        <h3 style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Error:</h3>
                        <pre style={{ whiteSpace: 'pre-wrap', marginBottom: '1rem' }}>
                            {this.state.error && this.state.error.toString()}
                        </pre>
                        <h3 style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Stack:</h3>
                        <pre style={{ fontSize: '0.8rem', whiteSpace: 'pre-wrap' }}>
                            {this.state.errorInfo && this.state.errorInfo.componentStack}
                        </pre>
                    </div>
                    <button
                        onClick={() => window.location.reload()}
                        style={{ marginTop: '2rem', padding: '1rem 2rem', backgroundColor: '#DC2626', color: 'white', border: 'none', borderRadius: '0.5rem', fontSize: '1.2rem', cursor: 'pointer' }}
                    >
                        🔄 RECARGAR PÁGINA
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

const AppRoot = () => {
    return (
        <ErrorBoundary>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/test-deployment" element={<TestDeployment />} />

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

                                    <Route path="/commissions" element={<Commissions />} />
                                    <Route path="/gamification-settings" element={<GamificationSettings />} />
                                    <Route path="*" element={<Navigate to="/" replace />} />
                                </Routes>
                            </Layout>
                        </RequireAuth>
                    }
                />
            </Routes>
        </ErrorBoundary>
    );
};

export default AppRoot;
