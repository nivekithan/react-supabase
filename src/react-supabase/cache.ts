import { SupabaseBuild } from "./types";
import { DbResult } from "./useDb";
import { dbOptions } from "./context";
import { createGetter, Getter, getterHash } from "./getter";
import { SupabaseClient } from "@src/supabase-js/SupabaseClient";
import { Subscription } from "@supabase/gotrue-js";
import { PostgrestBuilder } from "@supabase/postgrest-js";

type AuthSubsObj = {
  data: Subscription | null;
  error: Error | null;
};

type CacheHash<data> = {
  // Type of Cache
  __type: "STATIC" | "SERVER";

  // Every time there is change in result, The __sync will also change
  __sync: number;

  result: DbResult<data>;
  hash: string;

  subscribers: {
    [key: string]: (cache: DbResult<data>, force: boolean) => void;
  };

  // Recalculates the supabaseBuild
  reCalculateSupabaseBuild: (fetch?: boolean) => void;
  /*
   * Fetches the data and sets it to cache
   */
  fetch: (backgroundFetch?: boolean) => void;

  /*
   * Once the time `refetchingTimeToken` is finished we will refetch the
   * we will refetch the data and update the cache.
   *
   * stopRefetching can be used to stop the this refetching
   */
  refetchingTimeToken: NodeJS.Timeout | undefined;
  refetch: (force?: boolean, immediate?: boolean) => void;
  stopRefetch: (setCanceled?: boolean) => void;
  fetchCanceled: boolean;
  /*
   * If for time `stopRefetchingToken` the cache has no subscribers we will
   * stop refetching using `stopRefetching`
   *
   * stopStopRefetching can be used to stop this process
   */
  stopRefetchingToken: NodeJS.Timeout | undefined;
  stopRefetchWithDelay: (force?: boolean, setCanceled?: boolean) => void;
  stopStopRefetch: () => void;

  /*
   * If for time `clearCacheToken` the cache has no subscribers then we will
   * remove the cache
   *
   * We can use stopClearCache to stop this process
   */
  clearCacheToken: NodeJS.Timeout | undefined;
  clearCache: () => void;
  clearCacheWithDelay: () => void;
  stopClearCache: () => void;

  /*
   * The object returned from supabase.auth.onAuthStateChange
   */

  subsObj?: AuthSubsObj;

  /*
   * SupabaseBuild
   */
  supabaseBuild: SupabaseBuild | undefined;
} & Required<dbOptions<unknown>>;

type SetCacheOptions = {
  backgroundFetch?: boolean;
  force?: boolean;
};

export class Cache<data> {
  static cache: {
    [hash: string]: CacheHash<unknown>;
  } = {};

  static getCache<T>(hash: string): DbResult<T> {
    if (Cache.cache[hash]) {
      return Cache.cache[hash].result as DbResult<T>;
    } else {
      throw new Error(
        `Cache.getCache: There is no cache with hash ${hash} use new Cache() to create new Cache`
      );
    }
  }

  static setCache<T>(hash: string, value: DbResult<T>, options: SetCacheOptions = {}) {
    if (!Cache.cache[hash]) {
      throw new Error(
        `Cache.setCache: There is no cache with hash ${hash} use new Cache() to create new Cache`
      );
    } else {
      const { backgroundFetch = false, force = false } = options;

      Cache.cache[hash].result = value;
      Cache.cache[hash].__sync++;

      if (!backgroundFetch || ["SUCCESS", "ERROR"].includes(value.state)) {
        Object.values(Cache.cache[hash].subscribers).forEach((doOnChange) => {
          doOnChange(value, force);
        });
      }
    }
  }

