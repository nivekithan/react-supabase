/**
 * @jest-environment jsdom
 */

import { renderHook } from "@testing-library/react-hooks";
import { db } from "@src/react-supabase/db";
import { useDb } from "@src/react-supabase/useDb";
import React from "react";
import { errorClient, Wrapper } from "./utils";

describe("Testing Getter", () => {
  test("Testing shouldRecalculate options", async () => {
    const dbAtom = db<unknown, undefined>((supabase) => {
      return supabase.from("users").select("*");
    });

    const depDbAtom = db<unknown, undefined>((supabase) => (get, hash) => {
      const result = get(dbAtom, undefined, {
        shouldReCalculate: (next) => next.state === "SUCCESS",
      });

      if (result.state === "SUCCESS") {
        return supabase.from("users").select("*");
      } else {
        return {
          ...result,
          hash,
        };
      }
    });

    const { result } = renderHook(() => useDb(depDbAtom), {
      // eslint-disable-next-line react/prop-types, react/display-name
      wrapper: ({ children }) => {
        return <Wrapper client={errorClient}>{children}</Wrapper>;
      },
    });

    await new Promise((r) => setTimeout(r, 2000));

    expect(result.current.state).not.toBe("SUCCESS");
    expect(result.current.state).not.toBe("ERROR");
  });
});
