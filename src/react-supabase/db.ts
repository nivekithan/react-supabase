import { PostgrestClient } from "../postgrest";
import { SupabaseBuild } from "../postgrest/lib/types";
import { useSupabase } from "./context";
import { Key } from "./key";
import { useEffect, useRef, useState } from "react";
import { stableStringify } from "./utils";
import { Cache, fetchData } from "./cache";
import { useGetOptions } from "./useGetOptions";

type DbContext<data, props> = {
  createUrl: (supabase: PostgrestClient, para: props) => SupabaseBuild;
  id: Key;
  options: dbOptions<data>;
};

export type dbOptions<data> = {
  backgroundFetch?: boolean;
  shouldComponentUpdate?: (
    curr: DbResult<data>,
    next: DbResult<data>
  ) => boolean;
  cacheTime?: number;
  retry?: number;
  stopRefetchTimeout?: number;
};

export type DbResult<Data> = {
  state: "LOADING" | "ERROR" | "SUCCESS" | "STALE";
  data: Data | undefined;
  error: Error | undefined;
};

export const db = <data, props>(
  createUrl: (supabase: PostgrestClient, para: props) => SupabaseBuild,
  options: dbOptions<data> = {}
): DbContext<data, props> => {
  return {
    createUrl,
    id: Key.getUniqueKey(),
    options,
  };
};

export type useDbOptions<data> = {
  backgroundFetch?: boolean;
  shouldComponentUpdate?: (
    curr: DbResult<data>,
    next: DbResult<data>
  ) => boolean;
  cacheTime?: number;
  retry?: number;
  stopRefetchTimeout?: number;
};

export const useDb = <data, props>(
  db: DbContext<data, props>,
  args: props,
  options: useDbOptions<data> = {}
) => {
  const supabase = useSupabase();
  const finalOptions = useGetOptions(db.options, options);

  const { current: supabaseBuild } = useRef(db.createUrl(supabase, args));
  const hash = `${db.id}${stableStringify(args)}`;
  const { current: key } = useRef(Key.getUniqueKey());

  const cache = () => {
    try {
      return Cache.getCache<data>(hash);
    } catch (err) {
      Cache.createNewCache(hash, supabaseBuild, {
        interval: finalOptions.cacheTime,
        backgroundFetch: finalOptions.backgroundFetch,
        retry: finalOptions.retry,
      });
      return Cache.getCache<data>(hash);
    }
  };

  const [resultData, setResultData] = useState<DbResult<data>>(cache());

  useEffect(() => {
    let isMounted = true;

    const { shouldComponentUpdate, stopRefetchTimeout } = finalOptions;

    const unSubscribe = Cache.subscribe<data>(
      hash,
      (cache) => {
        shouldComponentUpdate(resultData, cache) &&
          isMounted &&
          setResultData(cache);
      },
      { unique: key, stopRefetchTimeout }
    );

    return () => {
      isMounted = false;
      unSubscribe();
    };
  }, [supabaseBuild, hash, setResultData, key, resultData, finalOptions]);

  /**
   * SetInterval delays the execution functions by the specified time so
   * we have to create another useEffect with zero dependency to execute Function
   */

  useEffect(() => {
    const cache = Cache.getCache(hash);

    if (cache.state === "STALE") {
      fetchData(hash, supabaseBuild, { retry: finalOptions.retry });
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return resultData;
};
