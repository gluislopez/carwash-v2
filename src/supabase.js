import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

let supabaseInstance = null;

if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('YOUR_SUPABASE_URL')) {
    // Si faltan las llaves, mostramos un error visible y no crasheamos
    const msg = 'ERROR CRÍTICO: Faltan las llaves de Supabase en Vercel. Revisa Environment Variables.';
    console.error(msg);
    if (typeof window !== 'undefined') alert(msg);

    // Mock Supabase client to prevent crash
    supabaseInstance = {
        auth: {
            getUser: async () => ({ data: { user: null }, error: new Error(msg) }),
            getSession: async () => ({ data: { session: null }, error: null }),
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => { } } } }),
            signInWithPassword: async () => ({ data: null, error: new Error(msg) }),
            signOut: async () => ({ error: null }),
        },
        from: () => ({
            select: () => ({ data: [], error: new Error(msg) }),
            insert: () => ({ data: null, error: new Error(msg) }),
            update: () => ({ data: null, error: new Error(msg) }),
            delete: () => ({ data: null, error: new Error(msg) }),
            upsert: () => ({ data: null, error: new Error(msg) }),
            eq: function () { return this; },
            order: function () { return this; },
            single: function () { return this; },
            limit: function () { return this; }
        })
    };
} else {
    supabaseInstance = createClient(supabaseUrl, supabaseKey);
}

export const supabase = supabaseInstance;
