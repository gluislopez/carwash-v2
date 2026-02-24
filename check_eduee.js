
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Simple manual .env parser
function loadEnv() {
    const envFile = fs.readFileSync('.env', 'utf8');
    const config = {};
    envFile.split('\n').forEach(line => {
        const match = line.match(/^\s*([\w\.\-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
            let value = match[2] || '';
            if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
            if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
            config[match[1]] = value;
        }
    });
    return config;
}

const envConfig = loadEnv();
const supabaseUrl = envConfig.VITE_SUPABASE_URL;
const supabaseKey = envConfig.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkEduee() {
    console.log("--- BUSCANDO A EDUEE ---");

    // 1. Encontrar al cliente
    const { data: customers, error: cError } = await supabase
        .from('customers')
        .select('id, name, vehicle_plate')
        .ilike('name', '%Eduee%');

    if (cError) {
        console.error("Error buscando cliente:", cError);
        return;
    }

    if (!customers || customers.length === 0) {
        console.log("No se encontró a ningún cliente llamado Eduee.");
        return;
    }

    for (const customer of customers) {
        console.log(`\nCliente encontrado: ${customer.name} (ID: ${customer.id})`);

        // 2. Buscar su membresía activa
        const { data: membership, error: mError } = await supabase
            .from('customer_memberships')
            .select('*, memberships(*)')
            .eq('customer_id', customer.id)
            .eq('status', 'active')
            .maybeSingle();

        if (mError) {
            console.error("Error buscando membresía:", mError);
            continue;
        }

        if (!membership) {
            console.log("No tiene una membresía activa actualmente.");
            continue;
        }

        console.log(`Membresía: ${membership.memberships.name}`);
        console.log(`Uso Actual: ${membership.usage_count}`);
        console.log(`Límite: ${membership.memberships.limit_count}`);
        console.log(`Fecha Inicio: ${membership.start_date}`);
        console.log(`Último uso: ${membership.last_used}`);

        // 3. Buscar transacciones de hoy (para ver si se registró algo)
        // Adjust for Puerto Rico Timezone (UTC-4)
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).toISOString();

        const { data: txs, error: tError } = await supabase
            .from('transactions')
            .select('*')
            .eq('customer_id', customer.id)
            .gte('date', startOfDay);

        if (txs && txs.length > 0) {
            console.log("\nTransacciones registradas hoy:");
            txs.forEach(t => {
                console.log(`- ID: ${t.id}, Pago: ${t.payment_method}, Total: $${t.total_price}, Status: ${t.status}, Fecha: ${t.date}`);
            });
        } else {
            console.log("\nNo hay transacciones hoy.");
        }
    }
}

checkEduee();
