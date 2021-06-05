/**
 * @jest-environment jsdom
 */

import { Renderer, renderHook, Result } from "@nivekithan/react-hooks";
import { db } from "@src/react-supabase/db";
import { usePreFetch } from "@src/react-supabase/prefetch";
import { DbResult, useDb } from "@src/react-supabase/useDb";
import React from "react";
import { successClient, Wrapper } from "./utils";

describe("Testing usePreFetch", () => {
  test("PreFetching db", async () => {
    const dbAtom = db<unknown, undefined>((supabase) => {
      return supabase.from("users").select("*");
    });

    renderHook(() => usePreFetch(dbAtom), {
      // eslint-disable-next-line react/prop-types, react/display-name
      wrapper: ({ children }) => {
        return <Wrapper client={successClient}>{children}</Wrapper>;
      },
    });

    await new Promise((s) => setTimeout(s, 500));

    const { result } = renderHook(() => useDb(dbAtom), {
      // eslint-disable-next-line react/prop-types, react/display-name
      wrapper: ({ children }) => {
        return <Wrapper client={successClient}>{children}</Wrapper>;
      },
    }) as Result<unknown, DbResult<unknown>, Renderer<unknown>>;

    expect(result.current.state).toBe("SUCCESS");
  });
});
