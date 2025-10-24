import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Client for frontend usage (anon key)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Client for backend usage (service role key)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export default supabase;