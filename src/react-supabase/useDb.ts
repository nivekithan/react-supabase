import { useEffect, useMemo, useRef, useState } from "react";
import { Cache, fetchData } from "./cache";
import { dbOptions, useSupabase } from "./context";
import { DbContext, CreateUrl } from "./db";
import { getHash } from "./hash";
import { Key } from "./key";
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
      data: data[];
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

export function useDb<data>(
  db: DbContext<data, undefined>,
  args?: undefined,
  options?: dbOptions<data>
): DbResult<data>;

/**
 * Overload when the db does require arguments of type props
 */
export function useDb<data, props>(
  db: DbContext<data, props>,
  args: props,
  options?: dbOptions<data>
): DbResult<data>;

export function useDb<data, props>(
  db: DbContext<data, props>,
  args?: props,
  options?: dbOptions<data>
): DbResult<data> {
  const supabase = useSupabase();

  const supabaseBuild = useMemo(() => {
    return typeof args !== "undefined"
      ? db.createUrl(supabase, args)
      : (db.createUrl as CreateUrl<undefined>)(supabase);
  }, [args, db, supabase]);

  const hashString = getHash(db, args as props);
  const finalOptions = useGetDbOptions(hashString, db.options, options || {});

  const { current: key } = useRef(Key.getUniqueKey());

  const cache = () => {
    try {
      return Cache.getCache<data>(hashString);
    } catch (err) {
      new Cache(
        hashString,
        supabaseBuild,
        finalOptions as Required<dbOptions<unknown>>
      );
      return Cache.getCache<data>(hashString);
    }
  };

  const [result, setResult] = useState<DbResult<data>>(cache);

  useEffect(() => {
    let isMounted = true;

    const { shouldComponentUpdate } = finalOptions;

    const unSubscribe = Cache.subscribe<data>(
      hashString,
      (cache) => {
        shouldComponentUpdate(result, cache) && isMounted && setResult(cache);
      },
      { unique: key }
    );

    return () => {
      isMounted = false;
      unSubscribe();
    };
  }, [supabaseBuild, hashString, setResult, key, result, finalOptions]);

  /**
   * SetInterval delays the execution functions by the specified time so
   * we have to create another useEffect with zero dependency to execute Function
   */

  useEffect(() => {
    const cache = Cache.getCache(hashString);

    if (cache.state === "STALE") {
      fetchData(hashString, supabaseBuild);
    }
  }, [hashString, supabaseBuild]);

  return result;
}
