import React from "react";
import ReactDOM from "react-dom";
import { App } from "./app";
import { SupabaseConfig, SupabaseProvider } from "./react-supabase";

const config = {
  key: import.meta.env.VITE_DB_KEY ,
  url: import.meta.env.VITE_DB_URL,
} as SupabaseConfig;

ReactDOM.render(
  <React.StrictMode>
    <SupabaseProvider config={config}>
      <App />
    </SupabaseProvider>
  </React.StrictMode>,
  document.getElementById("root")
);
