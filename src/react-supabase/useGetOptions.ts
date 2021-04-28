import { useMemo } from "react";
import { useSupabaseOptions } from "./context";
import type { dbOptions, DbResult, useDbOptions } from "./db";

type config<data> = {
  cacheTime: number;
  backgroundFetch: boolean;
  shouldComponentUpdate: (
    curr: DbResult<data>,
    next: DbResult<data>
  ) => boolean;
  retry: number;
};

const defaultConfig = {
  cacheTime: 3000 * 60,
  backgroundFetch: true,
  shouldComponentUpdate: () => true,
  retry: 3,
};

export const useGetOptions = <data>(
  dbOptions: dbOptions<data>,
  useDbOptions: useDbOptions<data>
) => {
  const supabaseOptions = useSupabaseOptions();

  const options = useMemo<config<data>>(() => {
    const options = { ...defaultConfig };
    Object.assign(options, supabaseOptions, dbOptions, useDbOptions);
    return options;
  }, [dbOptions, supabaseOptions, useDbOptions]);

  return options;
};
