import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const EmployeeProductivityChart = ({ transactions, employees }) => {
    const data = useMemo(() => {
        if (!transactions || transactions.length === 0) return [];

        const employeeCounts = {};

        transactions.forEach(t => {
            // Only count completed/paid transactions
            if (t.status === 'completed' || t.status === 'paid') {
                // Handle assignments
                if (t.transaction_assignments && t.transaction_assignments.length > 0) {
                    t.transaction_assignments.forEach(a => {
                        const empId = a.employee_id;
                        if (!employeeCounts[empId]) employeeCounts[empId] = 0;
                        employeeCounts[empId] += 1;
                    });
                } else if (t.employee_id) {
                    // Fallback for legacy data
                    const empId = t.employee_id;
                    if (!employeeCounts[empId]) employeeCounts[empId] = 0;
                    employeeCounts[empId] += 1;
                }
            }
        });

        // Map to array and add names
        return Object.keys(employeeCounts).map(empId => {
            const employee = employees.find(e => e.id === empId);
            return {
                name: employee ? employee.name.split(' ')[0] : 'Desc.', // First name only
                fullName: employee ? employee.name : 'Desconocido',
                count: employeeCounts[empId]
            };
        }).sort((a, b) => b.count - a.count); // Sort by count descending

    }, [transactions, employees]);

    if (data.length === 0) {
        return (
            <div className="card" style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <p>No hay datos de productividad hoy.</p>
            </div>
        );
    }

    return (
        <div className="card" style={{ marginBottom: '2rem', padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1rem' }}>🏆 Productividad de Empleados (Hoy)</h3>
            <div style={{ height: '250px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" horizontal={false} />
                        <XAxis type="number" hide />
                        <YAxis
                            dataKey="name"
                            type="category"
                            stroke="var(--text-main)"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            width={80}
                        />
                        <Tooltip
                            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                            contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: '0.5rem' }}
                            itemStyle={{ color: 'var(--text-main)' }}
                            formatter={(value) => [`${value} autos`, 'Lavados']}
                            labelFormatter={(label, payload) => {
                                if (payload && payload.length > 0) {
                                    return payload[0].payload.fullName;
                                }
                                return label;
                            }}
                        />
                        <Bar dataKey="count" fill="var(--primary)" radius={[0, 4, 4, 0]} barSize={20}>
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={index === 0 ? '#F59E0B' : index === 1 ? '#9CA3AF' : index === 2 ? '#B45309' : 'var(--primary)'} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default EmployeeProductivityChart;
