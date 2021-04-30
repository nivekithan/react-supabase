import { PostgrestClient } from "../postgrest";
import { SupabaseBuild } from "../postgrest/lib/types";
import { SupabaseOptions, useSupabase } from "./context";
import { Key } from "./key";
import { useEffect, useMemo, useRef, useState } from "react";
import { hash } from "./hash";
import { Cache, fetchData } from "./cache";
import { useGetOptions } from "./useGetOptions";

type CreateUrl<props> = props extends undefined
  ? (supabase: PostgrestClient) => SupabaseBuild
  : (supabase: PostgrestClient, para: props) => SupabaseBuild;

type DbContext<data, props> = {
  createUrl: CreateUrl<props>;
  id: Key;
  options: SupabaseOptions<data>;
};

export const db = <data, props>(
  createUrl: CreateUrl<props>,
  options: SupabaseOptions<data> = {}
): DbContext<data, props> => {
  return {
    createUrl,
    id: Key.getUniqueKey(),
    options,
  };
};

export type DbResult<Data> =
  | {
      state: "SUCCESS";
      data: Data;
      error: undefined;
    }
  | {
      state: "ERROR";
      data: undefined;
      error: Error;
    }
  | {
      state: "LOADING" | "STALE";
      data: undefined;
      error: undefined;
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
  const finalOptions = useGetOptions(db.options, options || {});

  const { current: supabaseBuild } = useRef(
    typeof args !== "undefined"
      ? db.createUrl(supabase, args as props)
      : (db.createUrl as CreateUrl<undefined>)(supabase)
  );

  const hashString = `ID_${db.id}_ID_${
    hash.isHashFunProvided
      ? hash.providedHashFun(args)
      : hash.defaultHashFun(args)
  }`;
  const { current: key } = useRef(Key.getUniqueKey());

  const cache = () => {
    try {
      return Cache.getCache<data>(hashString);
    } catch (err) {
      Cache.createNewCache(hashString, supabaseBuild, {
        interval: finalOptions.cacheTime,
        backgroundFetch: finalOptions.backgroundFetch,
        retry: finalOptions.retry,
      });
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

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return result;
}
