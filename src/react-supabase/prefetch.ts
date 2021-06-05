import { DbCache } from "./dbCache";
import { useDbOptions, useSupabase } from "./context";
import { DbContext } from "./db";
import { getHash } from "./hash";
import { useGetDbOptions } from "./useGetOptions";

export type usePreFetchHook = {
  <data, props extends undefined>(db: DbContext<data, undefined>, args?: undefined): void;
  <data, props>(db: DbContext<data, props>, args: props): void;
};

export const usePreFetch: usePreFetchHook = <data, props>(
  db: DbContext<data, props>,
  args?: props
) => {
  const supabase = useSupabase();
  const hash = getHash(db, args);
  const finalOptions = useGetDbOptions(hash, db.options);
  const contextOptions = useDbOptions();

  const getSupabaseBuild = () => {
    return db.createUrl(supabase, args as props);
  };

  if (!DbCache.cache[hash]) {
    new DbCache(supabase, getSupabaseBuild, hash, finalOptions, contextOptions);
  }

  DbCache.cache[hash].fetch();
  DbCache.cache[hash].refetch();
};
