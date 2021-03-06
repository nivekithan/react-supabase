/**
 * @jest-environment jsdom
 */

import { db } from "@src/react-supabase/db";
import { DbResult, useDb } from "@src/react-supabase/useDb";
import { Renderer, renderHook, Result } from "@nivekithan/react-hooks";
import React from "react";
import { Wrapper, ServerData, errorClient, successClient } from "./utils";

describe("Feature: Refetch based on Cache time", () => {
  test("Success: Should refetch the requests based on cache time ", async () => {
    const dbAtom = db<unknown, undefined>((supabase) => {
      return supabase.from("users").select("name");
    });

    const { result, waitFor, waitForNextUpdate } = renderHook(
      () => {
        return useDb(dbAtom, undefined);
      },
      {
        // eslint-disable-next-line react/prop-types, react/display-name
        wrapper: ({ children }) => {
          return (
            <Wrapper client={successClient} options={{ cacheTime: 100, retry: 0 }}>
              {children}
            </Wrapper>
          );
        },
      }
    ) as Result<unknown, DbResult<unknown>, Renderer<unknown>>;

    await waitFor(() => {
      return result.current.state === "SUCCESS";
    });

    await waitForNextUpdate({
      timeout: 150,
    });

    expect(ServerData.times).toBe(2);
  });

  test("Error: Should refetch the requests based on cache time", async () => {
    const dbAtom = db<unknown, undefined>((supabase) => {
      return supabase.from("users").select("name");
    });

    const { result, waitFor, waitForNextUpdate } = renderHook(
      () => {
        return useDb(dbAtom, undefined);
      },
      {
        // eslint-disable-next-line react/prop-types, react/display-name
        wrapper: ({ children }) => {
          return (
            <Wrapper client={errorClient} options={{ cacheTime: 100, retry: 0 }}>
              {children}
            </Wrapper>
          );
        },
      }
    ) as Result<unknown, DbResult<unknown>, Renderer<unknown>>;

    await waitFor(() => {
      return result.current.state === "ERROR";
    });

    await waitForNextUpdate({
      timeout: 150,
    });

    expect(ServerData.times).toBe(2);
  });
});
