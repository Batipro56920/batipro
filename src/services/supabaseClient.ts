import { createClient } from "@supabase/supabase-js";

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? "").trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim();

console.log("[ENV CHECK] MODE =", import.meta.env.MODE);
console.log("[ENV CHECK] URL  =", supabaseUrl);
console.log("[ENV CHECK] KEY  =", supabaseAnonKey.slice(0, 20)); // doit commencer par eyJ

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ✅ session check APRÈS init
supabase.auth.getSession().then(({ data, error }) => {
  console.log("[SESSION CHECK] error =", error?.message ?? null);
  console.log("[SESSION CHECK] hasSession =", !!data.session);
  console.log("[SESSION CHECK] user =", data.session?.user?.email ?? null);
  console.log("[SESSION CHECK] tokenStart =", data.session?.access_token?.slice(0, 10) ?? null);
});
