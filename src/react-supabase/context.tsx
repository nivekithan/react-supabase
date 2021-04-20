import React, { useContext, useEffect, useState } from "react";
import { PostgrestClient } from "../postgrest";

export type SupabaseConfig = {
  url: string;
  key: string;
};

const supabase = React.createContext<PostgrestClient | undefined>(undefined);

type SupabaseProviderProps = {
  config: SupabaseConfig;
  children: React.ReactNode;
};

export const SupabaseProvider = ({
  children,
  config,
}: SupabaseProviderProps) => {
  const [supabaseClient, setSupabaseClient] = useState(
    new PostgrestClient(`${config.url}/rest/v1`, {
      apiKey: config.key,
      Authorization: `Bearer ${config.key}`,
    })
  );

  useEffect(() => {
    setSupabaseClient(
      new PostgrestClient(`${config.url}/rest/v1`, {
        apiKey: config.key,
        Authorization: `Bearer ${config.key}`,
      })
    );
  }, [config]);

  return (
    <supabase.Provider value={supabaseClient}>{children}</supabase.Provider>
  );
};

export const useSupabase = () => {
  const supabaseClient = useContext(supabase);

  if (!supabaseClient) {
    throw new Error("use useSupabase inside the SupabaseProvider tree");
  } else {
    return supabaseClient;
  }
};
