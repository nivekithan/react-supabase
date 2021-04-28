import { SupabaseBuild } from "../postgrest/lib/types";
import { DbResult } from "./db";
import { fetch } from "cross-fetch";

type CacheHash = {
  result: DbResult<unknown>;
  subscribers: {
    [key: string]: (cache: DbResult<unknown>) => void;
  };
  stopFetching: () => void;
};

type SetCacheOptions = {
  backgroundFetch?: boolean;
};

export class Cache {
  private static cache: {
    [hash: string]: CacheHash;
  } = {};

  static getCache<T>(hash: string): DbResult<T> {
    if (Cache.cache[hash]) {
      return Cache.cache[hash].result as DbResult<T>;
    } else {
      throw new Error("There is no cache with hash: " + hash);
    }
  }

  static setCache<T>(
    hash: string,
    value: DbResult<T>,
    options: SetCacheOptions = {}
  ) {
    if (!Cache.cache[hash]) {
      throw new Error("There is no cache with the hash value " + hash);
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

  static subscribe<T>(
    hash: string,
    callOnChange: (cache: DbResult<T>) => void,
    supabaseBuild: SupabaseBuild,
    options: {
      unique: string;
      interval: number;
      backgroundFetch: boolean;
      retry: number;
    }
  ) {
    if (Cache.cache[hash]) {
      Cache.cache[hash].subscribers[options.unique] = callOnChange as (
        cache: DbResult<unknown>
      ) => void;
    } else {
      const { interval, unique, backgroundFetch, retry } = options;
      Cache.cache[hash] = {
        result: {
          data: undefined,
          error: undefined,
          state: "STALE",
        },
        subscribers: {
          [unique]: callOnChange as (cache: DbResult<unknown>) => void,
        },
      } as CacheHash;

      const timeToken = fetchDataWithInterval(hash, supabaseBuild, {
        interval,
        backgroundFetch,
        retry,
      });

      Cache.cache[hash].stopFetching = () => {
        clearInterval(timeToken);
      };
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

      delete Cache.cache[hash]?.subscribers[options.unique];
    };
  }

  static reset() {
    Object.values(Cache.cache).forEach((cache) => {
      cache.stopFetching();
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
