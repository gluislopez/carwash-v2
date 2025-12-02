export class POSView {
    constructor(store) {
        this.store = store;
        this.selectedCustomer = null;
    }

    render(container) {
        const customers = this.store.getCustomers();
        const services = this.store.getServices();

        container.innerHTML = `
            <div class="fade-in">
                <div class="view-header" style="margin-bottom: 2rem;">
                    <h2>Nueva Venta</h2>
                </div>

                <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 2rem;">
                    <!-- Form Area -->
                    <div class="card">
                        <form id="pos-form" style="display: flex; flex-direction: column; gap: 1.5rem;">
                            
                            <!-- Customer Selection -->
                            <div class="form-group">
                                <label style="display: block; margin-bottom: 0.5rem; color: var(--text-muted);">Cliente</label>
                                <select id="pos-customer" required style="width: 100%; padding: 1rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-dark); color: white;">
                                    <option value="">Seleccionar Cliente...</option>
                                    ${customers.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                                </select>
                            </div>

                            <!-- Vehicle Selection (Dependent) -->
                            <div class="form-group">
                                <label style="display: block; margin-bottom: 0.5rem; color: var(--text-muted);">Vehículo</label>
                                <select id="pos-vehicle" disabled required style="width: 100%; padding: 1rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-dark); color: white; opacity: 0.5;">
                                    <option value="">Seleccione un cliente primero</option>
                                </select>
                            </div>

                            <!-- Service Selection -->
                            <div class="form-group">
                                <label style="display: block; margin-bottom: 0.5rem; color: var(--text-muted);">Servicio</label>
                                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 1rem;">
                                    ${services.map(s => `
                                        <label class="service-option" style="
                                            border: 1px solid var(--border-color); 
                                            padding: 1rem; 
                                            border-radius: var(--radius-md); 
                                            cursor: pointer;
                                            transition: all 0.2s;
                                            display: block;
                                        ">
                                            <input type="radio" name="service" value="${s.id}" required style="margin-bottom: 0.5rem;">
                                            <div style="font-weight: 600;">${s.name}</div>
                                            <div style="color: var(--primary);">$${s.price}</div>
                                        </label>
                                    `).join('')}
                                </div>
                            </div>

                            <button type="submit" class="btn btn-primary" style="margin-top: 1rem; padding: 1rem; font-size: 1.1rem;">
                                Registrar Venta
                            </button>
                        </form>
                    </div>

                    <!-- Summary / Last Sales -->
                    <div class="card">
                        <h3>Últimas Ventas</h3>
                        <div id="last-sales-list" style="margin-top: 1rem; display: flex; flex-direction: column; gap: 1rem;">
                            <!-- Populated dynamically -->
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.attachEvents();
        this.renderLastSales();
    }

    attachEvents() {
        const customerSelect = document.getElementById('pos-customer');
        const vehicleSelect = document.getElementById('pos-vehicle');
        const form = document.getElementById('pos-form');

        // Handle Customer Change
        customerSelect.onchange = (e) => {
            const customerId = e.target.value;
            this.selectedCustomer = customerId;

            if (customerId) {
                const vehicles = this.store.getVehicles().filter(v => v.customerId == customerId);

                vehicleSelect.disabled = false;
                vehicleSelect.style.opacity = '1';

                if (vehicles.length > 0) {
                    vehicleSelect.innerHTML = `<option value="">Seleccionar Vehículo...</option>` +
                        vehicles.map(v => `<option value="${v.id}">${v.brand} ${v.model} (${v.plate})</option>`).join('');
                } else {
                    vehicleSelect.innerHTML = `<option value="">Este cliente no tiene vehículos</option>`;
                }
            } else {
                vehicleSelect.disabled = true;
                vehicleSelect.style.opacity = '0.5';
                vehicleSelect.innerHTML = `<option value="">Seleccione un cliente primero</option>`;
            }
        };

        // Handle Submit
        form.onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const serviceId = formData.get('service');
            const vehicleId = formData.get('pos-vehicle') || vehicleSelect.value; // Fallback if name attr missing

            if (!serviceId || !vehicleId) {
                alert('Por favor complete todos los campos');
                return;
            }

            const service = this.store.getServices().find(s => s.id == serviceId);

            const sale = {
                customerId: this.selectedCustomer,
                vehicleId: vehicleId,
                serviceId: serviceId,
                amount: service.price,
                serviceName: service.name
            };

            try {
                await this.store.addSale(sale);
                alert('¡Venta registrada con éxito!');

                // Reset form
                form.reset();
                vehicleSelect.disabled = true;
                vehicleSelect.style.opacity = '0.5';
                vehicleSelect.innerHTML = `<option value="">Seleccione un cliente primero</option>`;

                this.renderLastSales();
            } catch (error) {
                console.error(error);
                alert('Error al registrar la venta');
            }
        };
    }

    renderLastSales() {
        const container = document.getElementById('last-sales-list');
        const sales = this.store.getSales().slice(-5).reverse(); // Last 5

        if (sales.length === 0) {
            container.innerHTML = `<p style="color: var(--text-muted);">No hay ventas recientes.</p>`;
            return;
        }

        container.innerHTML = sales.map(sale => `
            <div style="
                padding: 1rem; 
                border-bottom: 1px solid var(--border-color);
                display: flex; justify-content: space-between; align-items: center;
            ">
                <div>
                    <div style="font-weight: 500;">${sale.serviceName}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">${new Date(sale.date).toLocaleTimeString()}</div>
                </div>
                <div style="color: var(--primary); font-weight: 600;">$${sale.amount}</div>
            </div>
        `).join('');
    }
}
