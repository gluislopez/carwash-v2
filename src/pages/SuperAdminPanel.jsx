import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabase';
import { useNavigate } from 'react-router-dom';
import {
    Building2, Users, DollarSign, TrendingUp, Shield,
    CheckCircle2, XCircle, Clock, Eye, Ban, RefreshCw,
    LogOut, BarChart3, AlertTriangle, Crown, Search
} from 'lucide-react';

/* ─────────────────────────── helpers ─────────────────────────── */
const PLAN_COLORS = {
    trial: '#f59e0b',
    starter: '#3b82f6',
    pro: '#8b5cf6',
    enterprise: '#22c55e',
};
const PLAN_PRICES = { trial: 0, starter: 29, pro: 59, enterprise: 99 };

const StatusBadge = ({ status }) => {
    const colors = {
        active: { bg: 'rgba(34,197,94,0.12)', color: '#22c55e', label: 'Activo' },
        suspended: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444', label: 'Suspendido' },
        cancelled: { bg: 'rgba(107,114,128,0.15)', color: '#6b7280', label: 'Cancelado' },
    };
    const c = colors[status] || colors.active;
    return (
        <span style={{ background: c.bg, color: c.color, padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '700' }}>
            {c.label}
        </span>
    );
};

/* ─────────────────────────── stat card ───────────────────────── */
const StatCard = ({ icon, label, value, sub, color }) => (
    <div style={{
        background: 'rgba(15,23,42,0.7)', border: `1px solid ${color}22`,
        borderRadius: '16px', padding: '1.25rem 1.5rem',
        display: 'flex', flexDirection: 'column', gap: '0.25rem'
    }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color, marginBottom: '0.4rem' }}>
            {icon}
            <span style={{ fontSize: '0.8rem', fontWeight: '600', opacity: 0.8 }}>{label}</span>
        </div>
        <div style={{ fontSize: '2rem', fontWeight: '900', color: 'white', lineHeight: 1 }}>{value}</div>
        {sub && <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{sub}</div>}
    </div>
);

