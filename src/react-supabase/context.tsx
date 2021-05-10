import React, { useContext } from "react";
import { PostgrestClient } from "../postgrest";
import { DbResult } from "./useDb";

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

export type dbOptions<data> = {
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
const dbOptionsContext = React.createContext<dbOptions<unknown> | undefined>(
  undefined
);

export type ClientProviderProps = {
  client: PostgrestClient;
  children: React.ReactNode;
};

export const ClientProvider = ({ children, client }: ClientProviderProps) => {
  return <supabase.Provider value={client}>{children}</supabase.Provider>;
};

export type DbOptionsProviderProps = {
  options?: dbOptions<unknown>;
  children: React.ReactNode;
};

export const DbOptionsProvider = ({
  options = {},
  children,
}: DbOptionsProviderProps) => {
  return (
    <dbOptionsContext.Provider value={options}>
      {children}
    </dbOptionsContext.Provider>
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

export const useDbOptions = () => {
  const supabaseOptions = useContext(dbOptionsContext);

  if (!supabaseOptions) {
    throw new Error("use useSupabaseOptions inside the SupabaseProvider tree");
  } else {
    return supabaseOptions;
  }
};

type SupabaseProviderProps = {
  children: React.ReactNode;
  client: PostgrestClient;
  dbOptions?: dbOptions<unknown>;
};

export const SupabaseProvider = ({
  children,
  client,
  dbOptions,
}: SupabaseProviderProps) => {
  return (
    <ClientProvider client={client}>
      <DbOptionsProvider options={dbOptions}>{children}</DbOptionsProvider>
    </ClientProvider>
  );
};
