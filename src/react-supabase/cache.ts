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

export class Cache {
  private static cache: {
    [hash: string]: CacheHash;
  } = {};

  static getCache<T>(hash: string): DbResult<T> {
    if (Cache.cache[hash]) {
      return Cache.cache[hash].result as DbResult<T>;
    } else {
      return {
        data: undefined,
        error: undefined,
        state: "STALE",
      };
    }
  }

  static setCache<T>(hash: string, value: DbResult<T>): DbResult<T> {
    if (!Cache.cache[hash]) {
      throw new Error("There is no cache with the hash value " + { hash });
    } else {
      Cache.cache[hash].result = value;
      Object.values(Cache.cache[hash].subscribers).forEach((doOnChange) => {
        doOnChange(value);
      });
      return Cache.cache[hash].result as DbResult<T>;
    }
  }

  static subscribe<T>(
    hash: string,
    callOnChange: (cache: DbResult<T>) => void,
    supabaseBuild: SupabaseBuild,
    options: {
      unique: string;
      interval: number;
    }
  ) {
    let timeToken: NodeJS.Timeout;
    if (Cache.cache[hash]) {
      callOnChange(Cache.getCache(hash));
      Cache.cache[hash].subscribers = {
        ...Cache.cache[hash].subscribers,
        [options.unique]: callOnChange as (cache: DbResult<unknown>) => void,
      };
    } else {
      Cache.cache[hash] = {
        subscribers: {
          [options.unique]: callOnChange as (cache: DbResult<unknown>) => void,
        },
      } as CacheHash;

      Cache.setCache(hash, {
        data: undefined,
        error: undefined,
        state: "STALE",
      });

      timeToken = fetchDataWithInterval(hash, supabaseBuild, options.interval);

      Cache.cache[hash].stopFetching = () => {
        clearInterval(timeToken);
      };
    }
    return () => {
      delete Cache.cache[hash].subscribers[options.unique];
    };
  }
}

const fetchDataWithInterval = (
  hash: string,
  supabaseBuild: SupabaseBuild,
  interval: number
) => {
  const cache = () => {
    return Cache.getCache<unknown>(hash);
  };

  const timeToken = setInterval(() => {
    Cache.setCache(hash, {
      data: undefined,
      error: undefined,
      state: "STALE",
    });
    if (cache().state === "STALE") {
      fetchData(hash, supabaseBuild);
    }
  }, interval);

  return timeToken;
};

export const fetchData = async (hash: string, supabaseBuild: SupabaseBuild) => {
  Cache.setCache(hash, {
    state: "LOADING",
    data: undefined,
    error: undefined,
  });
  const result = await fetch(supabaseBuild.url.toString(), {
    headers: supabaseBuild.headers,
    method: supabaseBuild.method,
  });

  let dbResult: DbResult<unknown>;
  if (result.ok) {
    dbResult = {
      state: "SUCCESS",
      data: JSON.parse(await result.text()),
      error: undefined,
    };
  } else {
    dbResult = {
      state: "ERROR",
      data: undefined,
      error: await result.json(),
    };
  }
  Cache.setCache(hash, dbResult);
};
