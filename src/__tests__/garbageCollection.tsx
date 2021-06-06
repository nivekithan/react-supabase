/**
 * @jest-environment jsdom
 */

import { db } from "@src/react-supabase/db";
import { useDb } from "@src/react-supabase/useDb";
import { renderHook } from "@testing-library/react-hooks";
import React from "react";
import { Wrapper, ServerData, errorClient, successClient } from "./utils";

describe("Feature: Garbage collection", () => {
  test("Success: The refetching request based on cache time should stopped if there are no subscribers for stopRefetchTimeout", async () => {
    const dbAtom = db<unknown, undefined>((supabase) => {
      return supabase.from("users").select("name");
    });

    const { result, waitFor, unmount, rerender } = renderHook(() => useDb(dbAtom, undefined), {
      // eslint-disable-next-line react/prop-types, react/display-name
      wrapper: ({ children }) => {
        return (
          <Wrapper
            client={successClient}
            options={{ cacheTime: 200, retry: 0, stopRefetchTimeout: 100 }}
          >
            {children}
          </Wrapper>
        );
      },
    });

    await waitFor(() => {
      return result.current.state === "SUCCESS";
    });
    const serverCalls = ServerData.times;

    unmount();

    rerender();

    unmount();

    await new Promise((r) => setTimeout(r, 200));

    expect(ServerData.times).toBe(serverCalls);
  });

  test("Error: The refetching request based on cache time should stopped if there are no subscribers for stopRefetchTimeout", async () => {
    const dbAtom = db<unknown, undefined>((supabase) => {
      return supabase.from("users").select("name");
    });

    const { result, waitFor, unmount, rerender } = renderHook(() => useDb(dbAtom, undefined), {
      // eslint-disable-next-line react/prop-types, react/display-name
      wrapper: ({ children }) => {
        return (
          <Wrapper
            client={errorClient}
            options={{ cacheTime: 200, retry: 0, stopRefetchTimeout: 100 }}
          >
            {children}
          </Wrapper>
        );
      },
    });

    await waitFor(() => {
      return result.current.state === "ERROR";
    });
    const serverCalls = ServerData.times;

    unmount();

    rerender();

    unmount();

    await new Promise((r) => setTimeout(r, 200));

    expect(ServerData.times).toBe(serverCalls);
  });

  test("Success: The cache should be cleared based on clearCacheTimeout if there are no subscribers", async () => {
    const dbAtom = db<unknown, undefined>((supabase) => {
      return supabase.from("users").select("name");
    });

    const { result, waitFor, unmount, rerender } = renderHook(() => useDb(dbAtom, undefined), {
      // eslint-disable-next-line react/prop-types, react/display-name
      wrapper: ({ children }) => {
        return (
          <Wrapper client={successClient} options={{ retry: 0, clearCacheTimeout: 200 }}>
            {children}
          </Wrapper>
        );
      },
    });

    await waitFor(() => {
      return result.current.state === "SUCCESS";
    });
    const serverCalls = ServerData.times;

    unmount();

    rerender();

    unmount();

    await new Promise((r) => setTimeout(r, 250));

    rerender();

    await waitFor(() => {
      return result.current.state === "SUCCESS";
    });

    expect(ServerData.times).toBe(serverCalls + 1);
  });

  test("Error: The cache should be cleared based on clearCacheTimeout if there are no subscribers", async () => {
    const dbAtom = db<unknown, undefined>((supabase) => {
      return supabase.from("users").select("name");
    });

    const { result, waitFor, unmount, rerender } = renderHook(() => useDb(dbAtom, undefined), {
      // eslint-disable-next-line react/prop-types, react/display-name
      wrapper: ({ children }) => {
        return (
          <Wrapper client={errorClient} options={{ retry: 0, clearCacheTimeout: 200 }}>
            {children}
          </Wrapper>
        );
      },
    });

    await waitFor(() => {
      return result.current.state === "ERROR";
    });
    const serverCalls = ServerData.times;

    unmount();

    rerender();

    unmount();

    await new Promise((r) => setTimeout(r, 250));

    rerender();

    await waitFor(() => {
      return result.current.state === "ERROR";
    });

    expect(ServerData.times).toBe(serverCalls + 1);
  });
});
