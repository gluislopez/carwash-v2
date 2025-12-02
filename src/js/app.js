/**
 * CarWash SaaS - Main Application Entry Point
 */

import { Store } from './store/Store.js';
// Import views will happen dynamically or here

class App {
    constructor() {
        this.store = new Store();
        this.init();
    }

    async init() {
        console.log('🚀 CarWash SaaS Initialized');
        await this.store.loadData();
        this.renderSidebar();
        this.setupMobileMenu();
        this.loadView('dashboard');
    }

    setupMobileMenu() {
        // Create Toggle Button
        const topBar = document.querySelector('.top-bar');
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'menu-toggle';
        toggleBtn.innerHTML = '☰';
        topBar.insertBefore(toggleBtn, topBar.firstChild);

        // Create Overlay
        const overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        document.body.appendChild(overlay);

        // Event Listeners
        const sidebar = document.getElementById('sidebar');

        const toggleMenu = () => {
            sidebar.classList.toggle('open');
            overlay.classList.toggle('visible');
        };

        toggleBtn.onclick = toggleMenu;
        overlay.onclick = toggleMenu;

        // Close menu when clicking a nav item on mobile
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    toggleMenu();
                }
            });
        });
    }

    renderSidebar() {
        const nav = document.getElementById('main-nav');
        const menuItems = [
            { id: 'dashboard', label: 'Dashboard', icon: '📊' },
            { id: 'customers', label: 'Clientes', icon: '👥' },
            { id: 'vehicles', label: 'Vehículos', icon: '🚗' },
            { id: 'services', label: 'Servicios', icon: '✨' },
            { id: 'pos', label: 'Nueva Venta', icon: '💰' },
        ];

        const ul = document.createElement('ul');
        ul.style.listStyle = 'none';
        ul.style.display = 'flex';
        ul.style.flexDirection = 'column';
        ul.style.gap = '0.5rem';

        menuItems.forEach(item => {
            const li = document.createElement('li');
            const btn = document.createElement('button');
            btn.className = 'nav-item';
            btn.innerHTML = `<span class="nav-icon">${item.icon}</span> ${item.label}`;
            btn.onclick = () => this.loadView(item.id);

            // Basic nav styles (move to CSS later)
            btn.style.width = '100%';
            btn.style.padding = '1rem';
            btn.style.background = 'transparent';
            btn.style.border = 'none';
            btn.style.color = 'var(--text-muted)';
            btn.style.textAlign = 'left';
            btn.style.cursor = 'pointer';
            btn.style.borderRadius = 'var(--radius-md)';
            btn.style.fontSize = '1rem';
            btn.style.display = 'flex';
            btn.style.alignItems = 'center';
            btn.style.gap = '1rem';
            btn.style.transition = 'all 0.2s';

            btn.addEventListener('mouseenter', () => {
                btn.style.background = 'rgba(99, 102, 241, 0.1)';
                btn.style.color = 'var(--primary)';
            });
            btn.addEventListener('mouseleave', () => {
                if (!btn.classList.contains('active')) {
                    btn.style.background = 'transparent';
                    btn.style.color = 'var(--text-muted)';
                }
            });

            li.appendChild(btn);
            ul.appendChild(li);
        });

        nav.appendChild(ul);
    }

    async loadView(viewId) {
        const container = document.getElementById('view-container');
        const title = document.getElementById('page-title');

        // Update Title
        title.textContent = viewId.charAt(0).toUpperCase() + viewId.slice(1);

        // Show loading state
        container.innerHTML = '<div class="fade-in">Cargando...</div>';

        try {
            let ViewClass;
            switch (viewId) {
                case 'dashboard':
                    const dashboardModule = await import('./views/Dashboard.js');
                    ViewClass = dashboardModule.DashboardView;
                    break;
                case 'customers':
                    const customersModule = await import('./views/Customers.js');
                    ViewClass = customersModule.CustomersView;
                    break;
                case 'services':
                    const servicesModule = await import('./views/Services.js');
                    ViewClass = servicesModule.ServicesView;
                    break;
                case 'vehicles':
                    const vehiclesModule = await import('./views/Vehicles.js');
                    ViewClass = vehiclesModule.VehiclesView;
                    break;
                case 'pos':
                    const posModule = await import('./views/POS.js');
                    ViewClass = posModule.POSView;
                    break;
                default:
                    container.innerHTML = `<div class="card"><h3>Vista en construcción: ${viewId}</h3></div>`;
                    return;
            }

            const view = new ViewClass(this.store);
            view.render(container);

            // Update active state in sidebar
            document.querySelectorAll('.nav-item').forEach(btn => {
                // Reset styles
                btn.style.background = 'transparent';
                btn.style.color = 'var(--text-muted)';
                btn.classList.remove('active');

                if (btn.textContent.toLowerCase().includes(viewId === 'dashboard' ? 'dashboard' : viewId === 'customers' ? 'clientes' : '')) {
                    btn.style.background = 'rgba(99, 102, 241, 0.1)';
                    btn.style.color = 'var(--primary)';
                    btn.classList.add('active');
                }
            });

        } catch (error) {
            console.error('Error loading view:', error);
            container.innerHTML = `<div class="card" style="color: #ef4444;">Error cargando la vista: ${error.message}</div>`;
        }
    }
}

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
