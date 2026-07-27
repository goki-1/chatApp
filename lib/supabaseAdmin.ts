import { createClient, SupabaseClient } from "@supabase/supabase-js";

let clientInstance: SupabaseClient | null = null;

// Lazy getter function for Supabase Admin client
export function getSupabaseAdmin(): SupabaseClient {
  if (!clientInstance) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://api.backstagechat.me";
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy_key_for_build";
    clientInstance = createClient(supabaseUrl, serviceRoleKey);
  }
  return clientInstance;
}

export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseAdmin();
    const value = (client as any)[prop];
    return typeof value === "function" ? value.bind(client) : value;
  },
});
