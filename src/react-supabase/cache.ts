import { SupabaseBuild } from "../postgrest/lib/types";
import { DbResult } from "./useDb";
import { fetch } from "cross-fetch";
import { SupabaseOptions } from "./context";

type CacheHash = {
  result: DbResult<unknown>;

  subscribers: {
    [key: string]: (cache: DbResult<unknown>) => void;
  };
  stopRefetching: () => void;
  startRefetching: (immediate?: boolean) => void;
  clearCache: () => void;

  // Timeouts and interval tokes
  refetchingTimeToken: NodeJS.Timeout | undefined;
  stopRefetchingToken: NodeJS.Timeout | undefined;
  clearCacheToken: NodeJS.Timeout | undefined;
} & Required<SupabaseOptions<unknown>>;

type SetCacheOptions = {
  backgroundFetch?: boolean;
};

export class Cache {
  static cache: {
    [hash: string]: CacheHash;
  } = {};

  static getCache<T>(hash: string): DbResult<T> {
    if (Cache.cache[hash]) {
      return Cache.cache[hash].result as DbResult<T>;
    } else {
      throw new Error("getCache: There is no cache with hash: " + hash);
    }
  }

  static setCache<T>(
    hash: string,
    value: DbResult<T>,
    options: SetCacheOptions = {}
  ) {
    if (!Cache.cache[hash]) {
      throw new Error("There is no cache with hash: " + hash);
    } else {
      const { backgroundFetch = false } = options;

      Cache.cache[hash].result = value;

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
    options: {
      unique: string;
      stopRefetchTimeout: number;
      clearCacheTimeout: number;
    }
  ) {
    if (Cache.cache[hash]) {
      const stopRefetchTimeout = Cache.cache[hash].stopRefetchingToken;
      if (stopRefetchTimeout) {
        clearTimeout(stopRefetchTimeout);
        Cache.cache[hash].stopRefetchingToken = undefined;
      }

      const clearCacheTimeout = Cache.cache[hash].clearCacheToken;

      if (clearCacheTimeout) {
        clearTimeout(clearCacheTimeout);
        Cache.cache[hash].clearCacheToken = undefined;
      }

      Cache.cache[hash].subscribers[options.unique] = callOnChange as (
        cache: DbResult<unknown>
      ) => void;
      Cache.cache[hash].startRefetching();
    } else {
      throw new Error("There is no cache with hash: " + hash);
    }
    return () => {
      /**
       * In some case (cache.reset()) the cache might get deleted in those
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
          /**
           * If there are no subscribers for stopRefetchTimeout then
           * we wont refetch the requests automatically
           */

          const stopRefetchingTimeToken = setTimeout(() => {
            Cache.cache[hash]?.stopRefetching();
          }, options.stopRefetchTimeout);

          Cache.cache[hash].stopRefetchingToken = stopRefetchingTimeToken;

          /**
           * If there are no subscribers for clearCacheTimeout then
           * we will remove the cache itself
           */

          const clearCacheTimeout = setTimeout(() => {
            Cache.cache[hash]?.clearCache();
          }, options.clearCacheTimeout);
          Cache.cache[hash].clearCacheToken = clearCacheTimeout;
        }
      }
    };
  }

  constructor(
    hash: string,
    supabaseBuild: SupabaseBuild,
    options: Required<SupabaseOptions<unknown>>
  ) {
    if (Cache.cache[hash]) {
      throw new Error("There is already a cache with hash: " + hash);
    } else {
      Cache.cache[hash] = {
        result: createSimpleState("STALE"),

        subscribers: {},

        //  Interval and timeouts timetoken
        refetchingTimeToken: undefined,
        stopRefetchingToken: undefined,
        clearCacheToken: undefined,

        // Options
        ...options,

        stopRefetching: () => {
          /**
           * If there is not a timeToken then we wont clear it
           */

          const timeToken = Cache.cache[hash]?.refetchingTimeToken;

          if (timeToken) {
            clearInterval(timeToken);
            Cache.cache[hash].refetchingTimeToken = undefined;
          }

          return;
        },

        startRefetching: (force?: boolean, immediate?: boolean) => {
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

            Cache.cache[hash].stopRefetching();
          }

          const retry = Cache.getOptions(hash, "retry");
          const backgroundFetch = Cache.getOptions(hash, "backgroundFetch");
          const interval = Cache.getOptions(hash, "cacheTime");

          if (immediate) {
            fetchData(hash, supabaseBuild, {
              retry,
              backgroundFetch,
            });
          }
          const timeToken = fetchDataWithInterval(hash, supabaseBuild, {
            interval,
          });

          Cache.cache[hash].refetchingTimeToken = timeToken;
        },

        clearCache: () => {
          Cache.cache[hash].stopRefetching();
          const stopRefetchingToken = Cache.cache[hash].stopRefetchingToken;

          if (stopRefetchingToken) {
            clearTimeout(stopRefetchingToken);
            Cache.cache[hash].stopRefetchingToken = undefined;
          }

          const clearCacheToken = Cache.cache[hash].clearCacheToken;

          if (clearCacheToken) {
            clearTimeout(clearCacheToken);
          }

          delete Cache.cache[hash];
        },
      };
    }
  }

  static reset() {
    Object.values(Cache.cache).forEach((cache) => {
      cache.clearCache();
    });

    Cache.cache = {};
  }

  static getOptions<key extends keyof Required<SupabaseOptions<unknown>>>(
    hash: string,
    key: key
  ) {
    if (Cache.cache[hash]) {
      return Cache.cache[hash][key];
    } else {
      throw new Error("Cache.getOptions: There is no cache with hash: " + hash);
    }
  }

  static setOptions(hash: string, options: SupabaseOptions<unknown>) {
    if (Cache.cache[hash]) {
      if (typeof options.cacheTime !== "undefined") {
        Cache.cache[hash].stopRefetching();
      }

      Cache.cache[hash] = {
        ...Cache.cache[hash],
        ...options,
      };

      if (typeof options.cacheTime !== "undefined") {
        Cache.cache[hash].startRefetching();
      }
    } else {
      throw new Error("Cache.setOptions: There is no cache with hash: " + hash);
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
      const retry = Cache.getOptions(hash, "retry");
      Cache.setCache(hash, createSimpleState("STALE"), {
        backgroundFetch,
      });
      if (cache().state === "STALE") {
        fetchData(hash, supabaseBuild, { backgroundFetch, retry });
      }
    } catch (err) {
      return;
    }
  }, interval);

  return timeToken;
};

