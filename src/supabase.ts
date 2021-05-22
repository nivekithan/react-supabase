import { createClient, SupabaseConfig } from "./react-supabase/context";

const config = {
  key: import.meta.env.VITE_DB_KEY,
  url: import.meta.env.VITE_DB_URL,
} as SupabaseConfig;

const supabase = createClient(config);

supabase.auth.onAuthStateChange;
export { supabase };
