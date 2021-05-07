import { PostgrestClient } from "@src/postgrest";
import { SupabaseBuild } from "@src/postgrest/lib/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { Cache, fetchData } from "./cache";
import { useSupabase } from "./context";
import { CreateUrl as DbCreateUrl, DbContext } from "./db";
import { getHash } from "./hash";
import { Key } from "./key";
import { DbResult } from "./useDb";
import { useGetOptions } from "./useGetOptions";

type CreateUrl<props> = props extends undefined
  ? (supabase: PostgrestClient) => (get: Getter) => SupabaseBuild
  : (supabase: PostgrestClient, args: props) => (get: Getter) => SupabaseBuild;

type DeDbContext<data, props> = {
  createUrl: CreateUrl<props>;
  id: string;
  type: "DEPENDENT_REQUEST";
};

export const deDb = <data, props>(
  cons: CreateUrl<props>
): DeDbContext<data, props> => {
  return {
    createUrl: cons,
    id: Key.getUniqueKey(),
    type: "DEPENDENT_REQUEST",
  };
};

type GetterOptions<data> = {
  shouldReCalculate?: (next: DbResult<data>) => boolean;
};

type Getter = {
  <data>(
    db: DbContext<data, undefined>,
    args?: undefined,
    options?: GetterOptions<data>
  ): DbResult<data>;

  <data, props>(
    db: DbContext<data, props>,
    args: props,
    options?: GetterOptions<data>
  ): DbResult<data>;
};

type ImplementationGetter = <data, props>(
  db: DbContext<data, props>,
  args?: props,
  options?: GetterOptions<data>
) => DbResult<data>;

const getterHash: {
  [hookHash: string]: {
    [localHash: string]: (next: DbResult<unknown>) => boolean;
  };
} = {};

type UseDeDb = {
  <data>(db: DeDbContext<data, undefined>, args?: undefined): DbResult<data>;
  <data, props>(db: DeDbContext<data, props>, args: props): DbResult<data>;
};

const defaultOptions = (next: DbResult<unknown>) => {
  if (next.state === "SUCCESS" || next.state === "ERROR") {
    return true;
  } else {
    return false;
  }
};

export const useDeDb: UseDeDb = <data, props>(
  db: DeDbContext<data, props>,
  args?: props
): DbResult<data> => {
  const supabase = useSupabase();
  const hash = getHash((db as unknown) as DbContext<any, any>, args);
  const finalOptions = useGetOptions(hash, {}, {});
  const { current: unique } = useRef(Key.getUniqueKey());

  const get: Getter = useCallback<ImplementationGetter>(
    (db, props, options = {}) => {
      const localHash = getHash(db, props);
      if (!getterHash[hash]) {
        getterHash[hash] = {};
      }

      if (!Cache.cache[localHash]) {
        const supabaseBuild =
          typeof props !== "undefined"
            ? db.createUrl(supabase, props)
            : (db.createUrl as DbCreateUrl<undefined>)(supabase);
        new Cache(localHash, supabaseBuild, finalOptions);
      }
      getterHash[hash][localHash] = options.shouldReCalculate
        ? (next) => {
            return (options.shouldReCalculate as (
              next: DbResult<unknown>
            ) => boolean)(next);
          }
        : defaultOptions;

      return Cache.getCache(localHash);
    },
    [finalOptions, hash, supabase]
  );

  const supabaseBuild = useCallback(
    () =>
      typeof args !== "undefined"
        ? db.createUrl(supabase, args)(get)
        : (db.createUrl as CreateUrl<undefined>)(supabase)(get),
    [args, db, get, supabase]
  );

  const cache = useCallback(
    (force?: boolean) => {
      if (Cache.cache[hash]) {
        if (force) {
          Cache.cache[hash].clearCache();
          new Cache(hash, supabaseBuild(), finalOptions);
          return Cache.getCache<data>(hash);
        }

        return Cache.getCache<data>(hash);
      } else {
        new Cache(hash, supabaseBuild(), finalOptions);
        return Cache.getCache<data>(hash);
      }
    },
    [finalOptions, hash, supabaseBuild]
  );

  const [result, setResult] = useState(cache);

  if (result.hash !== hash) {
    setResult(cache());
  }

  useEffect(() => {
    let mounted = true;
    const { shouldComponentUpdate } = finalOptions;

    // Main subscriptions
    const unSubscribe = Cache.subscribe<data>(
      hash,
      (cache) => {
        console.log("Main subscription");
        shouldComponentUpdate(result, cache) && mounted && setResult(cache);
      },
      { unique }
    );

    // Dependent Subscription

    const dependentUnSubscribe = Object.keys(getterHash[hash]).map(
      (depHash) => {
        return Cache.subscribe(
          depHash,
          (dependentCache) => {
            console.log("Dependent subscription");

            if (getterHash[hash][depHash](dependentCache)) {
              const newCache = cache(true);
              mounted &&
                shouldComponentUpdate(result, newCache) &&
                setResult(newCache);
            }
          },
          { unique }
        );
      }
    );

    return () => {
      mounted = false;
      unSubscribe();
      dependentUnSubscribe.map((unSubscribe) => unSubscribe());
    };
  }, [cache, finalOptions, hash, result, unique]);

  useEffect(() => {
    const cache = Cache.getCache(hash);

    if (cache.state === "STALE") {
      fetchData(hash, supabaseBuild());
    }
  }, [hash, supabaseBuild]);

  return result;
};
