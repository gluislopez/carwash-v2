export class ServicesView {
    constructor(store) {
        this.store = store;
    }

    render(container) {
        container.innerHTML = `
            <div class="fade-in">
                <div class="view-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                    <h2>Catálogo de Servicios</h2>
                    <button id="btn-add-service" class="btn btn-primary">+ Nuevo Servicio</button>
                </div>

                <div class="card">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="text-align: left; border-bottom: 1px solid var(--border-color);">
                                <th style="padding: 1rem; color: var(--text-muted);">Nombre del Servicio</th>
                                <th style="padding: 1rem; color: var(--text-muted);">Precio</th>
                                <th style="padding: 1rem; color: var(--text-muted);">Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="services-table-body">
                            <!-- Rows will be populated here -->
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Modal -->
            <div id="service-modal-overlay" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); z-index: 100; align-items: center; justify-content: center;">
                <div class="card" style="width: 400px; animation: fadeIn 0.3s ease;">
                    <h3 style="margin-bottom: 1.5rem;">Nuevo Servicio</h3>
                    <form id="add-service-form" style="display: flex; flex-direction: column; gap: 1rem;">
                        <input type="text" name="name" placeholder="Nombre del Servicio" required style="padding: 0.8rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-dark); color: white;">
                        <input type="number" name="price" placeholder="Precio ($)" required style="padding: 0.8rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-dark); color: white;">
                        
                        <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                            <button type="button" id="btn-cancel-service" class="btn" style="flex: 1; border: 1px solid var(--border-color); color: var(--text-main);">Cancelar</button>
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
        const tbody = document.getElementById('services-table-body');
        const services = this.store.getServices();

        if (services.length === 0) {
            tbody.innerHTML = `<tr><td colspan="3" style="padding: 2rem; text-align: center; color: var(--text-muted);">No hay servicios registrados.</td></tr>`;
            return;
        }

        tbody.innerHTML = services.map(s => `
            <tr style="border-bottom: 1px solid var(--border-color);">
                <td style="padding: 1rem; font-weight: 500;">${s.name}</td>
                <td style="padding: 1rem;">$${s.price}</td>
                <td style="padding: 1rem;">
                    <button class="btn" style="padding: 0.4rem 0.8rem; font-size: 0.8rem; border: 1px solid var(--border-color); color: var(--text-main);">Editar</button>
                </td>
            </tr>
        `).join('');
    }

    attachEvents() {
        const modal = document.getElementById('service-modal-overlay');
        const btnAdd = document.getElementById('btn-add-service');
        const btnCancel = document.getElementById('btn-cancel-service');
        const form = document.getElementById('add-service-form');

        btnAdd.onclick = () => modal.style.display = 'flex';
        btnCancel.onclick = () => modal.style.display = 'none';

        form.onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const newService = {
                name: formData.get('name'),
                price: parseFloat(formData.get('price'))
            };

            try {
                await this.store.addService(newService);
                modal.style.display = 'none';
                form.reset();
                this.renderTable();
            } catch (error) {
                console.error(error);
                alert('Error al guardar el servicio');
            }
        };
    }
}
