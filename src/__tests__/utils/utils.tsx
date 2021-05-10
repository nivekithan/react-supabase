/* eslint-disable react/prop-types */
import {
  createClient,
  DbOptionsProviderProps,
  ClientProvider,
  ClientProviderProps,
  DbOptionsProvider,
} from "@src/react-supabase/context";
import { WrapperComponent } from "@nivekithan/react-hooks";
import React from "react";

export const KEY = "1234567890-test-key";
export const url = {
  success: "https://test_url/sucess",
  error: "https://test_url/error",
  errorToSuccess: "https://test_url/errortosuccess",
};

export const Wrapper: WrapperComponent<
  ClientProviderProps & DbOptionsProviderProps
> = ({ children, client, options = {} }) => {
  return (
    <ClientProvider client={client}>
      <DbOptionsProvider options={options}>{children}</DbOptionsProvider>
    </ClientProvider>
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