/* ═══════════════════════════ MAIN PAGE ══════════════════════════ */
const SuperAdminPanel = () => {
    const navigate = useNavigate();
    const [orgs, setOrgs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterPlan, setFilterPlan] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [actionLoading, setActionLoading] = useState(null);
    const [selectedOrg, setSelectedOrg] = useState(null);

    /* ── Auth Guard ── */
    useEffect(() => {
        const checkRole = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) { navigate('/login'); return; }

            const { data: profile } = await supabase
                .from('user_profiles')
                .select('role')
                .eq('id', session.user.id)
                .single();

            if (!profile || profile.role !== 'superadmin') {
                alert('Acceso denegado. Esta sección es solo para superadministradores.');
                navigate('/dashboard');
            }
        };
        checkRole();
    }, [navigate]);

    /* ── Load Organizations ── */
    const loadOrgs = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('organizations')
            .select('*')
            .order('created_at', { ascending: false });

        if (!error && data) {
            // Enrich with customer/transaction counts (quick approximation)
            const enriched = await Promise.all(data.map(async org => {
                const [{ count: custCount }, { count: txCount }] = await Promise.all([
                    supabase.from('customers').select('id', { count: 'exact', head: true }).eq('organization_id', org.id),
                    supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('organization_id', org.id),
                ]);
                return { ...org, customer_count: custCount || 0, tx_count: txCount || 0 };
            }));
            setOrgs(enriched);
        }
        setLoading(false);
    }, []);

    useEffect(() => { loadOrgs(); }, [loadOrgs]);

    /* ── Actions ── */
    const toggleStatus = async (org) => {
        const newStatus = org.status === 'active' ? 'suspended' : 'active';
        setActionLoading(org.id);
        await supabase.from('organizations').update({ status: newStatus }).eq('id', org.id);
        await loadOrgs();
        setActionLoading(null);
    };

    const updatePlan = async (orgId, plan) => {
        setActionLoading(orgId);
        await supabase.from('organizations').update({ plan }).eq('id', orgId);
        await loadOrgs();
        setSelectedOrg(null);
        setActionLoading(null);
    };

    /* ── Derived Stats — exclude owner accounts from revenue ── */
    const billingOrgs = orgs.filter(o => !o.is_owner_account);  // exclude superadmin's own org
    const activeOrgs = orgs.filter(o => o.status === 'active');
    const activeBillingOrgs = billingOrgs.filter(o => o.status === 'active');
    const mrr = activeBillingOrgs.reduce((sum, o) => sum + (PLAN_PRICES[o.plan] || 0), 0);
    const trialOrgs = billingOrgs.filter(o => o.plan === 'trial').length;

    /* ── Filter ── */
    const filtered = orgs.filter(o => {
        const matchSearch = !search || o.name.toLowerCase().includes(search.toLowerCase()) || o.owner_email.toLowerCase().includes(search.toLowerCase());
        const matchPlan = filterPlan === 'all' || o.plan === filterPlan;
        const matchStatus = filterStatus === 'all' || o.status === filterStatus;
        return matchSearch && matchPlan && matchStatus;
    });

    /* ─────── Styles ─────── */
    const page = {
        minHeight: '100vh', background: '#080d1a',
        fontFamily: "'Outfit', sans-serif", color: 'white', padding: '2rem 1.5rem'
    };
    const tableCell = { padding: '1rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.875rem', color: '#cbd5e1', verticalAlign: 'middle' };
    const actionBtn = (color, hover) => ({
        padding: '0.4rem 0.75rem', borderRadius: '8px', border: 'none',
        background: `rgba(${color},0.12)`, color: `rgb(${color})`,
        cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600',
        display: 'flex', alignItems: 'center', gap: '0.3rem'
    });

    return (
        <div style={page}>
            {/* ── Header ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'linear-gradient(135deg, #f59e0b, #ef4444)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(245,158,11,0.4)' }}>
                        <Crown size={24} color="white" />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: '900', margin: 0, background: 'linear-gradient(135deg, #f59e0b, #ef4444)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                            Super Admin Panel
                        </h1>
                        <p style={{ color: '#475569', fontSize: '0.8rem', margin: 0 }}>CarWash Pro — Panel de Control Global</p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button onClick={loadOrgs} style={{ padding: '0.6rem 1rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem' }}>
                        <RefreshCw size={16} /> Actualizar
                    </button>
                    <button onClick={() => supabase.auth.signOut().then(() => navigate('/login'))} style={{ padding: '0.6rem 1rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem' }}>
                        <LogOut size={16} /> Salir
                    </button>
                </div>
            </div>

            {/* ── Stats Row ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                <StatCard icon={<Building2 size={18} />} label="Clientes Activos" value={billingOrgs.length} sub={`${activeBillingOrgs.length} activos`} color="#6366f1" />
                <StatCard icon={<DollarSign size={18} />} label="MRR" value={`$${mrr}`} sub="Ingresos mensuales recurrentes" color="#22c55e" />
                <StatCard icon={<AlertTriangle size={18} />} label="En Trial" value={trialOrgs} sub="Sin plan activo" color="#f59e0b" />
                <StatCard icon={<TrendingUp size={18} />} label="ARR Estimado" value={`$${mrr * 12}`} sub="Proyección anual" color="#8b5cf6" />
            </div>

            {/* ── Filters & Search ── */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center', background: 'rgba(15,23,42,0.6)', padding: '1rem 1.25rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ position: 'relative', flex: '1 1 200px', minWidth: '180px' }}>
                    <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
                    <input type="text" placeholder="Buscar negocio o email..." value={search} onChange={e => setSearch(e.target.value)}
                        style={{ width: '100%', paddingLeft: '2.25rem', padding: '0.6rem 0.75rem 0.6rem 2.25rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: 'white', outline: 'none', fontSize: '0.875rem', boxSizing: 'border-box' }} />
                </div>
                {['all', 'trial', 'starter', 'pro', 'enterprise'].map(p => (
                    <button key={p} onClick={() => setFilterPlan(p)} style={{ padding: '0.5rem 0.875rem', borderRadius: '8px', border: 'none', background: filterPlan === p ? (PLAN_COLORS[p] || '#6366f1') : 'rgba(255,255,255,0.05)', color: filterPlan === p ? 'white' : '#64748b', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600', transition: 'all 0.2s' }}>
                        {p === 'all' ? 'Todos' : p.charAt(0).toUpperCase() + p.slice(1)}
                    </button>
                ))}
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ padding: '0.5rem 0.75rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white', fontSize: '0.8rem', outline: 'none' }}>
                    <option value="all">Todos los estados</option>
                    <option value="active">Activos</option>
                    <option value="suspended">Suspendidos</option>
                    <option value="cancelled">Cancelados</option>
                </select>
            </div>

            {/* ── Table ── */}
            <div style={{ background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', overflow: 'hidden' }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: '#475569' }}>
                        <RefreshCw size={32} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 1rem', display: 'block' }} />
                        Cargando negocios...
                    </div>
                ) : filtered.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: '#475569' }}>
                        <Building2 size={40} style={{ margin: '0 auto 1rem', display: 'block', opacity: 0.3 }} />
                        No hay negocios que coincidan con los filtros.
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: 'rgba(0,0,0,0.3)' }}>
                                    {['Negocio', 'Email', 'Plan', 'Estado', 'Clientes', 'Transacciones', 'Registro', 'Acciones'].map(h => (
                                        <th key={h} style={{ padding: '0.875rem 1.25rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(org => (
                                    <tr key={org.id} style={{ transition: 'background 0.15s' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.04)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <td style={tableCell}>
                                            <div style={{ fontWeight: '700', color: 'white', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                {org.is_owner_account && <span title="Cuenta principal" style={{ fontSize: '0.7rem', background: 'rgba(245,158,11,0.15)', color: '#f59e0b', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: '800' }}>👑 OWNER</span>}
                                                {org.name}
                                            </div>
                                            {org.address && <div style={{ fontSize: '0.75rem', color: '#475569' }}>{org.address}</div>}
                                        </td>
                                        <td style={tableCell}>{org.owner_email}</td>
                                        <td style={tableCell}>
                                            <span style={{ padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '700', background: `${PLAN_COLORS[org.plan]}22`, color: PLAN_COLORS[org.plan] }}>
                                                {org.plan} {PLAN_PRICES[org.plan] > 0 ? `$${PLAN_PRICES[org.plan]}/mo` : ''}
                                            </span>
                                        </td>
                                        <td style={tableCell}><StatusBadge status={org.status} /></td>
                                        <td style={{ ...tableCell, textAlign: 'center' }}>{org.customer_count}</td>
                                        <td style={{ ...tableCell, textAlign: 'center' }}>{org.tx_count}</td>
                                        <td style={{ ...tableCell, whiteSpace: 'nowrap' }}>
                                            {org.created_at ? new Date(org.created_at).toLocaleDateString('es-PR') : '—'}
                                        </td>
                                        <td style={tableCell}>
                                            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'nowrap', alignItems: 'center' }}>
                                                {/* Change Plan */}
                                                <button onClick={() => setSelectedOrg(selectedOrg?.id === org.id ? null : org)} style={actionBtn('99,102,241', '#6366f1')}>
                                                    <BarChart3 size={13} /> Plan
                                                </button>
                                                {/* Suspend / Activate — hidden for owner account */}
                                                {!org.is_owner_account && (
                                                    <button onClick={() => toggleStatus(org)} disabled={actionLoading === org.id} style={actionBtn(org.status === 'active' ? '239,68,68' : '34,197,94')}>
                                                        {org.status === 'active'
                                                            ? <><Ban size={13} /> Suspender</>
                                                            : <><CheckCircle2 size={13} /> Activar</>}
                                                    </button>
                                                )}
                                            </div>
                                            {/* Plan selector dropdown */}
                                            {selectedOrg?.id === org.id && (
                                                <div style={{ marginTop: '0.5rem', background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.3rem', minWidth: '140px' }}>
                                                    {['trial', 'starter', 'pro', 'enterprise'].map(p => (
                                                        <button key={p} onClick={() => updatePlan(org.id, p)} style={{ padding: '0.4rem 0.6rem', background: org.plan === p ? `${PLAN_COLORS[p]}22` : 'transparent', color: PLAN_COLORS[p], border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600', textAlign: 'left' }}>
                                                            {p.charAt(0).toUpperCase() + p.slice(1)} — ${PLAN_PRICES[p]}/mo
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <p style={{ textAlign: 'center', color: '#1e293b', fontSize: '0.75rem', marginTop: '2rem' }}>
                CarWash Pro SaaS — Super Admin Panel • Solo para uso interno
            </p>
            <style>{`@keyframes spin{100%{transform:rotate(360deg)}}`}</style>
        </div>
    );
};

export default SuperAdminPanel;
