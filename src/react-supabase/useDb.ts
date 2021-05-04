import { SupabaseBuild } from "@src/postgrest/lib/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Cache, fetchData } from "./cache";
import { SupabaseOptions, useSupabase } from "./context";
import { DbContext, CreateUrl } from "./db";
import { getHash } from "./hash";
import { Key } from "./key";
import { useGetOptions } from "./useGetOptions";

export type PostgrestError = {
  message: string;
  details: string;
  hint: string;
  code: string;
};

export type DbResult<data> =
  | {
      state: "SUCCESS";
      data: data[];
      error: undefined;
      status: number;
      statusText: string;
      count: undefined | number;
      hash: string;
    }
  | {
      state: "ERROR";
      data: undefined;
      error: PostgrestError;
      status: number;
      statusText: string;
      count: undefined;
      hash: string;
    }
  | {
      state: "LOADING" | "STALE";
      data: undefined;
      error: undefined;
      status: undefined;
      statusText: undefined;
      count: undefined;
      hash: string;
    };

export type useDbOptions<data> = SupabaseOptions<data>;

/**
 * Overload when the db does not require any arguments
 */

export function useDb<data>(
  db: DbContext<data, undefined>,
  args?: undefined,
  options?: useDbOptions<data>
): DbResult<data>;

/**
 * Overload when the db does require arguments of type props
 */
export function useDb<data, props>(
  db: DbContext<data, props>,
  args: props,
  options?: useDbOptions<data>
): DbResult<data>;

export function useDb<data, props>(
  db: DbContext<data, props>,
  args?: props,
  options?: useDbOptions<data>
): DbResult<data> {
  const supabase = useSupabase();
  const finalOptions = useGetOptions(db.options, options || {});

  const supabaseBuild = useMemo<SupabaseBuild>(() => {
    return typeof args !== "undefined"
      ? db.createUrl(supabase, args as props)
      : (db.createUrl as CreateUrl<undefined>)(supabase);
  }, [args, db, supabase]);

  const hashString = getHash(db, args);

  const cache = useCallback(() => {
    try {
      return Cache.getCache<data>(hashString);
    } catch (err) {
      new Cache(hashString, supabaseBuild, {
        interval: finalOptions.cacheTime,
        backgroundFetch: finalOptions.backgroundFetch,
        retry: finalOptions.retry,
      });
      return Cache.getCache<data>(hashString);
    }
  }, [
    finalOptions.backgroundFetch,
    finalOptions.cacheTime,
    finalOptions.retry,
    hashString,
    supabaseBuild,
  ]);

  const [result, setResult] = useState<DbResult<data>>(cache);

  if (result.hash !== hashString) {
    setResult(cache());
  }
  const { current: key } = useRef(Key.getKey());

  useEffect(() => {
    let isMounted = true;

    if (!supabaseBuild) {
      return;
    }

    const {
      shouldComponentUpdate,
      stopRefetchTimeout,
      clearCacheTimeout,
    } = finalOptions;

    const unSubscribe = Cache.subscribe<data>(
      hashString,
      (cache) => {
        shouldComponentUpdate(result, cache) && isMounted && setResult(cache);
      },
      { unique: key, stopRefetchTimeout, clearCacheTimeout }
    );

    return () => {
      isMounted = false;
      unSubscribe();
    };
  }, [supabaseBuild, hashString, setResult, key, result, finalOptions]);

  /**
   * SetInterval delays the execution functions by the specified time so
   * we have to create another useEffect to execute the function immediately
   */

  useEffect(() => {
    const cache = Cache.getCache(hashString);

    if (cache.state === "STALE") {
      fetchData(hashString, supabaseBuild, { retry: finalOptions.retry });
    }
  }, [finalOptions.retry, hashString, supabaseBuild]);

  return result;
}
