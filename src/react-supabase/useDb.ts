import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { Cache } from "./cache";
import { useDbOptions, useSupabase } from "./context";
import { DbContext } from "./db";
import { getHash } from "./hash";
import { Key } from "./key";
import { Sync } from "./sync";
import { useGetDbOptions } from "./useGetOptions";

export type PostgrestError = {
  message: string;
  details: string;
  hint: string;
  code: string;
};

export type DbResult<data> =
  | {
      state: "SUCCESS";
      data: data;
      error: undefined;
      status: number;
      statusText: string;
      hash: string;
    }
  | {
      state: "ERROR";
      data: undefined;
      error: PostgrestError;
      status: number;
      statusText: string;
      hash: string;
    }
  | {
      state: "LOADING" | "STALE";
      data: undefined;
      error: undefined;
      status: undefined;
      statusText: undefined;
      hash: string;
    };

/**
 * Overload when the db does not require any arguments
 */

export function useDb<data>(db: DbContext<data, undefined>, args?: undefined): DbResult<data>;

/**
 * Overload when the db does require arguments of type props
 */
export function useDb<data, props>(db: DbContext<data, props>, args: props): DbResult<data>;

export function useDb<data, props>(db: DbContext<data, props>, args?: props): DbResult<data> {
  const supabase = useSupabase();

  const getSupabaseBuild = useCallback(() => db.createUrl(supabase, args as props), [
    args,
    db,
    supabase,
  ]);

  const hashString = getHash(db, args as props);
  const finalOptions = useGetDbOptions(hashString, db.options);
  const configOptions = useDbOptions();

  const { current: key } = useRef(Key.getUniqueKey());

  const cache = useCallback(
    (force?: boolean) => {
      try {
        if (force) {
          Cache.cache[hashString].clearCache();
          new Cache<data>(supabase, getSupabaseBuild, hashString, finalOptions, configOptions);
        }
        return Cache.getCache<data>(hashString);
      } catch (err) {
        new Cache<data>(supabase, getSupabaseBuild, hashString, finalOptions, configOptions);
        return Cache.getCache<data>(hashString);
      }
    },
    [hashString, supabase, getSupabaseBuild, finalOptions, configOptions]
  );

  const [result, setResult] = useState<DbResult<data>>(cache);
  const sync = new Sync(Cache.cache[hashString].__sync);

  useEffect(() => {
    let isMounted = true;

    const { shouldComponentUpdate } = finalOptions;

    // Main subscriptions
    const mainUnSubscribe = Cache.subscribe<data>(
      hashString,
      (cache) => {
        if (isMounted) {
          sync.current = Cache.cache[hashString].__sync;
          shouldComponentUpdate(result, cache) && setResult(cache);
        }
      },
      (__sync, cache) => {
        if (sync.current !== __sync) {
          sync.current = __sync;
          isMounted && setResult(cache);
        }
      },
      { unique: key }
    );

    return () => {
      isMounted = false;
      mainUnSubscribe();
    };
  }, [finalOptions, hashString, key, result]);

  /**
   * SetInterval delays the execution functions by the specified time so
   * we have to create another useEffect with zero dependency to execute Function
   */

  useEffect(() => {
    const cache = Cache.getCache<data>(hashString);

    if (cache.state === "STALE") {
      Cache.cache[hashString].fetch(false);
    }
  }, [hashString]);

  return result;
}
