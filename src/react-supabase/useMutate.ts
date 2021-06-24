import { SupabaseClient } from "@src/supabase-js";
import { useSupabase } from "./context";
import { createSimpleState } from "./dbCache";
import { getHash } from "./hash";
import { MutateContext } from "./mutate";
import { MutationCache } from "./mutationCache";

export type MutateResultSet<SetProps> = SetProps extends undefined
  ? (setProps?: SetProps) => void
  : (setProps: SetProps) => void;

export type MutateResult<SetProps> = MutateResultSet<SetProps>;
export function useMutate<Data, HookProps extends undefined, SetProps>(
  mutateContext: MutateContext<Data, HookProps, SetProps>,
  hookProps?: HookProps
): MutateResult<SetProps>;

export function useMutate<Data, HookProps, SetProps>(
  muateContext: MutateContext<Data, HookProps, SetProps>,
  hookProps: HookProps
): MutateResult<SetProps>;

export function useMutate<Data, HookProps, SetProps>(
  mutateContext: MutateContext<Data, HookProps, SetProps>,
  hookProps?: HookProps
): MutateResult<SetProps> {
  const supabase = useSupabase();

  const hash = getHash(mutateContext, hookProps as HookProps);

  if (!MutationCache.hasCache(hash)) {
    new MutationCache(
      createSetPropsFn(supabase, mutateContext, hookProps as HookProps, hash),
      hash
    );
  }

  return MutationCache.cache[hash].callApi as MutateResultSet<SetProps>;
}

const createSetPropsFn = <Data, HookProps, SetProps>(
  supabase: SupabaseClient,
  mutateContext: MutateContext<Data, HookProps, SetProps>,
  hookProps: HookProps,
  hash: string
) => {
  return (setProps: SetProps) => {
    const backgroundFetch = mutateContext.options.backgroundFetch;
    MutationCache.setCache(hash, createSimpleState(hash, "STALE"), { backgroundFetch });
    const supabaseBuild = mutateContext.createSupabaseBuild(supabase, hookProps, setProps);

    (async () => {
      MutationCache.setCache(hash, createSimpleState(hash, "LOADING"), { backgroundFetch });
      const response = await supabaseBuild;

      const status = response.status;
      const statusText = response.statusText;

      if (response.data) {
        MutationCache.setCache(
          hash,
          {
            data: response.data,
            error: undefined,
            state: "SUCCESS",
            status,
            statusText,
            hash,
          },
          { backgroundFetch }
        );
      } else {
        MutationCache.setCache(
          hash,
          {
            state: "ERROR",
            data: undefined,
            error: response.error,
            status,
            statusText,
            hash,
          },
          { backgroundFetch }
        );
      }
    })();
  };
};
