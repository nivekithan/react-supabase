/* eslint-disable react/prop-types */
import {
  createClient,
  SupabaseProvider,
  SupabaseProviderProps,
} from "@src/react-supabase/context";
import { WrapperComponent } from "@testing-library/react-hooks";
import React from "react";

export const KEY = "1234567890-test-key";
export const url = {
  success: "https://test_url/sucess",
  error: "https://test_url/error",
  errorToSuccess: "https://test_url/errortosuccess",
};

export const Wrapper: WrapperComponent<SupabaseProviderProps> = ({
  children,
  client,
  options,
}) => {
  return (
    <SupabaseProvider client={client} options={options}>
      {children}
    </SupabaseProvider>
  );
};

export const successClient = createClient({
  url: url.success,
  key: KEY,
});

export const errorClient = createClient({
  url: url.error,
  key: KEY,
});

export const errorToSuccessClient = createClient({
  url: url.errorToSuccess,
  key: KEY,
});
