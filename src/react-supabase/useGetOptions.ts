import { useMemo } from "react";
import { SupabaseOptions, useSupabaseOptions } from "./context";
import type { useDbOptions } from "./useDb";

const defaultConfig: Required<useDbOptions<unknown>> = {
  cacheTime: 3000 * 60,
  backgroundFetch: true,
  shouldComponentUpdate: () => true,
  retry: 3,
  stopRefetchTimeout: 3000 * 60,
  clearCacheTimeout: 3000 * 60 * 10,
};

export const useGetOptions = <data>(
  dbOptions: SupabaseOptions<data>,
  useDbOptions: SupabaseOptions<data>
) => {
  const supabaseOptions = useSupabaseOptions();

  const options = useMemo<Required<useDbOptions<data>>>(() => {
    const options = { ...defaultConfig };
    Object.assign(options, supabaseOptions, dbOptions, useDbOptions);
    return options;
  }, [dbOptions, supabaseOptions, useDbOptions]);

  return options;
};
