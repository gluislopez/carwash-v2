export class VehiclesView {
    constructor(store) {
        this.store = store;
    }

    render(container) {
        // For simplicity, we'll just show a list. 
        // Ideally, adding a vehicle should be done from the Customer view or POS.
        // Here we can list all vehicles.

        container.innerHTML = `
            <div class="fade-in">
                <div class="view-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                    <h2>Inventario de Vehículos</h2>
                    <!-- <button class="btn btn-primary">+ Nuevo Vehículo</button> -->
                </div>

                <div class="card">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="text-align: left; border-bottom: 1px solid var(--border-color);">
                                <th style="padding: 1rem; color: var(--text-muted);">Placa</th>
                                <th style="padding: 1rem; color: var(--text-muted);">Marca/Modelo</th>
                                <th style="padding: 1rem; color: var(--text-muted);">Color</th>
                                <th style="padding: 1rem; color: var(--text-muted);">Dueño</th>
                            </tr>
                        </thead>
                        <tbody id="vehicles-table-body">
                            <!-- Rows will be populated here -->
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        this.renderTable();
    }

    renderTable() {
        const tbody = document.getElementById('vehicles-table-body');
        const vehicles = this.store.getVehicles();
        const customers = this.store.getCustomers();

        if (vehicles.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="padding: 2rem; text-align: center; color: var(--text-muted);">No hay vehículos registrados.</td></tr>`;
            return;
        }

        tbody.innerHTML = vehicles.map(v => {
            const owner = customers.find(c => c.id === v.customerId);
            return `
            <tr style="border-bottom: 1px solid var(--border-color);">
                <td style="padding: 1rem; font-weight: 700;">${v.plate}</td>
                <td style="padding: 1rem;">${v.brand} ${v.model}</td>
                <td style="padding: 1rem;">
                    <span style="display: inline-block; width: 12px; height: 12px; background-color: ${v.color}; border-radius: 50%; margin-right: 5px; border: 1px solid #fff;"></span>
                    ${v.colorName || ''}
                </td>
                <td style="padding: 1rem;">${owner ? owner.name : 'Desconocido'}</td>
            </tr>
        `}).join('');
    }
}
