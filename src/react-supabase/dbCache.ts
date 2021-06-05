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

type DbCacheHash<data> = {
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

export class DbCache<data> {
  static cache: {
    [hash: string]: DbCacheHash<unknown>;
  } = {};

  static getCache<T>(hash: string): DbResult<T> {
    if (DbCache.cache[hash]) {
      return DbCache.cache[hash].result as DbResult<T>;
    } else {
      throw new Error(
        `Cache.getCache: There is no cache with hash ${hash} use new Cache() to create new Cache`
      );
    }
  }

  static setCache<T>(hash: string, value: DbResult<T>, options: SetCacheOptions = {}) {
    if (!DbCache.cache[hash]) {
      throw new Error(
        `Cache.setCache: There is no cache with hash ${hash} use new Cache() to create new Cache`
      );
    } else {
      const { backgroundFetch = false, force = false } = options;

      DbCache.cache[hash].result = value;
      DbCache.cache[hash].__sync++;

      if (!backgroundFetch || ["SUCCESS", "ERROR"].includes(value.state)) {
        Object.values(DbCache.cache[hash].subscribers).forEach((doOnChange) => {
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
    if (DbCache.cache[hash]) {
      DbCache.cache[hash].stopClearCache();
      DbCache.cache[hash].stopStopRefetch();

      DbCache.cache[hash].subscribers[options.unique] = callOnChange as (
        cache: DbResult<unknown>,
        force: boolean
      ) => void;
      DbCache.cache[hash].refetch();
      afterSubscribed(DbCache.cache[hash].__sync, DbCache.getCache(hash));
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
      if (DbCache.cache[hash]) {
        delete DbCache.cache[hash].subscribers[options.unique];

        if (Object.values(DbCache.cache[hash].subscribers).length === 0) {
          DbCache.cache[hash].stopRefetchWithDelay(false, true);
          DbCache.cache[hash].clearCacheWithDelay();
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
    if (DbCache.cache[hash]) {
      throw new Error(
        `Cache.fromSupabaseBuild: There is already a cache with hash ${hash} use Cache.clearCache to remove the cache before creating a new one`
      );
    }
    DbCache.cache[hash] = createCacheHash(
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
    if (DbCache.cache[hash]) {
      throw new Error(
        `Cache.fromStatic: There is already a cache with hash ${hash} use Cache.clearCache to remove the cache before creating a new one`
      );
    }
    DbCache.cache[hash] = createCacheHash(
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
    if (DbCache.cache[hash]) {
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
          DbCache.cache[hash].supabaseBuild = couldBeSupabaseBuild;
          DbCache.cache[hash].__type = "SERVER";

          if (fetch) {
            !DbCache.cache[hash].fetchCanceled && DbCache.cache[hash].fetch();
            !DbCache.cache[hash].fetchCanceled && DbCache.cache[hash].refetch();
          }
        } else {
          const get = createGetter(supabase, hash, configOptions);
          const couldBeSupabaseBuild2 = couldBeSupabaseBuild(get, hash);

          if (couldBeSupabaseBuild2 instanceof PostgrestBuilder) {
            DbCache.cache[hash].supabaseBuild = couldBeSupabaseBuild2;
            DbCache.cache[hash].__type = "SERVER";

            if (fetch) {
              !DbCache.cache[hash].fetchCanceled && DbCache.cache[hash].fetch();
              !DbCache.cache[hash].fetchCanceled && DbCache.cache[hash].refetch();
            }
            return;
          } else {
            DbCache.cache[hash].supabaseBuild = undefined;
            DbCache.cache[hash].__type = "STATIC";
            DbCache.setCache(hash, couldBeSupabaseBuild2 as DbResult<unknown>);
            DbCache.cache[hash].stopRefetch();
            DbCache.cache[hash].stopStopRefetch();
            return;
          }
        }
      };

      if (typeof couldBeSupabaseBuild !== "function") {
        DbCache.fromSupabaseBuild(hash, couldBeSupabaseBuild, options, reCalculateSupabaseBuild);

        const subsObj = supabase.auth.onAuthStateChange((e, session) => {
          switch (typeof options.resetCacheOnAuthChange) {
            case "boolean":
              if (options.resetCacheOnAuthChange) {
                DbCache.setCache(hash, createSimpleState(hash, "STALE"), {
                  backgroundFetch: false,
                  force: true,
                });
                DbCache.cache[hash].reCalculateSupabaseBuild();
                return;
              } else {
                DbCache.cache[hash].reCalculateSupabaseBuild(false);
                return;
              }
            case "function":
              if (options.resetCacheOnAuthChange(e, session)) {
                DbCache.setCache(hash, createSimpleState(hash, "STALE"), {
                  backgroundFetch: false,
                  force: true,
                });
                DbCache.cache[hash].reCalculateSupabaseBuild();
                return;
              } else {
                DbCache.cache[hash].reCalculateSupabaseBuild(false);
                return;
              }
          }
        });
        DbCache.cache[hash].subsObj = subsObj;

        return;
      } else {
        // We will be creating a temporally cache state
        DbCache.fromStatic(
          hash,
          options,
          createSimpleState(hash, "STALE"),
          reCalculateSupabaseBuild
        );

        const subsObj = supabase.auth.onAuthStateChange((e, session) => {
          switch (typeof options.resetCacheOnAuthChange) {
            case "boolean":
              if (options.resetCacheOnAuthChange) {
                DbCache.setCache(hash, createSimpleState(hash, "STALE"), {
                  backgroundFetch: false,
                  force: true,
                });
                DbCache.cache[hash].reCalculateSupabaseBuild();
                return;
              } else {
                DbCache.cache[hash].reCalculateSupabaseBuild(false);
                return;
              }
            case "function":
              if (options.resetCacheOnAuthChange(e, session)) {
                DbCache.setCache(hash, createSimpleState(hash, "STALE"), {
                  backgroundFetch: false,
                  force: true,
                });
                DbCache.cache[hash].reCalculateSupabaseBuild();
                return;
              } else {
                DbCache.cache[hash].reCalculateSupabaseBuild(false);
                return;
              }
          }
        });
        DbCache.cache[hash].subsObj = subsObj;

        const get = createGetter(supabase, hash, configOptions);
        const couldBeSupabaseBuild2 = couldBeSupabaseBuild(get, hash);

        if (couldBeSupabaseBuild2 instanceof PostgrestBuilder) {
          DbCache.cache[hash].supabaseBuild = couldBeSupabaseBuild2;
          DbCache.cache[hash].__type = "SERVER";

          DbCache.cache[hash].fetch();
          DbCache.cache[hash].refetch();
          return;
        } else {
          DbCache.cache[hash].supabaseBuild = undefined;
          DbCache.cache[hash].__type = "STATIC";
          DbCache.setCache(hash, couldBeSupabaseBuild2 as DbResult<unknown>);
          DbCache.cache[hash].stopRefetch();
          DbCache.cache[hash].stopStopRefetch();
          return;
        }
      }
    }
  }

  static reset() {
    Object.values(DbCache.cache).forEach((cache) => {
      cache.clearCache();
    });

    DbCache.cache = {};
  }

  static getOptions<key extends keyof Required<dbOptions<unknown>>>(hash: string, key: key) {
    if (DbCache.cache[hash]) {
      return DbCache.cache[hash][key];
    } else {
      throw new Error(
        `Cache.getOptions: There is no cache with hash ${hash} use new Cache() to create new cache`
      );
    }
  }

  static setOptions(hash: string, options: dbOptions<unknown>) {
    if (DbCache.cache[hash]) {
      if (typeof options.cacheTime !== "undefined") {
        DbCache.cache[hash].stopRefetch();
      }

      DbCache.cache[hash] = {
        ...DbCache.cache[hash],
        ...options,
      };

      if (typeof options.cacheTime !== "undefined") {
        !DbCache.cache[hash].fetchCanceled && DbCache.cache[hash].refetch();
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
    return DbCache.getCache<unknown>(hash);
  };

  const timeToken = setInterval(() => {
    try {
      const backgroundFetch = DbCache.getOptions(hash, "backgroundFetch");
      DbCache.setCache(hash, createSimpleState(hash, "STALE"), {
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
    const retry = DbCache.getOptions(hash, "retry");

    const supabaseBuild = DbCache.cache[hash].supabaseBuild;

    if (!supabaseBuild) {
      throw new Error(
        `The cache with hash ${hash} cannot do api calls. Make sure that the Cache.cache[hash].supabaseBuild is not undefined`
      );
    }

    DbCache.setCache(hash, createSimpleState(hash, "LOADING"), {
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

    DbCache.setCache(hash, dbResult, {
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
): DbCacheHash<unknown> => {
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
      if (DbCache.cache[hash].fetchCanceled) {
        DbCache.cache[hash].fetchCanceled = false;
      }

      const supabaseBuild = DbCache.cache[hash].supabaseBuild;

      if (supabaseBuild) {
        if (typeof backgroundFetch === "undefined") {
          backgroundFetch = DbCache.getOptions(hash, "backgroundFetch");
        }
        fetchData(hash, { backgroundFetch });
      }
    },

    stopRefetch: (setCanceled?: boolean) => {
      /**
       * If there is not a timeToken then we wont clear it
       */

      if (setCanceled) {
        DbCache.cache[hash].fetchCanceled = true;
      }

      const timeToken = DbCache.cache[hash].refetchingTimeToken;

      if (timeToken) {
        clearInterval(timeToken);
        DbCache.cache[hash].refetchingTimeToken = undefined;
      }
    },

    refetch(force?: boolean, immediate?: boolean) {
      if (DbCache.cache[hash].fetchCanceled) {
        DbCache.cache[hash].fetchCanceled = false;
        immediate = true;
      }

      /**
       *
       * If there is already timeToken then refetching is already in progress
       * so there is no need to start a new one expect if force is true
       * then we have we will start the refetching
       *
       */

      if (DbCache.cache[hash].refetchingTimeToken) {
        if (!force) {
          return;
        }

        DbCache.cache[hash].stopRefetch();
      }

      const interval = DbCache.getOptions(hash, "cacheTime");

      if (immediate) {
        DbCache.cache[hash].fetch();
      }

      const supabaseBuild = DbCache.cache[hash].supabaseBuild;

      if (supabaseBuild) {
        const timeToken = fetchDataWithInterval(hash, { interval });

        DbCache.cache[hash].refetchingTimeToken = timeToken;
      }
    },

    stopRefetchWithDelay(force?: boolean, setCanceled?: boolean) {
      const stopRefetchingToken = DbCache.cache[hash].stopRefetchingToken;

      if (stopRefetchingToken) {
        // The startStopRefetching process is already in progress

        if (!force) {
          return;
        }

        DbCache.cache[hash].stopStopRefetch();
      }

      const timeToken = setTimeout(() => {
        DbCache.cache[hash]?.stopRefetch(setCanceled);
      }, DbCache.getOptions(hash, "stopRefetchTimeout"));

      DbCache.cache[hash].stopRefetchingToken = timeToken;
    },

    stopStopRefetch() {
      const stopRefetchingToken = DbCache.cache[hash].stopRefetchingToken;

      if (stopRefetchingToken) {
        clearTimeout(stopRefetchingToken);
        DbCache.cache[hash].stopRefetchingToken = undefined;
      } else {
        return;
      }
    },

    clearCache() {
      DbCache.cache[hash].stopRefetch();
      DbCache.cache[hash].stopStopRefetch();
      DbCache.cache[hash].subsObj?.data?.unsubscribe();

      const clearCacheToken = DbCache.cache[hash].clearCacheToken;

      if (clearCacheToken) {
        clearTimeout(clearCacheToken);
        DbCache.cache[hash].clearCacheToken = undefined;
      }

      Object.values(getterHash[hash] || {}).map((unSubs) => {
        unSubs();
      });
      delete getterHash[hash];

      delete DbCache.cache[hash];
    },

    clearCacheWithDelay(force?: boolean) {
      const clearCacheToken = DbCache.cache[hash].clearCacheToken;

      if (clearCacheToken) {
        // The process already started

        if (!force) {
          return;
        }

        DbCache.cache[hash].stopClearCache();
      }

      const clearCacheTimeout = DbCache.getOptions(hash, "clearCacheTimeout");
      const timeToken = setTimeout(() => {
        DbCache.cache[hash]?.clearCache();
      }, clearCacheTimeout);

      DbCache.cache[hash].clearCacheToken = timeToken;
    },

    stopClearCache() {
      const clearCacheToken = DbCache.cache[hash].clearCacheToken;

      if (!clearCacheToken) {
        // There is no process to stop
        return;
      }

      clearTimeout(clearCacheToken);
      DbCache.cache[hash].clearCacheToken = undefined;
    },

    ...authSubsObj,

    fetchCanceled: false,
  };
};
