import { SupabaseBuild } from "../postgrest/lib/types";
import { DbResult } from "./useDb";
import { fetch } from "cross-fetch";
import { dbOptions } from "./context";
import { createGetter, Getter, getterHash } from "./getter";
import { PostgrestClient } from "@src/postgrest";

type CacheHash<data> = {
  // Type of Cache
  __type: "STATIC" | "SERVER";

  // Every time there is change in result, The __sync will also change
  __sync: number;

  result: DbResult<data>;
  hash: string;

  subscribers: {
    [key: string]: (cache: DbResult<data>) => void;
  };

  // Recalculates the supabaseBuild
  reCalculateSupabaseBuild: () => void;
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
  stopRefetch: () => void;

  /*
   * If for time `stopRefetchingToken` the cache has no subscribers we will
   * stop refetching using `stopRefetching`
   *
   * stopStopRefetching can be used to stop this process
   */
  stopRefetchingToken: NodeJS.Timeout | undefined;
  stopRefetchWithDelay: (force?: boolean) => void;
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
} & Required<dbOptions<unknown>> &
  (SupabaseBuild | Record<keyof SupabaseBuild, undefined>);

type SetCacheOptions = {
  backgroundFetch?: boolean;
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
      const { backgroundFetch = false } = options;

      Cache.cache[hash].result = value;
      Cache.cache[hash].__sync++;

      if (!backgroundFetch || ["SUCCESS", "ERROR"].includes(value.state)) {
        Object.values(Cache.cache[hash].subscribers).forEach((doOnChange) => {
          doOnChange(value);
        });
      }
    }
  }

  static subscribe<data>(
    hash: string,
    callOnChange: (cache: DbResult<data>) => void,
    afterSubscribed: (sync: number, cache: DbResult<data>) => void,
    options: {
      unique: string;
    }
  ) {
    if (Cache.cache[hash]) {
      Cache.cache[hash].stopClearCache();
      Cache.cache[hash].stopStopRefetch();

      Cache.cache[hash].subscribers[options.unique] = callOnChange as (
        cache: DbResult<unknown>
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
          Cache.cache[hash].stopRefetchWithDelay();
          Cache.cache[hash].clearCacheWithDelay();
        }
      }
    };
  }

  static fromSupabaseBuild<data>(
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

  static fromStatic<data>(
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
      { headers: undefined, url: undefined, method: undefined },
      options as Required<dbOptions<unknown>>,
      reCalculateSupabaseBuild
    );
  }

  constructor(
    supabase: PostgrestClient,
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

      const reCalculateSupabaseBuild = () => {
        const couldBeSupabaseBuild = createSupabaseBuild();

        Object.values(getterHash[hash]).map((unSubscribe) => {
          unSubscribe();
        });

        delete getterHash[hash];

        if (typeof couldBeSupabaseBuild !== "function") {
          throw new Error(
            "If you are creating dependent db, make sure that the first function should always return a function. It seems that you are dynamically changing weather a db is dependent or not"
          );
        } else {
          const get = createGetter(supabase, hash, configOptions);
          const couldBeSupabaseBuild2 = couldBeSupabaseBuild(get, hash);

          if ((couldBeSupabaseBuild2 as SupabaseBuild).method) {
            Cache.cache[hash].url = (couldBeSupabaseBuild2 as SupabaseBuild).url;
            Cache.cache[hash].method = (couldBeSupabaseBuild2 as SupabaseBuild).method;
            Cache.cache[hash].headers = (couldBeSupabaseBuild2 as SupabaseBuild).headers;
            Cache.cache[hash].__type = "SERVER";

            Cache.cache[hash].fetch();
            Cache.cache[hash].refetch();
            return;
          } else {
            Cache.cache[hash].url = undefined;
            Cache.cache[hash].method = undefined;
            Cache.cache[hash].headers = undefined;
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
        return;
      } else {
        // We will be creating a temporally cache state
        Cache.fromStatic(hash, options, createSimpleState(hash, "STALE"), reCalculateSupabaseBuild);
        const get = createGetter(supabase, hash, configOptions);
        const couldBeSupabaseBuild2 = couldBeSupabaseBuild(get, hash);

        if ((couldBeSupabaseBuild2 as SupabaseBuild).method) {
          Cache.cache[hash].url = (couldBeSupabaseBuild2 as SupabaseBuild).url;
          Cache.cache[hash].method = (couldBeSupabaseBuild2 as SupabaseBuild).method;
          Cache.cache[hash].headers = (couldBeSupabaseBuild2 as SupabaseBuild).headers;
          Cache.cache[hash].__type = "SERVER";

          Cache.cache[hash].fetch();
          Cache.cache[hash].refetch();
          return;
        } else {
          Cache.cache[hash].url = undefined;
          Cache.cache[hash].method = undefined;
          Cache.cache[hash].headers = undefined;
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
        Cache.cache[hash].refetch();
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

const fetchDataWithInterval = (
  hash: string,
  supabaseBuild: SupabaseBuild,
  options: FetchDataIntervalOptions
) => {
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
        fetchData(hash, supabaseBuild, { backgroundFetch });
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

export const fetchData = async (
  hash: string,
  supabaseBuild: SupabaseBuild,
  options: FetchDataOptions = {}
) => {
  try {
    const { backgroundFetch } = options;
    const retry = Cache.getOptions(hash, "retry");
    Cache.setCache(hash, createSimpleState(hash, "LOADING"), {
      backgroundFetch,
    });
    let i = 0;
    let dbResult: DbResult<unknown> = createSimpleState(hash, "STALE");

    do {
      const result = await fetch(supabaseBuild.url.toString(), {
        headers: supabaseBuild.headers,
        method: supabaseBuild.method,
      });

      if (result.ok) {
        dbResult = {
          state: "SUCCESS",
          data: JSON.parse(await result.text()),
          error: undefined,
          status: result.status,
          statusText: result.statusText,
          hash,
        };
        break;
      } else if (i === retry) {
        dbResult = {
          state: "ERROR",
          data: undefined,
          error: await result.json(),
          status: result.status,
          statusText: result.statusText,
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
  supabaseBuild: SupabaseBuild | Record<keyof SupabaseBuild, undefined>,
  options: Required<dbOptions<unknown>>,
  reCalculateSupabaseBuild: () => void
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
    ...supabaseBuild,

    reCalculateSupabaseBuild,

    fetch(backgroundFetch?: boolean) {
      const url = this.url;
      const method = this.method;
      const headers = this.headers;

      if (url && method && headers) {
        if (typeof backgroundFetch === "undefined") {
          backgroundFetch = Cache.getOptions(hash, "backgroundFetch");
        }
        fetchData(hash, { url, method, headers }, { backgroundFetch });
      }
    },

    stopRefetch: () => {
      /**
       * If there is not a timeToken then we wont clear it
       */

      const timeToken = Cache.cache[hash].refetchingTimeToken;

      if (timeToken) {
        clearInterval(timeToken);
        Cache.cache[hash].refetchingTimeToken = undefined;
      }
    },

    refetch(force?: boolean, immediate?: boolean) {
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

      const url = this.url;
      const method = this.method;
      const headers = this.headers;

      if (url && method && headers) {
        const timeToken = fetchDataWithInterval(hash, { url, method, headers }, { interval });

        Cache.cache[hash].refetchingTimeToken = timeToken;
      }
    },

    stopRefetchWithDelay(force?: boolean) {
      const stopRefetchingToken = Cache.cache[hash].stopRefetchingToken;

      if (stopRefetchingToken) {
        // The startStopRefetching process is already in progress

        if (!force) {
          return;
        }

        Cache.cache[hash].stopStopRefetch();
      }

      const timeToken = setTimeout(() => {
        Cache.cache[hash]?.stopRefetch();
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
  };
};
