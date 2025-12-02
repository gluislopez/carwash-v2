import { supabase } from '../lib/supabase.js';

export class Store {
    constructor() {
        this.state = {
            customers: [],
            vehicles: [],
            services: [],
            sales: []
        };
    }

    async loadData() {
        try {
            const [customers, vehicles, services, sales] = await Promise.all([
                supabase.from('customers').select('*'),
                supabase.from('vehicles').select('*'),
                supabase.from('services').select('*'),
                supabase.from('sales').select('*')
            ]);

            if (customers.data) this.state.customers = customers.data;
            if (vehicles.data) this.state.vehicles = vehicles.data;
            if (services.data) this.state.services = services.data;
            if (sales.data) this.state.sales = sales.data;

            console.log('📦 Data loaded from Supabase', this.state);
        } catch (error) {
            console.error('Error loading data:', error);
        }
    }

    // Getters
    getCustomers() { return this.state.customers; }
    getServices() { return this.state.services; }
    getVehicles() { return this.state.vehicles; }
    getSales() { return this.state.sales; }

    // Actions
    async addCustomer(customer) {
        const { data, error } = await supabase
            .from('customers')
            .insert([customer])
            .select();

        if (error) {
            console.error('Error adding customer:', error);
            throw error;
        }

        if (data) {
            this.state.customers.push(data[0]);
            return data[0];
        }
    }

    async addService(service) {
        const { data, error } = await supabase
            .from('services')
            .insert([service])
            .select();

        if (error) throw error;
        if (data) this.state.services.push(data[0]);
    }

    async addVehicle(vehicle) {
        const { data, error } = await supabase
            .from('vehicles')
            .insert([vehicle])
            .select();

        if (error) throw error;
        if (data) this.state.vehicles.push(data[0]);
    }

    async addSale(sale) {
        // Ensure date is set if not provided
        const saleData = { ...sale, date: new Date().toISOString() };
        const { data, error } = await supabase
            .from('sales')
            .insert([saleData])
            .select();

        if (error) throw error;
        if (data) this.state.sales.push(data[0]);
    }
}
