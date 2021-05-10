import { PostgrestClient } from "@src/postgrest";
import { SupabaseBuild } from "@src/postgrest/lib/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { Cache, fetchData } from "./cache";
import { dbOptions, useSupabase } from "./context";
import { CreateUrl as DbCreateUrl, DbContext } from "./db";
import { getHash } from "./hash";
import { Key } from "./key";
import { DbResult } from "./useDb";
import { useGetDbOptions } from "./useGetOptions";

type CreateUrl<props> = props extends undefined
  ? (supabase: PostgrestClient) => (get: Getter) => SupabaseBuild
  : (supabase: PostgrestClient, args: props) => (get: Getter) => SupabaseBuild;

export type DeDbContext<data, props> = {
  createUrl: CreateUrl<props>;
  id: string;
  type: "DEPENDENT_REQUEST";
  options: deDbOptions<data>;
};

type deDbOptions<data> = dbOptions<data>;

export const deDb = <data, props>(
  cons: CreateUrl<props>,
  options: deDbOptions<data> = {}
): DeDbContext<data, props> => {
  return {
    createUrl: cons,
    id: Key.getUniqueKey(),
    type: "DEPENDENT_REQUEST",
    options,
  };
};

type GetterOptions<data> = {
  shouldReCalculate?: (next: DbResult<data>) => boolean;
};

type Getter = {
  <data>(
    db: DbContext<data, undefined> | DeDbContext<data, undefined>,
    args?: undefined,
    options?: GetterOptions<data>
  ): DbResult<data>;

  <data, props>(
    db: DbContext<data, props> | DeDbContext<data, undefined>,
    args: props,
    options?: GetterOptions<data>
  ): DbResult<data>;
};

const defaultShouldReCalculate = (next: DbResult<unknown>) => {
  if (next.state === "SUCCESS" || next.state === "ERROR") {
    return true;
  } else {
    return false;
  }
};
const getterHash: {
  [hookHash: string]: {
    [localHash: string]: (next: DbResult<unknown>) => boolean;
  };
} = {};

type UseDeDb = {
  <data>(
    db: DeDbContext<data, undefined>,
    args?: undefined,
    options?: deDbOptions<data>
  ): DbResult<data>;
  <data, props>(
    db: DeDbContext<data, props>,
    args: props,
    options?: deDbOptions<data>
  ): DbResult<data>;
};

export const useDeDb: UseDeDb = <data, props>(
  db: DeDbContext<data, props>,
  args?: props,
  options: deDbOptions<data> = {}
): DbResult<data> => {
  const supabase = useSupabase();
  const hash = getHash((db as unknown) as DbContext<any, any>, args);
  const finalOptions = useGetDbOptions<data>(hash, db.options, options);
  const { current: unique } = useRef(Key.getUniqueKey());

  const supabaseBuild = useCallback(() => {
    const get = createGetter(
      supabase,
      hash,
      finalOptions as Required<dbOptions<unknown>>
    );
    return typeof args !== "undefined"
      ? db.createUrl(supabase, args)(get)
      : (db.createUrl as CreateUrl<undefined>)(supabase)(get);
  }, [args, db, finalOptions, hash, supabase]);

  const cache = useCallback(
    (force?: boolean) => {
      if (Cache.cache[hash]) {
        if (force) {
          Cache.cache[hash].clearCache();
          new Cache(
            hash,
            supabaseBuild(),
            finalOptions as Required<dbOptions<unknown>>
          );
          return Cache.getCache<data>(hash);
        }

        return Cache.getCache<data>(hash);
      } else {
        new Cache(
          hash,
          supabaseBuild(),
          finalOptions as Required<dbOptions<unknown>>
        );
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

const createGetter = (
  supabase: PostgrestClient,
  hash: string,
  finalOptions: Required<dbOptions<unknown>>
): Getter => {
  const get: Getter = <data, props>(
    db: DbContext<data, props> | DeDbContext<data, props>,
    args?: props,
    options: GetterOptions<data> = {}
  ) => {
    const localHash = getHash<data, props>(db, args as props);
    if (!getterHash[hash]) {
      getterHash[hash] = {};
    }

    if (!Cache.cache[localHash]) {
      const supabaseBuild = (() => {
        if (!isDeDbContext(db)) {
          return typeof args !== "undefined"
            ? db.createUrl(supabase, args)
            : (db.createUrl as DbCreateUrl<undefined>)(supabase);
        } else {
          return typeof args !== "undefined"
            ? db.createUrl(supabase, args)(get)
            : (db.createUrl as CreateUrl<undefined>)(supabase)(get);
        }
      })();
      new Cache(localHash, supabaseBuild, finalOptions);
    }
    getterHash[hash][localHash] = options.shouldReCalculate
      ? (next) => {
          return (options.shouldReCalculate as (
            next: DbResult<unknown>
          ) => boolean)(next);
        }
      : defaultShouldReCalculate;

    return Cache.getCache(localHash);
  };
  return get;
};

const isDeDbContext = <data, props>(
  value: DbContext<data, props> | DeDbContext<data, props>
): value is DeDbContext<data, props> => {
  return value.type === "DEPENDENT_REQUEST";
};