  static subscribe<data>(
    hash: string,
    callOnChange: (cache: DbResult<data>, force: boolean) => void,
    afterSubscribed: (sync: number, cache: DbResult<data>) => void,
    options: {
      unique: string;
    }
  ) {
    if (Cache.cache[hash]) {
      Cache.cache[hash].stopClearCache();
      Cache.cache[hash].stopStopRefetch();

      Cache.cache[hash].subscribers[options.unique] = callOnChange as (
        cache: DbResult<unknown>,
        force: boolean
      ) => void;
      Cache.cache[hash].refetch();
      afterSubscribed(Cache.cache[hash].__sync, Cache.getCache(hash));
    } else {
      throw new Error(
        `Cache.subscribe: There is no cache with hash ${hash} use new Cache() to create new cache`
      );
    }
    return () => {
      /**
       * In some case (cache.reset() | cache.clearCache()) the cache might get deleted in those
       * cases Cache.cache[hash] wil resolve to undefined.
       *
       * That will lead to typeError
       *
       * Error: Uncaught [TypeError: Cannot read property 'subscribers' of undefined]
       *
       * Thats why we will check if cache with hash exists
       */
      if (Cache.cache[hash]) {
        delete Cache.cache[hash].subscribers[options.unique];

        if (Object.values(Cache.cache[hash].subscribers).length === 0) {
          Cache.cache[hash].stopRefetchWithDelay(false, true);
          Cache.cache[hash].clearCacheWithDelay();
        }
      }
    };
  }

  private static fromSupabaseBuild<data>(
    hash: string,
    supabaseBuild: SupabaseBuild,
    options: Required<dbOptions<data>>,
    reCalculateSupabaseBuild: () => void
  ) {
    if (Cache.cache[hash]) {
      throw new Error(
        `Cache.fromSupabaseBuild: There is already a cache with hash ${hash} use Cache.clearCache to remove the cache before creating a new one`
      );
    }
    Cache.cache[hash] = createCacheHash(
      "SERVER",
      hash,
      createSimpleState(hash, "STALE"),
      supabaseBuild,
      options as Required<dbOptions<unknown>>,
      reCalculateSupabaseBuild
    );
  }

  private static fromStatic<data>(
    hash: string,
    options: Required<dbOptions<data>>,
    result: DbResult<data>,
    reCalculateSupabaseBuild: () => void
  ) {
    if (Cache.cache[hash]) {
      throw new Error(
        `Cache.fromStatic: There is already a cache with hash ${hash} use Cache.clearCache to remove the cache before creating a new one`
      );
    }
    Cache.cache[hash] = createCacheHash(
      "STATIC",
      hash,
      result,
      undefined,
      options as Required<dbOptions<unknown>>,
      reCalculateSupabaseBuild
    );
  }

