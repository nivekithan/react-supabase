import { PostgrestClient } from "../postgrest";
import { SupabaseBuild } from "../postgrest/lib/types";
import { useSupabase, useSupabaseOptions } from "./context";
import { Key } from "./key";
import { fetch } from "cross-fetch";
import { useEffect, useRef, useState } from "react";
import { stableStringify } from "./utlis";
import { Cache } from "./cache";

type DbContext<props> = {
  createUrl: (supabase: PostgrestClient, para: props) => SupabaseBuild;
  id: Key;
};

export const db = <props>(
  createUrl: (supabase: PostgrestClient, para: props) => SupabaseBuild
): DbContext<props> => {
  return {
    createUrl,
    id: new Key(),
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
  const cache = () => {
    return Cache.getCache<data>(hash);
  };

  const [resultData, setResultData] = useState<DbResult<data>>(cache);

  useEffect(() => {
    let isMounted = true;

    const clearIntervalToken = setInterval(() => {
      Cache.setCache(hash, {
        state: "STALE",
        data: undefined,
        error: undefined,
      });
      setResultData({
        state: "STALE",
        data: undefined,
        error: undefined,
      });
      fetchData(supabaseBuild, hash, setResultData, () => isMounted);
    }, cacheTime);

    return () => {
      isMounted = false;
      clearInterval(clearIntervalToken);
    };
  }, [supabaseBuild, hash, setResultData, cacheTime]);

  /**
   * SetInterval delays the execution functions by the specified time so
   * we have to create another useEffect with zero dependency to execute Function
   */

  useEffect(() => {
    let isMounted = true;

    fetchData(supabaseBuild, hash, setResultData, () => isMounted);

    return () => {
      isMounted = false;
    };
  }, []);

  return resultData;
};

const fetchData = <data>(
  supabaseBuild: SupabaseBuild,
  hash: string,
  setData: (data: DbResult<data>) => void,
  isMounted: () => boolean
) => {
  const cache = () => {
    return Cache.getCache<data>(hash);
  };

  if (cache().state === "STALE") {
    (async () => {
      Cache.setCache(hash, {
        state: "LOADING",
        data: undefined,
        error: undefined,
      });
      isMounted() && setData(cache());
      const result = await fetch(supabaseBuild.url.toString(), {
        headers: supabaseBuild.headers,
        method: supabaseBuild.method,
      });

      let dbResult: DbResult<data>;
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
      isMounted() && setData(cache());
    })();
  }
};
