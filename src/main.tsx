import React from "react";
import ReactDOM from "react-dom";
import { App } from "./app";
import { SupabaseConfig, SupabaseProvider } from "./react-supabase";
import { createClient, dbOptions } from "./react-supabase/context";

const config = {
  key: import.meta.env.VITE_DB_KEY,
  url: import.meta.env.VITE_DB_URL,
} as SupabaseConfig;

const client = createClient(config);

const supabaseOptions: dbOptions<unknown> = {
  cacheTime: 1_000 * 60 * 60 * 24,
};

ReactDOM.render(
  <React.StrictMode>
    <SupabaseProvider client={client} dbOptions={supabaseOptions}>
      <App />
    </SupabaseProvider>
  </React.StrictMode>,
  document.getElementById("root")
);
