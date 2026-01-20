import React, { useMemo } from 'react';
import { Award, Phone, ExternalLink, Calendar } from 'lucide-react';

const TopCustomersReport = ({ transactions, customers }) => {
    const stats = useMemo(() => {
        if (!transactions || !customers) return [];

        const customerStats = {};

        transactions.forEach(t => {
            if (!t.customer_id) return;

            // Skip cancelled
            if (t.status === 'cancelled') return;

            if (!customerStats[t.customer_id]) {
                customerStats[t.customer_id] = {
                    id: t.customer_id,
                    spent: 0,
                    visits: 0,
                    lastVisit: null
                };
            }

            const total = parseFloat(t.price || 0) + (t.extras?.reduce((s, e) => s + e.price, 0) || 0);
            customerStats[t.customer_id].spent += total;
            customerStats[t.customer_id].visits += 1;

            const txDate = new Date(t.date);
            if (!customerStats[t.customer_id].lastVisit || txDate > customerStats[t.customer_id].lastVisit) {
                customerStats[t.customer_id].lastVisit = txDate;
            }
        });

        // Enrich with name/phone and sort
        return Object.values(customerStats)
            .map(stat => {
                const customer = customers.find(c => c.id === stat.id);
                return {
                    ...stat,
                    name: customer?.name || 'Desconocido',
                    phone: customer?.phone || '',
                    isVip: stat.visits >= 5 || stat.spent > 200 // Custom logic
                };
            })
            .sort((a, b) => b.spent - a.spent)
            .slice(0, 20); // Top 20

    }, [transactions, customers]);

    const handleCopyPhone = (phone) => {
        const cleanPhone = phone.replace(/\D/g, '');
        navigator.clipboard.writeText(cleanPhone);
        alert(`Teléfono copiado: ${cleanPhone}`);
    };

    return (
        <div className="card" style={{ padding: '1.5rem', backgroundColor: 'white', borderRadius: '1rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '1.5rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Award size={20} color="#f59e0b" /> Top Clientes VIP
            </h3>

            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '2px solid #f1f5f9', textAlign: 'left', color: '#64748b', fontSize: '0.85rem' }}>
                            <th style={{ padding: '0.75rem' }}>Cliente</th>
                            <th style={{ padding: '0.75rem' }}>Visitas</th>
                            <th style={{ padding: '0.75rem' }}>Total Gastado</th>
                            <th style={{ padding: '0.75rem' }}>Última Visita</th>
                            <th style={{ padding: '0.75rem', textAlign: 'right' }}>Acción</th>
                        </tr>
                    </thead>
                    <tbody>
                        {stats.map((c, idx) => (
                            <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9', fontSize: '0.9rem' }}>
                                <td style={{ padding: '0.75rem', fontWeight: '500' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span style={{
                                            width: '24px', height: '24px', borderRadius: '50%', backgroundColor: idx < 3 ? '#fbbf24' : '#f1f5f9',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold', color: idx < 3 ? 'white' : '#64748b'
                                        }}>
                                            {idx + 1}
                                        </span>
                                        <span style={{ color: 'black' }}>{c.name}</span>
                                    </div>
                                    {c.phone && <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginLeft: '2rem' }}>{c.phone}</div>}
                                </td>
                                <td style={{ padding: '0.75rem' }}>
                                    <span style={{ backgroundColor: '#eff6ff', color: '#3b82f6', padding: '0.2rem 0.6rem', borderRadius: '1rem', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                        {c.visits}
                                    </span>
                                </td>
                                <td style={{ padding: '0.75rem', fontWeight: 'bold', color: '#10b981' }}>
                                    ${c.spent.toFixed(2)}
                                </td>
                                <td style={{ padding: '0.75rem', color: '#64748b', fontSize: '0.85rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                        <Calendar size={14} />
                                        {c.lastVisit?.toLocaleDateString()}
                                    </div>
                                </td>
                                <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                                    {c.phone && (
                                        <button
                                            onClick={() => handleCopyPhone(c.phone)}
                                            style={{ border: '1px solid #e2e8f0', background: 'white', padding: '0.4rem', borderRadius: '0.4rem', cursor: 'pointer', color: '#64748b' }}
                                            title="Copiar Teléfono"
                                        >
                                            <Phone size={16} />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {stats.length === 0 && (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>No hay suficientes datos aún.</div>
            )}
        </div>
    );
};

export default TopCustomersReport;
