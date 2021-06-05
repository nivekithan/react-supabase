import { createSimpleState } from "./dbCache";
import { DbResult } from "./useDb";

type SetCacheOptions = {
  backgroundFetch?: boolean;
};

type MutateCacheHash<Data, SetProps> = {
  result: DbResult<Data>;
  hash: string;
  subscribers: {
    [key: string]: (cache: DbResult<Data>, force: boolean) => void;
  };
  callApi: (setProps: SetProps) => void;
};

export class MutationCache<Data, SetProps> {
  static cache: {
    [hash: string]: MutateCacheHash<unknown, unknown>;
  } = {};

  static getCache(hash: string) {
    if (MutationCache.cache[hash]) {
      return MutationCache.cache[hash].result;
    } else {
      throw new Error(`There is no mutation cache with hash ${hash}`);
    }
  }

  static hasCache(hash: string) {
    return typeof MutationCache.cache[hash] !== "undefined";
  }

  static setCache<Data>(hash: string, value: DbResult<Data>, options: SetCacheOptions = {}) {
    if (MutationCache.cache[hash]) {
      const { backgroundFetch = false } = options;
      MutationCache.cache[hash].result = value;
      MutationCache.callSubscribers(hash, value, { backgroundFetch });
    } else {
      throw new Error(`There is no mutation cache with hash ${hash}`);
    }
  }

  static callSubscribers<Data>(
    hash: string,
    value: DbResult<Data>,
    backgroundFetch: SetCacheOptions
  ) {
    if (MutationCache.cache[hash]) {
      if (!backgroundFetch || ["SUCCESS", "ERROR"].includes(value.state)) {
        Object.values(MutationCache.cache[hash].subscribers).map((doOnChange) => {
          doOnChange(value, false);
        });
      }
    } else {
      throw new Error(`There is no mutation cache with hash ${hash}`);
    }
  }

  constructor(callApi: (setProps: SetProps) => void, hash: string) {
    if (MutationCache.hasCache(hash)) {
      throw new Error(
        `There is already a mutation Cache with hash ${hash}. Remove it before creating new one`
      );
    }

    MutationCache.cache[hash] = {
      hash: hash,
      result: createSimpleState(hash, "STALE"),
      subscribers: {},
      callApi: callApi as (setProps: unknown) => void,
    };
  }
}
