import { createClient } from "@supabase/supabase-js";

// This admin client runs on the server and bypasses Row Level Security (RLS) policies.
// It must only be used in secure server contexts like API routes or Server Actions.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
