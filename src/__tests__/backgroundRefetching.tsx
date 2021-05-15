/**
 * @jest-environment jsdom
 */

import { db } from "@src/react-supabase/db";
import { DbResult, useDb } from "@src/react-supabase/useDb";
import { Renderer, renderHook, Result } from "@nivekithan/react-hooks";
import React from "react";
import { Wrapper, errorClient, successClient } from "./utils";

describe("Feature: Background fetching", () => {
  test("Success: Refetching request should happen in background", async () => {
    const dbAtom = db<unknown, undefined>((supabase) => {
      return supabase.from("users").select("name").get();
    });

    const { result, waitFor, waitForNextUpdate } = renderHook(() => useDb(dbAtom, undefined), {
      // eslint-disable-next-line react/prop-types, react/display-name
      wrapper: ({ children }) => {
        return (
          <Wrapper client={successClient} options={{ cacheTime: 100, retry: 0 }}>
            {children}
          </Wrapper>
        );
      },
    }) as Result<unknown, DbResult<unknown>, Renderer<unknown>>;

    await waitFor(() => {
      return result.current.state === "SUCCESS";
    });

    const stateChanges = result.all.length;

    await waitForNextUpdate({ timeout: 250 });

    expect(result.current.state).toBe("SUCCESS");
    expect(result.all.length).toBe(stateChanges + 1);
  });

  test("Error: Refetching request should happen in background", async () => {
    const dbAtom = db<unknown, undefined>((supabase) => {
      return supabase.from("users").select("name").get();
    });

    const { result, waitFor, waitForNextUpdate } = renderHook(() => useDb(dbAtom, undefined), {
      // eslint-disable-next-line react/prop-types, react/display-name
      wrapper: ({ children }) => {
        return (
          <Wrapper client={errorClient} options={{ cacheTime: 100, retry: 0 }}>
            {children}
          </Wrapper>
        );
      },
    }) as Result<unknown, DbResult<unknown>, Renderer<unknown>>;

    await waitFor(() => {
      return result.current.state === "ERROR";
    });

    const stateChanges = result.all.length;

    await waitForNextUpdate({ timeout: 200 });

    expect(result.current.state).toBe("ERROR");
    expect(result.all.length).toBe(stateChanges + 1);
  });

  test("Success: If background refetching is disabled then state change should be reflected", async () => {
    const dbAtom = db<unknown, undefined>((supabase) => {
      return supabase.from("users").select("name").get();
    });

    const { result, waitFor, waitForNextUpdate } = renderHook(() => useDb(dbAtom, undefined), {
      // eslint-disable-next-line react/prop-types, react/display-name
      wrapper: ({ children }) => {
        return (
          <Wrapper
            client={successClient}
            options={{ cacheTime: 100, backgroundFetch: false, retry: 0 }}
          >
            {children}
          </Wrapper>
        );
      },
    }) as Result<unknown, DbResult<unknown>, Renderer<unknown>>;

    await waitFor(() => {
      return result.current.state === "SUCCESS";
    });

    const stateChanges = result.all.length;

    await waitForNextUpdate();

    await waitFor(() => {
      return result.current.state === "SUCCESS";
    });

    expect(result.all.length).toBe(stateChanges + 3);
  });

  test("Error: If background refetching is disabled then state change should be reflected", async () => {
    const dbAtom = db<unknown, undefined>((supabase) => {
      return supabase.from("users").select("name").get();
    });

    const { result, waitFor, waitForNextUpdate } = renderHook(() => useDb(dbAtom, undefined), {
      // eslint-disable-next-line react/prop-types, react/display-name
      wrapper: ({ children }) => {
        return (
          <Wrapper
            client={errorClient}
            options={{ cacheTime: 100, backgroundFetch: false, retry: 0 }}
          >
            {children}
          </Wrapper>
        );
      },
    }) as Result<unknown, DbResult<unknown>, Renderer<unknown>>;

    await waitFor(() => {
      return result.current.state === "ERROR";
    });

    const stateChanges = result.all.length;

    await waitForNextUpdate();

    await waitFor(() => {
      return result.current.state === "ERROR";
    });

    expect(result.all.length).toBe(stateChanges + 3);
  });
});
