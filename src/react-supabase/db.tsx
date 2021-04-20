import { PostgrestClient } from "../postgrest";
import { SupabaseBuild } from "../postgrest/lib/types";
import { useSupabase } from "./context";
import { Key } from "./key";
import { fetch } from "cross-fetch";
import { useEffect, useRef, useState } from "react";
import { stableStringify } from "./utlis";
import { Cache } from "./cache";

type DbContext<props> = {
  createUrl: (supabase: PostgrestClient, para?: props) => SupabaseBuild;
  id: Key;
};

export function db<props>(
  createUrl: (supabase: PostgrestClient, para?: props) => SupabaseBuild
): DbContext<props> {
  return {
    createUrl,
    id: new Key(),
  };
}

export type DbResult<Data> = {
  state: "LOADING" | "ERROR" | "SUCCESS" | "STALE";
  data: Data | undefined;
  error: Error | undefined;
};

export const useDb = <data, props>(db: DbContext<props>, args?: props) => {
  const supabase = useSupabase();
  const { current: subaseBuild } = useRef(db.createUrl(supabase, args));
  const hash = `${db.id}${stableStringify(args)}`;
  const cache = () => {
    return Cache.getCache<data>(hash);
  };

  const [resultData, setResultData] = useState<DbResult<data>>(cache);

  useEffect(() => {
    let isMounted = true;
    if (cache().state === "STALE") {
      console.log("Sending request");

      (async () => {
        Cache.setCache(hash, {
          state: "LOADING",
          data: undefined,
          error: undefined,
        });
        isMounted && setResultData(cache());
        const result = await fetch(subaseBuild.url.toString(), {
          headers: subaseBuild.headers,
          method: subaseBuild.method,
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
        isMounted && setResultData(cache());
      })();

      return () => {
        isMounted = false;
      };
    }
  }, [subaseBuild]);

  return resultData;
};

type QueryCache = {
  [hash: string]: DbResult<unknown>;
};
