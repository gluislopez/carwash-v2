import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, ShoppingBag, FileText, Settings, Menu, X, LogOut, User } from 'lucide-react';
import { supabase } from '../supabase';

const Layout = ({ children }) => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [userEmail, setUserEmail] = useState('');
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUserEmail(user.email);
            }
        };
        getUser();
    }, []);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };

    const navItems = [
        { path: '/', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
        { path: '/services', label: 'Servicios', icon: <ShoppingBag size={20} /> },
        { path: '/customers', label: 'Clientes', icon: <Users size={20} /> },
        { path: '/employees', label: 'Empleados', icon: <Users size={20} /> },
        { path: '/reports', label: 'Reportes', icon: <FileText size={20} /> },
        // { path: '/settings', label: 'Configuración', icon: <Settings size={20} /> },
    ];

    return (
        <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)' }}>
            {/* Mobile Menu Button */}
            <button
                className="mobile-menu-btn"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                style={{
                    position: 'fixed', top: '1rem', right: '1rem', zIndex: 100,
                    padding: '0.5rem', borderRadius: '0.5rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)',
                    display: 'none' // Hidden on desktop via CSS (need to ensure media query exists)
                }}
            >
                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            {/* Sidebar */}
            <aside style={{
                width: '250px',
                backgroundColor: 'var(--bg-card)',
                borderRight: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                padding: '1.5rem',
                position: 'fixed', // Fixed for desktop
                height: '100vh',
                transition: 'transform 0.3s ease',
                // transform removed to let CSS handle mobile state
                zIndex: 50
            }} className={`sidebar ${isMobileMenuOpen ? 'open' : ''}`}>

                <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <img src="/logo.jpg" alt="CarWash Logo" style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover' }} />
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>CarWash SaaS</h2>
                    </div>
                    {/* Close button for mobile */}
                    <button
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="mobile-close-btn"
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'none' }}
                    >
                        <X size={24} />
                    </button>
                </div>

                <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                onClick={() => setIsMobileMenuOpen(false)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    padding: '0.75rem 1rem',
                                    borderRadius: '0.5rem',
                                    textDecoration: 'none',
                                    color: isActive ? 'white' : 'var(--text-muted)',
                                    backgroundColor: isActive ? 'var(--primary)' : 'transparent',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                {item.icon}
                                <span>{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>

                {/* User Profile Section */}
                <div style={{
                    marginTop: 'auto',
                    paddingTop: '1rem',
                    borderTop: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                            width: '36px', height: '36px', borderRadius: '50%',
                            backgroundColor: 'var(--bg-secondary)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'var(--text-muted)'
                        }}>
                            <User size={20} />
                        </div>
                        <div style={{ overflow: 'hidden' }}>
                            <p style={{ fontSize: '0.85rem', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Usuario</p>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={userEmail}>
                                {userEmail || 'Cargando...'}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={handleLogout}
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                            width: '100%', padding: '0.75rem',
                            backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)',
                            border: 'none', borderRadius: '0.5rem', cursor: 'pointer',
                            fontSize: '0.9rem', fontWeight: '500',
                            transition: 'background 0.2s'
                        }}
                    >
                        <LogOut size={18} />
                        Cerrar Sesión
                    </button>
                </div>
            </aside>

            {/* Main Content Wrapper */}
            <main style={{
                flex: 1,
                marginLeft: '250px', // Offset for fixed sidebar
                padding: '2rem',
                width: 'calc(100% - 250px)'
            }} className="main-content">
                {children}
            </main>

            {/* Mobile Overlay */}
            {isMobileMenuOpen && (
                <div
                    onClick={() => setIsMobileMenuOpen(false)}
                    style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 40
                    }}
                />
            )}

            {/* Global Print Styles */}
            <style>{`
                @media print {
                    .sidebar, .mobile-menu-btn { display: none !important; }
                    .main-content { margin-left: 0 !important; width: 100% !important; padding: 0 !important; }
                    body { background-color: white !important; }
                }
            `}</style>
        </div>
    );
};

export default Layout;
