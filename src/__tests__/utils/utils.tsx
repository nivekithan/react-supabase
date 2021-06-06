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

export let successClient = createClient({
  url: url.success,
  key: KEY,
});

export let errorClient = createClient({
  url: url.error,
  key: KEY,
});

export let errorToSuccessClient = createClient({
  url: url.errorToSuccess,
  key: KEY,
});

export let dynamicSuccessClient = createClient({
  url: url.dynamicSuccess,
  key: KEY,
});

export const resetClients = () => {
  successClient = createClient({
    url: url.success,
    key: KEY,
  });

  errorClient = createClient({
    url: url.error,
    key: KEY,
  });

  errorToSuccessClient = createClient({
    url: url.errorToSuccess,
    key: KEY,
  });

  dynamicSuccessClient = createClient({
    url: url.dynamicSuccess,
    key: KEY,
  });
};
