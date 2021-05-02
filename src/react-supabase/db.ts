import { PostgrestClient } from "../postgrest";
import { SupabaseBuild } from "../postgrest/lib/types";
import { SupabaseOptions } from "./context";
import { Key } from "./key";

export type CreateUrl<props> = props extends undefined
  ? (supabase: PostgrestClient) => SupabaseBuild
  : (supabase: PostgrestClient, para: props) => SupabaseBuild;

export type DbContext<data, props> = {
  createUrl: CreateUrl<props>;
  id: Key;
  options: SupabaseOptions<data>;
};

export const db = <data, props>(
  createUrl: CreateUrl<props>,
  options: SupabaseOptions<data> = {}
): DbContext<data, props> => {
  return {
    createUrl,
    id: Key.getUniqueKey(),
    options,
  };
};
