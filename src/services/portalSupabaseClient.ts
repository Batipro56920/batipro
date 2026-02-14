import { createClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";

export function createPortalClient(jwt: string) {
  const url = import.meta.env.VITE_SUPABASE_URL!;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY!;

  return createClient<Database>(url, anon, {
    global: {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}


