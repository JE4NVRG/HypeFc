import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const isServer = typeof window === 'undefined';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase env inválido: defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

if (isServer && !supabaseServiceKey) {
  throw new Error('Supabase env inválido: defina SUPABASE_SERVICE_ROLE_KEY no ambiente de servidor');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey as string);

export default supabase;
