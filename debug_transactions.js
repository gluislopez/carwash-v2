
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

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

async function debug() {
    const { data: txs, error } = await supabase
        .from('transactions')
        .select('*, customers(name)')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error(error);
        return;
    }

    console.log("--- ULTIMAS 10 TRANSACCIONES ---");
    txs.forEach(t => {
        console.log(`ID: ${t.id} | Cliente: ${t.customers?.name} | Fecha: ${t.date} | Creado: ${t.created_at} | Pago: ${t.payment_method} | Total: ${t.total_price || t.price} | Desc: ${JSON.stringify(t.extras)}`);
    });
}

debug();
