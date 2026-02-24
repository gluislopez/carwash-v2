const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// We need to inspect the customers table
console.log("Checking if we have access to the DB structure...");