type FetchDataOptions = {
  backgroundFetch?: boolean;
  retry: number;
};

export const fetchData = async (
  hash: string,
  supabaseBuild: SupabaseBuild,
  options: FetchDataOptions
) => {
  try {
    const { backgroundFetch, retry } = options;
    Cache.setCache(hash, createSimpleState("LOADING"), {
      backgroundFetch,
    });
    let i = 0;
    let dbResult: DbResult<unknown> = createSimpleState("STALE");

    do {
      const result = await fetch(supabaseBuild.url.toString(), {
        headers: supabaseBuild.headers,
        method: supabaseBuild.method,
      });

      if (result.ok) {
        let count: number | undefined;

        const countHeader = supabaseBuild.headers["Prefer"]?.match(
          /count=(exact|planned|estimated)/
        );
        const contentRange = result.headers.get("content-range")?.split("/");
        if (countHeader && contentRange && contentRange.length > 1) {
          count = parseInt(contentRange[1]);
        }

        dbResult = {
          state: "SUCCESS",
          data: JSON.parse(await result.text()),
          error: undefined,
          count,
          status: result.status,
          statusText: result.statusText,
        };
        break;
      } else if (i === retry) {
        dbResult = {
          state: "ERROR",
          data: undefined,
          error: await result.json(),
          count: undefined,
          status: result.status,
          statusText: result.statusText,
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

const createSimpleState = <data>(
  state: "STALE" | "LOADING"
): DbResult<data> => {
  return {
    state,
    count: undefined,
    data: undefined,
    error: undefined,
    status: undefined,
    statusText: undefined,
  };
};
