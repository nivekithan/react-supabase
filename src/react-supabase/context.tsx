import React, { useContext, useEffect, useState } from "react";
import { PostgrestClient } from "../postgrest";

export type SupabaseConfig = {
  url: string;
  key: string;
};

export type SupabaseOptions = {
  cacheTime: number;
};

const supabase = React.createContext<PostgrestClient | undefined>(undefined);
const supabaseOptionsContext = React.createContext<SupabaseOptions | undefined>(
  undefined
);

type SupabaseProviderProps = {
  config: SupabaseConfig;
  children: React.ReactNode;
  options: Partial<SupabaseOptions>;
};

export const SupabaseProvider = ({
  children,
  config,
  options = {},
}: SupabaseProviderProps) => {
  const { cacheTime = 3000 } = options;
  const [supabaseOptions] = useState<SupabaseOptions>({
    cacheTime,
  });
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
    <supabaseOptionsContext.Provider value={supabaseOptions}>
      <supabase.Provider value={supabaseClient}>{children}</supabase.Provider>
    </supabaseOptionsContext.Provider>
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

export const useSupabaseOptions = () => {
  const supabaseOptions = useContext(supabaseOptionsContext);

  if (!supabaseOptions) {
    throw new Error("use useSupabaseOptions inside the SupabaseProvider tree");
  } else {
    return supabaseOptions;
  }
};
