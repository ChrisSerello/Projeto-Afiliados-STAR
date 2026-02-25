// db.js — usa SUPABASE_SERVICE_KEY para operações server-side (bypassa RLS)
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY  // service key para operações de backend
);

module.exports = supabase;