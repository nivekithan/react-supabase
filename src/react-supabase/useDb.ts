import { useEffect, useMemo, useRef, useState } from "react";
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
    }
  | {
      state: "ERROR";
      data: undefined;
      error: PostgrestError;
      status: number;
      statusText: string;
      count: undefined;
    }
  | {
      state: "LOADING" | "STALE";
      data: undefined;
      error: undefined;
      status: undefined;
      statusText: undefined;
      count: undefined;
    };

export type TResult<data> = DbResult<data> & { hash: string };

/**
 * Overload when the db does not require any arguments
 */

export function useDb<data>(
  db: DbContext<data, undefined>,
  args?: undefined,
  options?: SupabaseOptions<data>
): TResult<data>;

/**
 * Overload when the db does require arguments of type props
 */
export function useDb<data, props>(
  db: DbContext<data, props>,
  args: props,
  options?: SupabaseOptions<data>
): TResult<data>;

export function useDb<data, props>(
  db: DbContext<data, props>,
  args?: props,
  options?: SupabaseOptions<data>
): DbResult<data> {
  const supabase = useSupabase();

  const supabaseBuild = useMemo(() => {
    return typeof args !== "undefined"
      ? db.createUrl(supabase, args as props)
      : (db.createUrl as CreateUrl<undefined>)(supabase);
  }, [args, db, supabase]);

  const hashString = getHash(db, args);
  const finalOptions = useGetOptions(hashString, db.options, options || {});

  const { current: key } = useRef(Key.getUniqueKey());

  const cache = () => {
    try {
      return Cache.getCache<data>(hashString);
    } catch (err) {
      new Cache(
        hashString,
        supabaseBuild,
        finalOptions as Required<SupabaseOptions<unknown>>
      );
      return Cache.getCache<data>(hashString);
    }
  };

  const [cacheData, setCacheData] = useState<DbResult<data>>(cache());
  const result = useMemo(() => {
    return {
      ...cacheData,
      hash: hashString,
    };
  }, [cacheData, hashString]);

  useEffect(() => {
    let isMounted = true;

    const {
      shouldComponentUpdate,
      stopRefetchTimeout,
      clearCacheTimeout,
    } = finalOptions;

    const unSubscribe = Cache.subscribe<data>(
      hashString,
      (cache) => {
        shouldComponentUpdate(cacheData, cache) &&
          isMounted &&
          setCacheData(cache);
      },
      { unique: key, stopRefetchTimeout, clearCacheTimeout }
    );

    return () => {
      isMounted = false;
      unSubscribe();
    };
  }, [supabaseBuild, hashString, setCacheData, key, cacheData, finalOptions]);

  /**
   * SetInterval delays the execution functions by the specified time so
   * we have to create another useEffect with zero dependency to execute Function
   */

  useEffect(() => {
    const cache = Cache.getCache(hashString);

    if (cache.state === "STALE") {
      fetchData(hashString, supabaseBuild, { retry: finalOptions.retry });
    }
  }, [finalOptions.retry, hashString, supabaseBuild]);

  return result;
}
