import { SupabaseClient } from "@src/supabase-js/SupabaseClient";
import { SupabaseBuild } from "./types";
import { dbOptions } from "./context";
import { Getter } from "./getter";
import { Key } from "./key";
import { DbResult } from "./useDb";

export type NonDepCreateUrl<props> = props extends undefined
  ? (supabase: SupabaseClient) => SupabaseBuild
  : (supabase: SupabaseClient, para: props) => SupabaseBuild;

export type DepCreateUrl<data, props> = props extends undefined
  ? (supabase: SupabaseClient) => (get: Getter, hash: string) => SupabaseBuild | DbResult<data>
  : (
      supabase: SupabaseClient,
      props: props
    ) => (get: Getter, hash: string) => SupabaseBuild | DbResult<data>;

export type CreateUrl<data, props> = NonDepCreateUrl<props> | DepCreateUrl<data, props>;

export type DbContext<data, props> = {
  createUrl: CreateUrl<data, props>;
  id: Key;
  options: dbOptions<data>;
};

export const db = <data, props>(
  createUrl: CreateUrl<data, props>,
  options: dbOptions<data> = {}
): DbContext<data, props> => {
  return {
    createUrl,
    id: Key.getUniqueKey(),
    options,
  };
};
