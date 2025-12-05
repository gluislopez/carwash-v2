import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Creates a new user account using a secondary Supabase client.
 * This prevents the current admin session from being overwritten.
 * 
 * @param {string} email 
 * @param {string} password 
 * @returns {Promise<{user: object, error: object}>}
 */
export const createAccount = async (email, password) => {
    if (!supabaseUrl || !supabaseKey) {
        return { error: { message: 'Faltan las credenciales de Supabase' } };
    }

    // Create a temporary client with in-memory storage only
    const tempClient = createClient(supabaseUrl, supabaseKey, {
        auth: {
            persistSession: false, // Don't save to localStorage
            autoRefreshToken: false,
            detectSessionInUrl: false
        }
    });

    const { data, error } = await tempClient.auth.signUp({
        email,
        password
    });

    return { user: data?.user, error };
};
