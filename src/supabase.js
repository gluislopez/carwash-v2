import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

let supabaseInstance = null;

if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('YOUR_SUPABASE_URL')) {
    // Si faltan las llaves, mostramos un error visible y no crasheamos
    const msg = 'ERROR CRÍTICO: Faltan las llaves de Supabase en Vercel. Revisa Environment Variables.';
    console.error(msg);
    if (typeof window !== 'undefined') alert(msg);
} else {
    supabaseInstance = createClient(supabaseUrl, supabaseKey);
}

export const supabase = supabaseInstance;