  constructor(
    supabase: SupabaseClient,
    createSupabaseBuild: () =>
      | SupabaseBuild
      | ((get: Getter, hash: string) => SupabaseBuild | DbResult<data>),

    hash: string,
    options: Required<dbOptions<data>>,
    configOptions: dbOptions<unknown>
  ) {
    if (Cache.cache[hash]) {
      throw new Error(
        `new Cache: There is already a cache with hash ${hash} use Cache.clearCache to remove it before creating a new one`
      );
    } else {
      const couldBeSupabaseBuild = createSupabaseBuild();

      const reCalculateSupabaseBuild = (fetch = true) => {
        const couldBeSupabaseBuild = createSupabaseBuild();

        Object.values(getterHash[hash] || {}).map((unSubscribe) => {
          unSubscribe();
        });

        delete getterHash[hash];

        if (typeof couldBeSupabaseBuild !== "function") {
          Cache.cache[hash].supabaseBuild = couldBeSupabaseBuild;
          Cache.cache[hash].__type = "SERVER";

          if (fetch) {
            !Cache.cache[hash].fetchCanceled && Cache.cache[hash].fetch();
            !Cache.cache[hash].fetchCanceled && Cache.cache[hash].refetch();
          }
        } else {
          const get = createGetter(supabase, hash, configOptions);
          const couldBeSupabaseBuild2 = couldBeSupabaseBuild(get, hash);

          if (couldBeSupabaseBuild2 instanceof PostgrestBuilder) {
            Cache.cache[hash].supabaseBuild = couldBeSupabaseBuild2;
            Cache.cache[hash].__type = "SERVER";

            if (fetch) {
              !Cache.cache[hash].fetchCanceled && Cache.cache[hash].fetch();
              !Cache.cache[hash].fetchCanceled && Cache.cache[hash].refetch();
            }
            return;
          } else {
            Cache.cache[hash].supabaseBuild = undefined;
            Cache.cache[hash].__type = "STATIC";
            Cache.setCache(hash, couldBeSupabaseBuild2 as DbResult<unknown>);
            Cache.cache[hash].stopRefetch();
            Cache.cache[hash].stopStopRefetch();
            return;
          }
        }
      };

      if (typeof couldBeSupabaseBuild !== "function") {
        Cache.fromSupabaseBuild(hash, couldBeSupabaseBuild, options, reCalculateSupabaseBuild);

        const subsObj = supabase.auth.onAuthStateChange((e, session) => {
          switch (typeof options.resetCacheOnAuthChange) {
            case "boolean":
              if (options.resetCacheOnAuthChange) {
                Cache.setCache(hash, createSimpleState(hash, "STALE"), {
                  backgroundFetch: false,
                  force: true,
                });
                Cache.cache[hash].reCalculateSupabaseBuild();
                return;
              } else {
                Cache.cache[hash].reCalculateSupabaseBuild(false);
                return;
              }
            case "function":
              if (options.resetCacheOnAuthChange(e, session)) {
                Cache.setCache(hash, createSimpleState(hash, "STALE"), {
                  backgroundFetch: false,
                  force: true,
                });
                Cache.cache[hash].reCalculateSupabaseBuild();
                return;
              } else {
                Cache.cache[hash].reCalculateSupabaseBuild(false);
                return;
              }
          }
        });
        Cache.cache[hash].subsObj = subsObj;

        return;
      } else {
        // We will be creating a temporally cache state
        Cache.fromStatic(hash, options, createSimpleState(hash, "STALE"), reCalculateSupabaseBuild);

        const subsObj = supabase.auth.onAuthStateChange((e, session) => {
          switch (typeof options.resetCacheOnAuthChange) {
            case "boolean":
              if (options.resetCacheOnAuthChange) {
                Cache.setCache(hash, createSimpleState(hash, "STALE"), {
                  backgroundFetch: false,
                  force: true,
                });
                Cache.cache[hash].reCalculateSupabaseBuild();
                return;
              } else {
                Cache.cache[hash].reCalculateSupabaseBuild(false);
                return;
              }
            case "function":
              if (options.resetCacheOnAuthChange(e, session)) {
                Cache.setCache(hash, createSimpleState(hash, "STALE"), {
                  backgroundFetch: false,
                  force: true,
                });
                Cache.cache[hash].reCalculateSupabaseBuild();
                return;
              } else {
                Cache.cache[hash].reCalculateSupabaseBuild(false);
                return;
              }
          }
        });
        Cache.cache[hash].subsObj = subsObj;

        const get = createGetter(supabase, hash, configOptions);
        const couldBeSupabaseBuild2 = couldBeSupabaseBuild(get, hash);

        if (couldBeSupabaseBuild2 instanceof PostgrestBuilder) {
          Cache.cache[hash].supabaseBuild = couldBeSupabaseBuild2;
          Cache.cache[hash].__type = "SERVER";

          Cache.cache[hash].fetch();
          Cache.cache[hash].refetch();
          return;
        } else {
          Cache.cache[hash].supabaseBuild = undefined;
          Cache.cache[hash].__type = "STATIC";
          Cache.setCache(hash, couldBeSupabaseBuild2 as DbResult<unknown>);
          Cache.cache[hash].stopRefetch();
          Cache.cache[hash].stopStopRefetch();
          return;
        }
      }
    }
  }

  static reset() {
    Object.values(Cache.cache).forEach((cache) => {
      cache.clearCache();
    });

    Cache.cache = {};
  }

  static getOptions<key extends keyof Required<dbOptions<unknown>>>(hash: string, key: key) {
    if (Cache.cache[hash]) {
      return Cache.cache[hash][key];
    } else {
      throw new Error(
        `Cache.getOptions: There is no cache with hash ${hash} use new Cache() to create new cache`
      );
    }
  }

