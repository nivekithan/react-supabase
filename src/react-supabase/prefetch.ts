import { Cache } from "./cache";
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

  if (!Cache.cache[hash]) {
    new Cache(supabase, getSupabaseBuild, hash, finalOptions, contextOptions);
  }

  Cache.cache[hash].fetch();
  Cache.cache[hash].refetch();
};
