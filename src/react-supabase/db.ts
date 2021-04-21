import { PostgrestClient } from "../postgrest";
import { SupabaseBuild } from "../postgrest/lib/types";
import { useSupabase, useSupabaseOptions } from "./context";
import { Key } from "./key";
import { useEffect, useRef, useState } from "react";
import { stableStringify } from "./utlis";
import { Cache, fetchData } from "./cache";

type DbContext<props> = {
  createUrl: (supabase: PostgrestClient, para: props) => SupabaseBuild;
  id: Key;
};

export const db = <props>(
  createUrl: (supabase: PostgrestClient, para: props) => SupabaseBuild
): DbContext<props> => {
  return {
    createUrl,
    id: Key.getUniqueKey(),
  };
};

export type DbResult<Data> = {
  state: "LOADING" | "ERROR" | "SUCCESS" | "STALE";
  data: Data | undefined;
  error: Error | undefined;
};

export const useDb = <data, props>(db: DbContext<props>, args: props) => {
  const supabase = useSupabase();
  const { cacheTime } = useSupabaseOptions();

  const { current: supabaseBuild } = useRef(db.createUrl(supabase, args));
  const hash = `${db.id}${stableStringify(args)}`;
  const { current: key } = useRef(Key.getUniqueKey());

  const cache = () => {
    return Cache.getCache<data>(hash);
  };

  const [resultData, setResultData] = useState<DbResult<data>>(cache);

  useEffect(() => {
    let isMounted = true;

    const unSubscribe = Cache.subscribe<data>(
      hash,
      (cache) => {
        isMounted && setResultData(cache);
      },
      supabaseBuild,
      {
        interval: cacheTime,
        unique: key,
      }
    );

    return () => {
      isMounted = false;
      unSubscribe();
    };
  }, [supabaseBuild, hash, setResultData, cacheTime, key]);

  /**
   * SetInterval delays the execution functions by the specified time so
   * we have to create another useEffect with zero dependency to execute Function
   */

  useEffect(() => {
    const cache = Cache.getCache(hash);

    if (cache.state === "STALE") {
      fetchData(hash, supabaseBuild);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return resultData;
};