  static setOptions(hash: string, options: dbOptions<unknown>) {
    if (Cache.cache[hash]) {
      if (typeof options.cacheTime !== "undefined") {
        Cache.cache[hash].stopRefetch();
      }

      Cache.cache[hash] = {
        ...Cache.cache[hash],
        ...options,
      };

      if (typeof options.cacheTime !== "undefined") {
        !Cache.cache[hash].fetchCanceled && Cache.cache[hash].refetch();
      }
    } else {
      throw new Error(
        `Cache.setOptions: There is no cache with hash ${hash} use new Cache() to create new cache`
      );
    }
  }
}

type FetchDataIntervalOptions = {
  interval: number;
};

const fetchDataWithInterval = (hash: string, options: FetchDataIntervalOptions) => {
  const { interval } = options;
  const cache = () => {
    return Cache.getCache<unknown>(hash);
  };

  const timeToken = setInterval(() => {
    try {
      const backgroundFetch = Cache.getOptions(hash, "backgroundFetch");
      Cache.setCache(hash, createSimpleState(hash, "STALE"), {
        backgroundFetch,
      });
      if (cache().state === "STALE") {
        fetchData(hash, { backgroundFetch });
      }
    } catch (err) {
      return;
    }
  }, interval);

  return timeToken;
};

type FetchDataOptions = {
  backgroundFetch?: boolean;
};

export const fetchData = async (hash: string, options: FetchDataOptions = {}) => {
  try {
    const { backgroundFetch } = options;
    const retry = Cache.getOptions(hash, "retry");

    const supabaseBuild = Cache.cache[hash].supabaseBuild;

    if (!supabaseBuild) {
      throw new Error(
        `The cache with hash ${hash} cannot do api calls. Make sure that the Cache.cache[hash].supabaseBuild is not undefined`
      );
    }

    Cache.setCache(hash, createSimpleState(hash, "LOADING"), {
      backgroundFetch,
    });
    let i = 0;
    let dbResult: DbResult<unknown> = createSimpleState(hash, "STALE");

    do {
      const postgrestResponse = await supabaseBuild;

      if (postgrestResponse.data) {
        dbResult = {
          state: "SUCCESS",
          data: postgrestResponse.data,
          error: undefined,
          status: postgrestResponse.status,
          statusText: postgrestResponse.statusText,
          hash,
        };
        break;
      } else if (i === retry) {
        dbResult = {
          state: "ERROR",
          data: undefined,
          error: postgrestResponse.error,
          status: postgrestResponse.status,
          statusText: postgrestResponse.statusText,
          hash,
        };

        break;
      } else {
        i++;
      }
    } while (i < retry + 1);

    Cache.setCache(hash, dbResult, {
      backgroundFetch,
    });
  } catch (err) {
    return;
  }
};

export const createSimpleState = <data>(
  hash: string,
  state: "STALE" | "LOADING"
): DbResult<data> => {
  return {
    state,
    hash,
    data: undefined,
    error: undefined,
    status: undefined,
    statusText: undefined,
  };
};

