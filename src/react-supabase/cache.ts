import { SupabaseBuild } from "../postgrest/lib/types";
import { DbResult } from "./db";
import { fetch } from "cross-fetch";

type CacheHash = {
  result: DbResult<unknown>;
  subscribers: {
    [key: string]: (cache: DbResult<unknown>) => void;
  };
  stopRefetching: () => void;
  startRefetching: (immediate?: boolean) => void;
  refetchingTimeInterval: NodeJS.Timeout | undefined;
  stopRefetchingTimeout: NodeJS.Timeout | undefined;
};

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
      throw new Error("setCache: There is no cache with the hash: " + hash);
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
    }
  ) {
    if (Cache.cache[hash]) {
      const stopRefetchTimeout = Cache.cache[hash].stopRefetchingTimeout;
      if (stopRefetchTimeout) {
        clearTimeout(stopRefetchTimeout);
        Cache.cache[hash].stopRefetchingTimeout = undefined;
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
       * Thats why optional chaining
       */
      if (Cache.cache[hash]) {
        delete Cache.cache[hash].subscribers[options.unique];

        if (Object.values(Cache.cache[hash].subscribers).length === 0) {
          const timeToken = setTimeout(() => {
            Cache.cache[hash]?.stopRefetching();
          }, options.stopRefetchTimeout);
          Cache.cache[hash].stopRefetchingTimeout = timeToken;
        }
      }
    };
  }

  static createNewCache(
    hash: string,
    supabaseBuild: SupabaseBuild,
    options: {
      interval: number;
      backgroundFetch: boolean;
      retry: number;
    }
  ) {
    if (Cache.cache[hash]) {
      throw new Error("There is already a cache with hash: " + hash);
    } else {
      const { backgroundFetch, interval, retry } = options;
      Cache.cache[hash] = {
        result: {
          data: undefined,
          error: undefined,
          state: "STALE",
        },

        subscribers: {},

        refetchingTimeInterval: undefined,
        stopRefetchingTimeout: undefined,

        stopRefetching: () => {
          /**
           * If there is not a timeToken then we wont clear it
           */

          const timeToken = Cache.cache[hash]?.refetchingTimeInterval;

          if (timeToken) {
            clearInterval(timeToken);
            Cache.cache[hash].refetchingTimeInterval = undefined;
          }

          return;
        },

        startRefetching: (immediate?: boolean) => {
          /**
           * If there is already timeToken then refetching is already in progress
           * so there is no need to start a new one
           */

          if (Cache.cache[hash]?.refetchingTimeInterval) {
            return;
          }
          if (immediate) {
            fetchData(hash, supabaseBuild, { retry, backgroundFetch });
          }
          const timeToken = fetchDataWithInterval(hash, supabaseBuild, {
            backgroundFetch,
            interval,
            retry,
          });

          Cache.cache[hash].refetchingTimeInterval = timeToken;
        },
      };
    }
  }

  static reset() {
    Object.values(Cache.cache).forEach((cache) => {
      cache.stopRefetching();
      if (cache.stopRefetchingTimeout) {
        clearTimeout(cache.stopRefetchingTimeout);
      }
    });

    Cache.cache = {};
  }
}

type FetchDataIntervalOptions = {
  interval: number;
  backgroundFetch: boolean;
  retry: number;
};

const fetchDataWithInterval = (
  hash: string,
  supabaseBuild: SupabaseBuild,
  options: FetchDataIntervalOptions
) => {
  const { interval, backgroundFetch, retry } = options;
  const cache = () => {
    return Cache.getCache<unknown>(hash);
  };

  const timeToken = setInterval(() => {
    Cache.setCache(
      hash,
      {
        data: undefined,
        error: undefined,
        state: "STALE",
      },
      {
        backgroundFetch,
      }
    );
    if (cache().state === "STALE") {
      fetchData(hash, supabaseBuild, { backgroundFetch, retry });
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
  const { backgroundFetch, retry } = options;
  Cache.setCache(
    hash,
    {
      state: "LOADING",
      data: undefined,
      error: undefined,
    },
    {
      backgroundFetch,
    }
  );
  let i = 0;
  let dbResult: DbResult<unknown> = {
    state: "STALE",
    error: undefined,
    data: undefined,
  };

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
      };
      break;
    } else if (i === retry) {
      dbResult = {
        state: "ERROR",
        data: undefined,
        error: await result.json(),
      };
      break;
    } else {
      i++;
    }
  } while (i < retry + 1);

  Cache.setCache(hash, dbResult, {
    backgroundFetch,
  });
};
