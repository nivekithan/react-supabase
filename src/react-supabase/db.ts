import { PostgrestClient } from "../postgrest";
import { SupabaseBuild } from "../postgrest/lib/types";
import { SupabaseOptions, useSupabase } from "./context";
import { Key } from "./key";
import { useEffect, useRef, useState } from "react";
import { stableStringify } from "./utils";
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

/**
 * Overload when the db does not require any arguments
 */

export function useDb<data>(
  db: DbContext<data, undefined>,
  args?: undefined,
  options?: SupabaseOptions<data>
): DbResult<data>;

/**
 * Overload when the db does require arguments of type props
 */
export function useDb<data, props>(
  db: DbContext<data, props>,
  args: props,
  options?: SupabaseOptions<data>
): DbResult<data>;

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

  const hash = `${db.id}${stableStringify(
    typeof args !== "undefined" ? args : undefined
  )}`;
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

    const {
      shouldComponentUpdate,
      stopRefetchTimeout,
      clearCacheTimeout,
    } = finalOptions;

    const unSubscribe = Cache.subscribe<data>(
      hash,
      (cache) => {
        shouldComponentUpdate(resultData, cache) &&
          isMounted &&
          setResultData(cache);
      },
      { unique: key, stopRefetchTimeout, clearCacheTimeout }
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
}
