/* eslint-disable react/prop-types */
import {
  SupabaseProvider,
  SupabaseProviderProps,
} from "@src/react-supabase/context";
import { WrapperComponent } from "@testing-library/react-hooks";
import React from "react";

export const KEY = "1234567890-test-key";
export const url = {
  success: "https://test_url/sucess",
  error: "https://test_url/error",
};

export const Wrapper: WrapperComponent<SupabaseProviderProps> = ({
  children,
  config,
  options,
}) => {
  return (
    <SupabaseProvider config={config} options={options}>
      {children}
    </SupabaseProvider>
  );
};
