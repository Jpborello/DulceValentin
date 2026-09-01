const { createClient } = require('@supabase/supabase-js');
let ws;
try { ws = require('ws'); } catch (e) {}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://revrbrrzlnweuxwhpgei.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnaXBldWphZmp3aHFqb2Jjanp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4Nzg0MDcsImV4cCI6MjEwMTQ1NDQwN30.A9sRFYI36UvOmjw3fsFGlteutTLsaPRXPszacwysbQk';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
  ...(ws ? { realtime: { transport: ws } } : {})
});

async function run() {
  console.log('Checking bucket public settings...');
  const { data, error } = await supabase.storage.updateBucket('Productos', {
    public: true
  });
  console.log('Update result:', data, error);
}

run();
