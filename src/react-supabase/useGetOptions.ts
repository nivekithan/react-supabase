import { useEffect, useMemo } from "react";
import { Cache } from "./cache";
import { dbOptions, useDbOptions } from "./context";

export const defaultDbOptions: Required<dbOptions<unknown>> = {
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

export const useGetDbOptions = <data>(hash: string, dbOptions: dbOptions<data>) => {
  const supabaseOptions = useDbOptions();

  const options = useMemo<Required<dbOptions<data>>>(() => {
    const options = { ...defaultDbOptions };
    Object.assign(options, supabaseOptions, dbOptions);
    return options;
  }, [dbOptions, supabaseOptions]);

  useEffect(() => {
    Cache.setOptions(hash, options as dbOptions<unknown>);
  }, [hash, options]);

  return options;
};
