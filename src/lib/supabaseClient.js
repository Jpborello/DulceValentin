import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://revrbrrzlnweuxwhpgei.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_SG-JwsfgUZuPHN23twhBlw_QhaJmwL_';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
