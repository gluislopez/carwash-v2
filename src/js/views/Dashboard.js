export class DashboardView {
    constructor(store) {
        this.store = store;
    }

    render(container) {
        const customers = this.store.getCustomers();
        const services = this.store.getServices();

        // Calculate basic stats
        const totalCustomers = customers.length;
        const totalServices = services.length;
        const revenue = 0; // Placeholder for now

        container.innerHTML = `
            <div class="fade-in">
                <div class="stats-grid">
                    ${this.createStatCard('Clientes Totales', totalCustomers, '👥', 'var(--primary)')}
                    ${this.createStatCard('Servicios Activos', totalServices, '✨', 'var(--secondary)')}
                    ${this.createStatCard('Ventas Hoy', '$' + revenue, '💰', 'var(--accent)')}
                </div>

                <div class="dashboard-sections" style="margin-top: 2rem; display: grid; grid-template-columns: 2fr 1fr; gap: 2rem;">
                    <div class="card">
                        <h3>Actividad Reciente</h3>
                        <p style="color: var(--text-muted); margin-top: 1rem;">No hay actividad reciente.</p>
                    </div>
                    <div class="card">
                        <h3>Accesos Rápidos</h3>
                        <div style="display: flex; gap: 1rem; margin-top: 1rem; flex-wrap: wrap;">
                            <button class="btn btn-primary" onclick="window.location.hash = '#pos'">Nueva Venta</button>
                            <button class="btn" style="border: 1px solid var(--border-color); color: var(--text-main);" onclick="window.location.hash = '#customers'">+ Cliente</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    createStatCard(title, value, icon, color) {
        return `
            <div class="card stat-card" style="display: flex; align-items: center; gap: 1.5rem;">
                <div class="stat-icon" style="
                    width: 50px; height: 50px; 
                    border-radius: 12px; 
                    background: ${color}20; 
                    color: ${color};
                    display: flex; align-items: center; justify-content: center;
                    font-size: 1.5rem;
                ">
                    ${icon}
                </div>
                <div>
                    <p style="color: var(--text-muted); font-size: 0.9rem;">${title}</p>
                    <h3 style="font-size: 1.8rem; font-weight: 700;">${value}</h3>
                </div>
            </div>
        `;
    }
}
