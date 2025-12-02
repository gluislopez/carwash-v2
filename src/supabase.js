import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('YOUR_SUPABASE_URL')) {
    console.error('Supabase credentials missing! Please check your .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseKey)
