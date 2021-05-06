import { useEffect, useMemo } from "react";
import { Cache } from "./cache";
import { SupabaseOptions, useSupabaseOptions } from "./context";

const defaultConfig: Required<SupabaseOptions<unknown>> = {
  cacheTime: 3000 * 60,
  backgroundFetch: true,
  shouldComponentUpdate: () => true,
  retry: 3,
  stopRefetchTimeout: 3000 * 60,
  clearCacheTimeout: 3000 * 60 * 10,
};

/**
 * useGetOptions can be used to get final config and options and also update the options
 * whenever it changes
 */

export const useGetOptions = <data>(
  hash: string,
  dbOptions: SupabaseOptions<data>,
  useDbOptions: SupabaseOptions<data>
) => {
  const supabaseOptions = useSupabaseOptions();

  const options = useMemo<Required<SupabaseOptions<data>>>(() => {
    const options = { ...defaultConfig };
    Object.assign(options, supabaseOptions, dbOptions, useDbOptions);
    return options;
  }, [dbOptions, supabaseOptions, useDbOptions]);

  useEffect(() => {
    Cache.setOptions(hash, options as SupabaseOptions<unknown>);
  }, [hash, options]);

  return options;
};
