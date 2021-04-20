import { PostgrestClient } from "../postgrest";
import { SupabaseBuild } from "../postgrest/lib/types";
import { useSupabase } from "./context";
import { Key } from "./key";
import { fetch } from "cross-fetch";
import { useEffect, useRef, useState } from "react";
import { stableStringify } from "./utlis";

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

type useDbResult<Data> = {
  state: "LOADING" | "ERROR" | "SUCCESS";
  data: Data | undefined;
  error: Error | undefined;
};

export const useDb = <data, props>(db: DbContext<props>, args?: props) => {
  const supabase = useSupabase();
  const { current: subaseBuild } = useRef(db.createUrl(supabase, args));
  const hash = `${db.id}${stableStringify(args)}`;

  const isAvailableInHash = typeof queryCache[hash] !== "undefined";

  const [resultData, setResultData] = useState<useDbResult<data>>(
    isAvailableInHash
      ? (queryCache[hash] as useDbResult<data>)
      : {
          state: "LOADING",
          data: undefined,
          error: undefined,
        }
  );

  useEffect(() => {
    if (!isAvailableInHash) {
      (async () => {
        const result = await fetch(subaseBuild.url.toString(), {
          headers: subaseBuild.headers,
          method: subaseBuild.method,
        });

        let dbResult: useDbResult<data>;
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
        queryCache[hash] = dbResult;
        setResultData(dbResult);
      })();
    }
  }, [subaseBuild]);

  return resultData;
};

type QueryCache = {
  [hash: string]: useDbResult<unknown>;
};

const queryCache: QueryCache = {};
