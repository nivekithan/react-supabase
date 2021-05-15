import { PostgrestClient } from "../postgrest";
import { SupabaseBuild } from "../postgrest/lib/types";
import { dbOptions } from "./context";
import { Getter } from "./getter";
import { Key } from "./key";
import { DbResult } from "./useDb";

export type NonDepCreateUrl<props> = props extends undefined
  ? (supabase: PostgrestClient) => SupabaseBuild
  : (supabase: PostgrestClient, para: props) => SupabaseBuild;

export type DepCreateUrl<data, props> = props extends undefined
  ? (supabase: PostgrestClient) => (get: Getter, hash: string) => SupabaseBuild | DbResult<data>
  : (
      supabase: PostgrestClient,
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
