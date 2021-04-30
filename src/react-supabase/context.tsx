import React, { useContext } from "react";
import { PostgrestClient } from "../postgrest";
import { DbResult } from "./db";

export type SupabaseConfig = {
  url: string;
  key: string;
};

export const createClient = ({ url, key }: SupabaseConfig) => {
  return new PostgrestClient(`${url}/rest/v1`, {
    apiKey: key,
    Authorization: `Bearer ${key}`,
  });
};

export type SupabaseOptions<data> = {
  cacheTime?: number;
  backgroundFetch?: boolean;
  shouldComponentUpdate?: (
    curr: DbResult<data>,
    next: DbResult<data>
  ) => boolean;
  retry?: number;
  stopRefetchTimeout?: number;
  clearCacheTimeout?: number;
};

const supabase = React.createContext<PostgrestClient | undefined>(undefined);
const supabaseOptionsContext = React.createContext<
  SupabaseOptions<unknown> | undefined
>(undefined);

export type SupabaseProviderProps = {
  client: PostgrestClient;
  children: React.ReactNode;
  options?: SupabaseOptions<unknown>;
};

export const SupabaseProvider = ({
  children,
  client,
  options = {},
}: SupabaseProviderProps) => {
  return (
    <supabaseOptionsContext.Provider value={options}>
      <supabase.Provider value={client}>{children}</supabase.Provider>
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
