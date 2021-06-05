/**
 * @jest-environment jsdom
 */

import { Renderer, renderHook, Result } from "@nivekithan/react-hooks";
import { ClientProvider } from "@src/react-supabase/context";
import { db } from "@src/react-supabase/db";
import { DbResult, useDb } from "@src/react-supabase/useDb";
import React from "react";
import { successClient } from "./utils";

describe("Using hooks outside the SupabaseProvider tree or its equivalent tree should throw error", () => {
  test("Checking useSupabase", async () => {
    const dbAtom = db<unknown, undefined>((supabase) => {
      return supabase.from("users");
    });
    const { result } = renderHook(() => {
      return useDb(dbAtom);
    }) as Result<unknown, DbResult<unknown>, Renderer<unknown>>;

    expect(result.error).toEqual(new Error("use useSupabase inside the ClientProvider tree"));
  });

  test("Checking useDbOption", () => {
    const dbAtom = db<unknown, undefined>((supabase) => {
      return supabase.from("users");
    });

    const { result } = renderHook(
      () => {
        return useDb(dbAtom);
      },
      {
        // eslint-disable-next-line react/display-name, react/prop-types
        wrapper: ({ children }) => {
          return <ClientProvider client={successClient}>{children}</ClientProvider>;
        },
      }
    ) as Result<unknown, DbResult<unknown>, Renderer<unknown>>;

    expect(result.error).toEqual(Error("use useDbOptions inside the DbOptionsProvider tree"));
  });
});
