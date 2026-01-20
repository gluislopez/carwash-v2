import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const ServiceAnalyticsChart = ({ transactions }) => {
    const [timeRange, setTimeRange] = useState('week'); // day, week, month, year

    const data = useMemo(() => {
        if (!transactions || transactions.length === 0) return [];

        const now = new Date();
        const groupedData = {};

        // Helper to get week number
        const getWeek = (date) => {
            const onejan = new Date(date.getFullYear(), 0, 1);
            return Math.ceil((((date - onejan) / 86400000) + onejan.getDay() + 1) / 7);
        };

        transactions.forEach(t => {
            const date = new Date(t.date); // Assuming t.date is ISO string or Date object
            let key;
            let label;
            let sortKey;

            if (timeRange === 'day') {
                // Last 7 days
                const diffTime = Math.abs(now - date);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                if (diffDays <= 7) {
                    key = date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });
                    sortKey = date.getTime();
                }
            } else if (timeRange === 'week') {
                // Last 8 weeks
                const diffTime = Math.abs(now - date);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                if (diffDays <= 56) {
                    const weekNum = getWeek(date);
                    key = `Sem ${weekNum}`;
                    sortKey = date.getTime(); // Approximate sorting
                }
            } else if (timeRange === 'month') {
                // Last 12 months
                const diffMonths = (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());
                if (diffMonths <= 12) {
                    key = date.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' });
                    sortKey = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
                }
            } else if (timeRange === 'year') {
                // Last 5 years
                key = date.getFullYear().toString();
                sortKey = date.getFullYear();
            }

            if (key) {
                if (!groupedData[key]) {
                    groupedData[key] = { name: key, count: 0, sortKey: sortKey };
                }
                groupedData[key].count += 1;
            }
        });

        return Object.values(groupedData).sort((a, b) => a.sortKey - b.sortKey);
    }, [transactions, timeRange]);

    return (
        <div className="card" style={{ marginBottom: '1rem', padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: '600' }}>Resumen de Servicios</h3>
                <div style={{ display: 'flex', gap: '0.25rem', backgroundColor: 'var(--bg-secondary)', padding: '0.25rem', borderRadius: '0.5rem' }}>
                    {['day', 'week', 'month', 'year'].map(range => (
                        <button
                            key={range}
                            onClick={() => setTimeRange(range)}
                            style={{
                                padding: '0.2rem 0.5rem',
                                borderRadius: '0.25rem',
                                border: 'none',
                                backgroundColor: timeRange === range ? 'var(--primary)' : 'transparent',
                                color: timeRange === range ? 'white' : 'var(--text-muted)',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                fontWeight: '500',
                                transition: 'all 0.2s'
                            }}
                        >
                            {range === 'day' ? 'Día' : range === 'week' ? 'Sem' : range === 'month' ? 'Mes' : 'Año'}
                        </button>
                    ))}
                </div>
            </div>

            <div style={{ height: '250px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                        <XAxis
                            dataKey="name"
                            stroke="var(--text-muted)"
                            fontSize={11}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            stroke="var(--text-muted)"
                            fontSize={11}
                            tickLine={false}
                            axisLine={false}
                            allowDecimals={false}
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: '0.5rem' }}
                            itemStyle={{ color: 'var(--text-main)' }}
                            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                        />
                        <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]}>
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill="url(#colorGradient)" />
                            ))}
                        </Bar>
                        <defs>
                            <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="var(--accent)" stopOpacity={0.8} />
                            </linearGradient>
                        </defs>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default ServiceAnalyticsChart;
