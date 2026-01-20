import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const PeakHoursChart = ({ transactions }) => {
    const data = useMemo(() => {
        if (!transactions || transactions.length === 0) return [];

        // Initialize hours 8 AM to 6 PM (18:00)
        const hoursMap = {};
        for (let i = 8; i <= 18; i++) {
            const label = i <= 12 ? `${i} AM` : `${i - 12} PM`;
            hoursMap[i] = { hour: i, label: label, count: 0 };
        }

        transactions.forEach(t => {
            const dateStr = t.started_at || t.created_at;
            if (!dateStr) return;

            const date = new Date(dateStr);
            const hour = date.getHours();

            // Only count relevant business hours
            if (hour >= 8 && hour <= 18) {
                hoursMap[hour].count += 1;
            }
        });

        return Object.values(hoursMap);
    }, [transactions]);

    return (
        <div className="card" style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: 'white', borderRadius: '1rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '1rem', color: '#1e293b' }}>
                🔥 Horas Pico
            </h3>

            <div style={{ height: '250px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis
                            dataKey="label"
                            stroke="#64748b"
                            fontSize={11}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            stroke="#64748b"
                            fontSize={11}
                            tickLine={false}
                            axisLine={false}
                            allowDecimals={false}
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: 'white', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}
                            itemStyle={{ color: '#1e293b' }}
                            cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
                        />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.count > 5 ? '#ef4444' : (entry.count > 2 ? '#f59e0b' : '#3b82f6')} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
            <p style={{ marginTop: '1rem', fontSize: '0.75rem', color: '#94a3b8', textAlign: 'center' }}>
                * Rojo: Muy Alto | Amarillo: Moderado | Azul: Normal
            </p>
        </div>
    );
};

export default PeakHoursChart;
