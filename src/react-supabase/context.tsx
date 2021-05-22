import React, { createContext, useContext, useEffect, useState } from "react";
import { SupabaseClient } from "../supbase-js/supabaseClient";
import { DbResult } from "./useDb";
import { User } from "../supbase-js/supabaseClient";
import { AuthChangeEvent, Session } from "@supabase/gotrue-js";

export type SupabaseConfig = {
  url: string;
  key: string;
};

export const createClient = ({ url, key }: SupabaseConfig) => {
  return new SupabaseClient(url, key);
};

export type dbOptions<data> = {
  cacheTime?: number;
  backgroundFetch?: boolean;
  shouldComponentUpdate?: (curr: DbResult<data>, next: DbResult<data>) => boolean;
  retry?: number;
  stopRefetchTimeout?: number;
  clearCacheTimeout?: number;
  resetCacheOnAuthChange?: boolean | ((e: AuthChangeEvent, session: Session | null) => boolean);
};

const supabase = createContext<SupabaseClient | undefined>(undefined);
const dbOptionsContext = createContext<dbOptions<unknown> | undefined>(undefined);
export const SupabaseUserContext = createContext<User | null | undefined>(undefined);

export type ClientProviderProps = {
  client: SupabaseClient;
  children: React.ReactNode;
};

export const ClientProvider = ({ children, client }: ClientProviderProps) => {
  return <supabase.Provider value={client}>{children}</supabase.Provider>;
};

export type DbOptionsProviderProps = {
  options?: dbOptions<unknown>;
  children: React.ReactNode;
};

export const DbOptionsProvider = ({ options = {}, children }: DbOptionsProviderProps) => {
  return <dbOptionsContext.Provider value={options}>{children}</dbOptionsContext.Provider>;
};

export const useDbOptions = () => {
  const supabaseOptions = useContext(dbOptionsContext);

  if (!supabaseOptions) {
    throw new Error("use useDbOptions inside the DbOptionsProvider tree");
  } else {
    return supabaseOptions;
  }
};

type SupabaseProviderProps = {
  children: React.ReactNode;
  client: SupabaseClient;
  dbOptions?: dbOptions<unknown>;
};

export const SupabaseProvider = ({ children, client, dbOptions }: SupabaseProviderProps) => {
  return (
    <ClientProvider client={client}>
      <DbOptionsProvider options={dbOptions}>
        <SupabaseUserProvider>{children}</SupabaseUserProvider>
      </DbOptionsProvider>
    </ClientProvider>
  );
};

export const useSupabase = () => {
  const supabaseClient = useContext(supabase);

  if (!supabaseClient) {
    throw new Error("use useSupabase inside the ClientProvider tree");
  } else {
    return supabaseClient;
  }
};

type SupabaseUserProviderProps = {
  children: React.ReactNode;
};

const SupabaseUserProvider = ({ children }: SupabaseUserProviderProps) => {
  const supabase = useSupabase();
  const [user, setUser] = useState<User | null>(supabase.auth.user());
  useEffect(() => {
    const unSubs = supabase.auth.onAuthStateChange((e, session) => {
      switch (e) {
        case "SIGNED_IN":
        case "USER_UPDATED":
          setUser(session?.user ?? null);
          break;
        case "SIGNED_OUT":
        case "USER_DELETED":
          setUser(null);
          break;
      }
    });

    return () => {
      unSubs.data?.unsubscribe();
    };
  }, [supabase.auth]);

  return <SupabaseUserContext.Provider value={user}>{children}</SupabaseUserContext.Provider>;
};

export const useUser = () => {
  const user = useContext(SupabaseUserContext);

  if (user === undefined) {
    throw new Error("use useUser inside SupabaseProvider tree");
  }

  return user;
};

export const useAuthUser = () => {
  const user = useUser();

  if (user === null) {
    throw new Error("The user is not authenticated");
  }

  return user;
};
