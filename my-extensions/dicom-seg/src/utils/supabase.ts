import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// Create client with public_v2 schema config (same as SegmentComments.tsx)
export default createClient(supabaseUrl, supabaseKey, {
  db: {
    schema: 'public_v2'
  },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
