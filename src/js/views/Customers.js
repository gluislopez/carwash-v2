export class CustomersView {
    constructor(store) {
        this.store = store;
    }

    render(container) {
        container.innerHTML = `
            <div class="fade-in">
                <div class="view-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                    <div class="search-bar" style="position: relative;">
                        <input type="text" placeholder="Buscar cliente..." style="
                            padding: 0.75rem 1rem 0.75rem 2.5rem;
                            border-radius: var(--radius-md);
                            border: 1px solid var(--border-color);
                            background: var(--bg-card);
                            color: var(--text-main);
                            width: 300px;
                        ">
                        <span style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%);">🔍</span>
                    </div>
                    <button id="btn-add-customer" class="btn btn-primary">+ Nuevo Cliente</button>
                </div>

                <div class="card">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="text-align: left; border-bottom: 1px solid var(--border-color);">
                                <th style="padding: 1rem; color: var(--text-muted);">Nombre</th>
                                <th style="padding: 1rem; color: var(--text-muted);">Contacto</th>
                                <th style="padding: 1rem; color: var(--text-muted);">Vehículos</th>
                                <th style="padding: 1rem; color: var(--text-muted);">Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="customers-table-body">
                            <!-- Rows will be populated here -->
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Modal Container (Hidden by default) -->
            <div id="modal-overlay" style="
                display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); z-index: 100;
                align-items: center; justify-content: center;
            ">
                <div class="card" style="width: 400px; animation: fadeIn 0.3s ease;">
                    <h3 style="margin-bottom: 1.5rem;">Nuevo Cliente</h3>
                    <form id="add-customer-form" style="display: flex; flex-direction: column; gap: 1rem;">
                        <input type="text" name="name" placeholder="Nombre Completo" required style="padding: 0.8rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-dark); color: white;">
                        <input type="tel" name="phone" placeholder="Teléfono" required style="padding: 0.8rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-dark); color: white;">
                        <input type="email" name="email" placeholder="Email (Opcional)" style="padding: 0.8rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-dark); color: white;">
                        
                        <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                            <button type="button" id="btn-cancel-modal" class="btn" style="flex: 1; border: 1px solid var(--border-color); color: var(--text-main);">Cancelar</button>
                            <button type="submit" class="btn btn-primary" style="flex: 1;">Guardar</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        this.renderTable();
        this.attachEvents();
    }

    renderTable() {
        const tbody = document.getElementById('customers-table-body');
        const customers = this.store.getCustomers();

        if (customers.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="padding: 2rem; text-align: center; color: var(--text-muted);">No hay clientes registrados.</td></tr>`;
            return;
        }

        tbody.innerHTML = customers.map(c => `
            <tr style="border-bottom: 1px solid var(--border-color);">
                <td style="padding: 1rem; font-weight: 500;">${c.name}</td>
                <td style="padding: 1rem;">
                    <div style="font-size: 0.9rem;">${c.phone}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">${c.email || ''}</div>
                </td>
                <td style="padding: 1rem;">0</td>
                <td style="padding: 1rem;">
                    <button class="btn" style="padding: 0.4rem 0.8rem; font-size: 0.8rem; border: 1px solid var(--border-color); color: var(--text-main);">Editar</button>
                </td>
            </tr>
        `).join('');
    }

    attachEvents() {
        const modal = document.getElementById('modal-overlay');
        const btnAdd = document.getElementById('btn-add-customer');
        const btnCancel = document.getElementById('btn-cancel-modal');
        const form = document.getElementById('add-customer-form');

        btnAdd.onclick = () => modal.style.display = 'flex';
        btnCancel.onclick = () => modal.style.display = 'none';

        form.onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const newCustomer = {
                name: formData.get('name'),
                phone: formData.get('phone'),
                email: formData.get('email')
            };

            try {
                await this.store.addCustomer(newCustomer);
                modal.style.display = 'none';
                form.reset();
                this.renderTable(); // Re-render table
            } catch (error) {
                console.error(error);
                alert('Error al guardar el cliente');
            }
        };
    }
}
