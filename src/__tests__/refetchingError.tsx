/**
 * @jest-environment jsdom
 */

import { db } from "@src/react-supabase/db";
import { DbResult, useDb } from "@src/react-supabase/useDb";
import { Renderer, renderHook, Result } from "@nivekithan/react-hooks";
import React from "react";
import { Wrapper, ServerData, setSuccessOnTime, errorToSuccessClient } from "./utils";

describe("Feature: Refetching error request", () => {
  test("ErrorToSuccess : The first response is success ", async () => {
    setSuccessOnTime(1);

    const dbAtom = db<unknown, undefined>((supabase) => {
      return supabase.from("users").select("name");
    });

    const { result, waitFor } = renderHook(() => useDb(dbAtom, undefined), {
      // eslint-disable-next-line react/prop-types, react/display-name
      wrapper: ({ children }) => {
        return <Wrapper client={errorToSuccessClient}>{children}</Wrapper>;
      },
    }) as Result<unknown, DbResult<unknown>, Renderer<unknown>>;

    await waitFor(() => {
      return result.current.state === "SUCCESS";
    });

    expect(ServerData.times).toBe(1);
  });

  test("ErrorToSuccess: Success on last try", async () => {
    setSuccessOnTime(4);

    const dbAtom = db<unknown, undefined>((supabase) => {
      return supabase.from("users").select("name");
    });

    const { result, waitFor } = renderHook(() => useDb(dbAtom, undefined), {
      // eslint-disable-next-line react/prop-types, react/display-name
      wrapper: ({ children }) => {
        return <Wrapper client={errorToSuccessClient}>{children}</Wrapper>;
      },
    }) as Result<unknown, DbResult<unknown>, Renderer<unknown>>;

    await waitFor(() => {
      return result.current.state === "SUCCESS";
    });

    expect(ServerData.times).toBe(4);
  });

  test("ErrorToSuccess: Success on in between try", async () => {
    setSuccessOnTime(3);

    const dbAtom = db<unknown, undefined>((supabase) => {
      return supabase.from("users").select("name");
    });

    const { result, waitFor } = renderHook(() => useDb(dbAtom, undefined), {
      // eslint-disable-next-line react/prop-types, react/display-name
      wrapper: ({ children }) => {
        return <Wrapper client={errorToSuccessClient}>{children}</Wrapper>;
      },
    }) as Result<unknown, DbResult<unknown>, Renderer<unknown>>;

    await waitFor(() => {
      return result.current.state === "SUCCESS";
    });

    expect(ServerData.times).toBe(3);
  });

  test("ErrorToSuccess: Never a success response", async () => {
    const dbAtom = db<unknown, undefined>((supabase) => {
      return supabase.from("users").select("name");
    });

    const { result, waitFor } = renderHook(() => useDb(dbAtom, undefined), {
      // eslint-disable-next-line react/prop-types, react/display-name
      wrapper: ({ children }) => {
        return <Wrapper client={errorToSuccessClient}>{children}</Wrapper>;
      },
    }) as Result<unknown, DbResult<unknown>, Renderer<unknown>>;

    await waitFor(() => {
      return result.current.state === "ERROR";
    });

    expect(ServerData.times).toBe(4);
  });
});