const createCacheHash = (
  type: "SERVER" | "STATIC",
  hash: string,
  result: DbResult<unknown>,
  supabaseBuild: SupabaseBuild | undefined,
  options: Required<dbOptions<unknown>>,
  reCalculateSupabaseBuild: () => void,
  authSubsObj?: AuthSubsObj
): CacheHash<unknown> => {
  return {
    // TYPE
    __type: type,
    __sync: 0,
    result,
    hash,
    subscribers: {},

    //  Interval and timeouts timetoken
    refetchingTimeToken: undefined,
    stopRefetchingToken: undefined,
    clearCacheToken: undefined,

    // Options
    ...options,

    // Supabase build
    supabaseBuild,

    reCalculateSupabaseBuild,

    fetch(backgroundFetch?: boolean) {
      if (Cache.cache[hash].fetchCanceled) {
        Cache.cache[hash].fetchCanceled = false;
      }

      const supabaseBuild = Cache.cache[hash].supabaseBuild;

      if (supabaseBuild) {
        if (typeof backgroundFetch === "undefined") {
          backgroundFetch = Cache.getOptions(hash, "backgroundFetch");
        }
        fetchData(hash, { backgroundFetch });
      }
    },

    stopRefetch: (setCanceled?: boolean) => {
      /**
       * If there is not a timeToken then we wont clear it
       */

      if (setCanceled) {
        Cache.cache[hash].fetchCanceled = true;
      }

      const timeToken = Cache.cache[hash].refetchingTimeToken;

      if (timeToken) {
        clearInterval(timeToken);
        Cache.cache[hash].refetchingTimeToken = undefined;
      }
    },

    refetch(force?: boolean, immediate?: boolean) {
      if (Cache.cache[hash].fetchCanceled) {
        Cache.cache[hash].fetchCanceled = false;
        immediate = true;
      }

      /**
       *
       * If there is already timeToken then refetching is already in progress
       * so there is no need to start a new one expect if force is true
       * then we have we will start the refetching
       *
       */

      if (Cache.cache[hash].refetchingTimeToken) {
        if (!force) {
          return;
        }

        Cache.cache[hash].stopRefetch();
      }

      const interval = Cache.getOptions(hash, "cacheTime");

      if (immediate) {
        Cache.cache[hash].fetch();
      }

      const supabaseBuild = Cache.cache[hash].supabaseBuild;

      if (supabaseBuild) {
        const timeToken = fetchDataWithInterval(hash, { interval });

        Cache.cache[hash].refetchingTimeToken = timeToken;
      }
    },

    stopRefetchWithDelay(force?: boolean, setCanceled?: boolean) {
      const stopRefetchingToken = Cache.cache[hash].stopRefetchingToken;

      if (stopRefetchingToken) {
        // The startStopRefetching process is already in progress

        if (!force) {
          return;
        }

        Cache.cache[hash].stopStopRefetch();
      }

      const timeToken = setTimeout(() => {
        Cache.cache[hash]?.stopRefetch(setCanceled);
      }, Cache.getOptions(hash, "stopRefetchTimeout"));

      Cache.cache[hash].stopRefetchingToken = timeToken;
    },

    stopStopRefetch() {
      const stopRefetchingToken = Cache.cache[hash].stopRefetchingToken;

      if (stopRefetchingToken) {
        clearTimeout(stopRefetchingToken);
        Cache.cache[hash].stopRefetchingToken = undefined;
      } else {
        return;
      }
    },

    clearCache() {
      Cache.cache[hash].stopRefetch();
      Cache.cache[hash].stopStopRefetch();
      Cache.cache[hash].subsObj?.data?.unsubscribe();

      const clearCacheToken = Cache.cache[hash].clearCacheToken;

      if (clearCacheToken) {
        clearTimeout(clearCacheToken);
        Cache.cache[hash].clearCacheToken = undefined;
      }

      Object.values(getterHash[hash] || {}).map((unSubs) => {
        unSubs();
      });
      delete getterHash[hash];

      delete Cache.cache[hash];
    },

    clearCacheWithDelay(force?: boolean) {
      const clearCacheToken = Cache.cache[hash].clearCacheToken;

      if (clearCacheToken) {
        // The process already started

        if (!force) {
          return;
        }

        Cache.cache[hash].stopClearCache();
      }

      const clearCacheTimeout = Cache.getOptions(hash, "clearCacheTimeout");
      const timeToken = setTimeout(() => {
        Cache.cache[hash]?.clearCache();
      }, clearCacheTimeout);

      Cache.cache[hash].clearCacheToken = timeToken;
    },

    stopClearCache() {
      const clearCacheToken = Cache.cache[hash].clearCacheToken;

      if (!clearCacheToken) {
        // There is no process to stop
        return;
      }

      clearTimeout(clearCacheToken);
      Cache.cache[hash].clearCacheToken = undefined;
    },

    ...authSubsObj,

    fetchCanceled: false,
  };
};
