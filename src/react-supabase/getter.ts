import { PostgrestClient } from "@src/postgrest";
import { Cache } from "./cache";
import { dbOptions } from "./context";
import { DbContext } from "./db";
import { getHash } from "./hash";
import { DbResult } from "./useDb";
import { defaultDbOptions } from "./useGetOptions";

export type GetterOptions<data> = {
  shouldReCalculate: (next: DbResult<data>) => boolean;
};

export type Getter = {
  <data>(
    db: DbContext<data, undefined>,
    args?: undefined,
    options?: GetterOptions<data>
  ): DbResult<data>;

  <data, props>(
    db: DbContext<data, props>,
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

export const getterHash: {
  [hash: string]: {
    [localHash: string]: () => void;
  };
} = {};

export const createGetter = (
  supabase: PostgrestClient,
  hash: string,
  contextOptions: dbOptions<unknown>
): Getter => {
  const get: Getter = <data, props>(
    db: DbContext<data, props>,
    args?: props,
    options: GetterOptions<data> = {
      shouldReCalculate: defaultShouldReCalculate,
    }
  ) => {
    const localHash = getHash<data, props>(db, args as props);

    if (!getterHash[hash]) {
      getterHash[hash] = {};
    }

    if (!Cache.cache[localHash]) {
      const getSupabaseBuild = () => db.createUrl(supabase, args as props);
      const finalOptions = {
        ...defaultDbOptions,
        ...contextOptions,
        ...db.options,
      };
      new Cache(supabase, getSupabaseBuild, localHash, finalOptions, contextOptions);
      Cache.cache[localHash].fetch();
      Cache.cache[localHash].refetch();
    }
    const unSubscribe = Cache.subscribe<data>(
      localHash,
      (cache) => {
        if (Cache.cache[hash] && options.shouldReCalculate(cache)) {
          Cache.cache[hash].reCalculateSupabaseBuild();
        }
      },
      () => {
        return;
      },
      { unique: hash }
    );
    getterHash[hash][localHash] = unSubscribe;
    return Cache.getCache(localHash);
  };

  return get;
};
