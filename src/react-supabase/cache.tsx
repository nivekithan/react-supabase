import { DbResult } from "./db";

export class Cache {
  static cache: {
    [index: string]: DbResult<unknown>;
  } = {};

  static getCache<T>(hash: string): DbResult<T> {
    if (Cache.cache[hash]) {
      return Cache.cache[hash] as DbResult<T>;
    } else {
      Cache.cache[hash] = {
        state: "STALE",
        data: undefined,
        error: undefined,
      };
      return Cache.cache[hash] as DbResult<T>;
    }
  }

  static setCache<T>(hash: string, value: DbResult<T>): DbResult<T> {
    if (!Cache.cache[hash]) {
      throw new Error("There is no cache with the hash value " + { hash });
    } else {
      Cache.cache[hash] = value;
      return Cache.cache[hash] as DbResult<T>;
    }
  }
}
