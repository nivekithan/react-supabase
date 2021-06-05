import { SupabaseClient } from "@src/supabase-js";
import { Key } from "./key";
import { SupabaseBuild } from "./types";

export type CreateSupabaseBuild<Data, HookProps, SetProps> = (
  supabase: SupabaseClient,
  hookProps: HookProps,
  setProps: SetProps
) => SupabaseBuild;

export type MutateContext<Data, HookProps, SetProps> = {
  type: "mutate";
  createSupabaseBuild: CreateSupabaseBuild<Data, HookProps, SetProps>;
  id: string;
  options: MutateOptions;
};

export type MutateOptions = {
  backgroundFetch?: boolean;
};

export const mutate = <Data, HookProps, SetProps>(
  createSupabaseBuild: CreateSupabaseBuild<Data, HookProps, SetProps>,
  options: MutateOptions = {}
): MutateContext<Data, HookProps, SetProps> => {
  return {
    type: "mutate",
    createSupabaseBuild,
    id: Key.getUniqueKey(),
    options,
  };
};
