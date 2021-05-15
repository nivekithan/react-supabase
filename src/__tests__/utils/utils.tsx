/* eslint-disable react/prop-types */
import {
  createClient,
  DbOptionsProviderProps,
  ClientProviderProps,
  SupabaseProvider,
} from "@src/react-supabase/context";
import { WrapperComponent } from "@nivekithan/react-hooks";
import React from "react";

export const KEY = "1234567890-test-key";
export const url = {
  success: "https://test_url/success",
  error: "https://test_url/error",
  errorToSuccess: "https://test_url/errortosuccess",
  dynamicSuccess: "https://test_url/dynamicsuccess",
};

export const Wrapper: WrapperComponent<ClientProviderProps & DbOptionsProviderProps> = ({
  children,
  client,
  options = {},
}) => {
  return (
    <SupabaseProvider client={client} dbOptions={options}>
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

export const dynamicSuccessClient = createClient({
  url: url.dynamicSuccess,
  key: KEY,
});
