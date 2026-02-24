import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function check() {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) { console.error("Missing keys"); return; }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: customers, error: err1 } = await supabase.from('customers').select('*');
    if (err1) console.error("Error fetching customers:", err1);
    const { data: vehicles } = await supabase.from('vehicles').select('*');

    console.log(`Loaded ${customers?.length || 0} customers and ${vehicles?.length || 0} vehicles.`);

    const allVehicles = {};
    if (vehicles) {
        vehicles.forEach(v => {
            if (!allVehicles[v.customer_id]) allVehicles[v.customer_id] = [];
            allVehicles[v.customer_id].push(v);
        });
    }

    const searchTerms = ['k', '#0'];

    searchTerms.forEach(searchTerm => {
        const filteredCustomers = customers.filter(c => {
            const term = searchTerm.toLowerCase().trim();
            if (!term) return true;

            const matchesNumber = c.customer_number && (c.customer_number.toString().padStart(2, '0') === term || c.customer_number.toString() === term || `#${c.customer_number.toString().padStart(2, '0')}`.includes(term));
            const matchesName = c.name && c.name.toLowerCase().includes(term);
            const matchesPhone = c.phone && c.phone.includes(term);

            let matchesVehicle = (c.vehicle_plate && c.vehicle_plate.toLowerCase().includes(term)) ||
                (c.vehicle_model && c.vehicle_model.toLowerCase().includes(term));

            if (!matchesVehicle && allVehicles[c.id]) {
                matchesVehicle = allVehicles[c.id].some(v =>
                    (v.plate && v.plate.toLowerCase().includes(term)) ||
                    (v.model && v.model.toLowerCase().includes(term)) ||
                    (v.brand && v.brand.toLowerCase().includes(term))
                );
            }

            return matchesNumber || matchesName || matchesPhone || matchesVehicle;
        });
        console.log(`Search for "${searchTerm}": found ${filteredCustomers.length}`);
    });
}
check();
