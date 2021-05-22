import React from "react";
import ReactDOM from "react-dom";
import { App } from "./app";
import { SupabaseProvider } from "./react-supabase";
import { dbOptions } from "./react-supabase/context";
import { supabase } from "./supabase";

const supabaseOptions: dbOptions<unknown> = {
  cacheTime: 1_000 * 60 * 60 * 24,
};

ReactDOM.render(
  <React.StrictMode>
    <SupabaseProvider client={supabase} dbOptions={supabaseOptions}>
      <App />
    </SupabaseProvider>
  </React.StrictMode>,
  document.getElementById("root")
);
