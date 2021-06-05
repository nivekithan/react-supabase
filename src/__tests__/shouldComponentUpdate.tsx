/**
 * @jest-environment jsdom
 */

import { db } from "@src/react-supabase/db";
import { DbResult, useDb } from "@src/react-supabase/useDb";
import { Renderer, renderHook, Result } from "@nivekithan/react-hooks";
import React from "react";
import { Wrapper, errorClient, successClient } from "./utils";

describe("Feature: ShouldComponentUpdate", () => {
  test("Success: testing ShouldComponentUpdate", async () => {
    const dbAtom = db<unknown, undefined>(
      (supabase) => {
        return supabase.from("users").select("name");
      },
      {
        shouldComponentUpdate: (curr, next) => {
          if (curr.state === "STALE" && next.state === "LOADING") {
            return false;
          } else {
            return true;
          }
        },
      }
    );

    const { result, waitFor } = renderHook(() => useDb(dbAtom, undefined), {
      // eslint-disable-next-line react/prop-types, react/display-name
      wrapper: ({ children }) => {
        return <Wrapper client={successClient}>{children}</Wrapper>;
      },
    }) as Result<unknown, DbResult<unknown>, Renderer<unknown>>;

    await waitFor(() => {
      return result.current.state === "SUCCESS";
    });

    expect(result.all.length).toBe(2);
  });
  test("Error: testing ShouldComponentUpdate", async () => {
    const dbAtom = db<unknown, undefined>(
      (supabase) => {
        return supabase.from("users").select("name");
      },
      {
        shouldComponentUpdate: (curr, next) => {
          if (curr.state === "STALE" && next.state === "LOADING") {
            return false;
          } else {
            return true;
          }
        },
      }
    );

    const { result, waitFor } = renderHook(() => useDb(dbAtom, undefined), {
      // eslint-disable-next-line react/prop-types, react/display-name
      wrapper: ({ children }) => {
        return <Wrapper client={errorClient}>{children}</Wrapper>;
      },
    }) as Result<unknown, DbResult<unknown>, Renderer<unknown>>;

    await waitFor(() => {
      return result.current.state === "ERROR";
    });

    expect(result.all.length).toBe(2);
  });
});
