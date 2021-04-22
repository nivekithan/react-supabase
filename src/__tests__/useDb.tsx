/**
 * @jest-environment jsdom
 */

import { db, useDb } from "@src/react-supabase/db";
import {
  SupabaseProvider,
  SupabaseProviderProps,
} from "@src/react-supabase/context";
import { renderHook, WrapperComponent } from "@testing-library/react-hooks";
import React from "react";

describe("Testing useDb custom hook", () => {
  test("testing useDb", () => {
    const dbAtom = db((supabase) => {
      return supabase.from("users").select("name").get();
    });

    const wrapper: WrapperComponent<SupabaseProviderProps> = ({
      children,
      config,
      options,
    }) => {
      return (
        <SupabaseProvider config={config} options={options}>
          {children}
        </SupabaseProvider>
      );
    };

    const { result } = renderHook(() => useDb(dbAtom, undefined), {
      wrapper: ({ children }) =>
        wrapper({
          children,
          config: { key: "SOME_KEY", url: "SOME_URL" },
          options: { cacheTime: 3000 },
        }),
    });

    expect(result.current.state).toBe("STALE");
  });
});
