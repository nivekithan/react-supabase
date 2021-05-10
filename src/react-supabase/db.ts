import { PostgrestClient } from "../postgrest";
import { SupabaseBuild } from "../postgrest/lib/types";
import { dbOptions } from "./context";
import { Key } from "./key";

export type CreateUrl<props> = props extends undefined
  ? (supabase: PostgrestClient) => SupabaseBuild
  : (supabase: PostgrestClient, para: props) => SupabaseBuild;

export type DbContext<data, props> = {
  createUrl: CreateUrl<props>;
  id: Key;
  options: dbOptions<data>;
  type: "REQUEST";
};

export const db = <data, props>(
  createUrl: CreateUrl<props>,
  options: dbOptions<data> = {}
): DbContext<data, props> => {
  return {
    createUrl,
    id: Key.getUniqueKey(),
    options,
    type: "REQUEST",
  };
};
