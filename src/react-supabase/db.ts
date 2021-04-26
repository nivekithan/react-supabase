import { PostgrestClient } from "../postgrest";
import { SupabaseBuild } from "../postgrest/lib/types";
import { useSupabase, useSupabaseOptions } from "./context";
import { Key } from "./key";
import { useEffect, useRef, useState } from "react";
import { stableStringify } from "./utlis";
import { Cache, fetchData } from "./cache";

type DbContext<props> = {
  createUrl: (supabase: PostgrestClient, para: props) => SupabaseBuild;
  id: Key;
  options: dbOptions;
};

type dbOptions = {
  backgroundFetch?: boolean;
};

export const db = <props>(
  createUrl: (supabase: PostgrestClient, para: props) => SupabaseBuild,
  options: dbOptions = {}
): DbContext<props> => {
  return {
    createUrl,
    id: Key.getUniqueKey(),
    options,
  };
};

export type DbResult<Data> = {
  state: "LOADING" | "ERROR" | "SUCCESS" | "STALE";
  data: Data | undefined;
  error: Error | undefined;
};

export const useDb = <data, props>(
  db: DbContext<props>,
  args: props,
  options: dbOptions = {}
) => {
  let bgFetch: boolean;

  const supabase = useSupabase();
  const { cacheTime, backgroundFetch } = useSupabaseOptions();

  if (options.backgroundFetch !== undefined) {
    bgFetch = options.backgroundFetch;
  } else if (db.options.backgroundFetch !== undefined) {
    bgFetch = db.options.backgroundFetch;
  } else {
    bgFetch = backgroundFetch;
  }

  const { current: supabaseBuild } = useRef(db.createUrl(supabase, args));
  const hash = `${db.id}${stableStringify(args)}`;
  const { current: key } = useRef(Key.getUniqueKey());

  const cache = () => {
    try {
      return Cache.getCache<data>(hash);
    } catch (err) {
      return {
        data: undefined,
        error: undefined,
        state: "STALE",
      } as DbResult<data>;
    }
  };

  const [resultData, setResultData] = useState<DbResult<data>>(cache());

  useEffect(() => {
    let isMounted = true;

    const unSubscribe = Cache.subscribe<data>(
      hash,
      (cache) => {
        isMounted && setResultData(cache);
      },
      supabaseBuild,
      {
        interval: cacheTime,
        unique: key,
        backgroundFetch: bgFetch,
      }
    );

    return () => {
      isMounted = false;
      unSubscribe();
    };
  }, [supabaseBuild, hash, setResultData, cacheTime, key, bgFetch]);

  /**
   * SetInterval delays the execution functions by the specified time so
   * we have to create another useEffect with zero dependency to execute Function
   */

  useEffect(() => {
    const cache = Cache.getCache(hash);

    if (cache.state === "STALE") {
      fetchData(hash, supabaseBuild);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return resultData;
};
