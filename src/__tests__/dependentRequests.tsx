/**
 * @jest-environment jsdom
 */

import { Renderer, renderHook, Result } from "@nivekithan/react-hooks";
import { Cache } from "@src/react-supabase/cache";
import { db } from "@src/react-supabase/db";
import { DbResult, useDb } from "@src/react-supabase/useDb";
import React from "react";
import {
  Wrapper,
  setDynamicResult,
  dynamicSuccessClient,
  ServerData,
  errorToSuccessClient,
  setSuccessOnTime,
  successClient,
} from "./utils";

describe("Dependent Requests", () => {
  test("Success: Dependent cache has already been created", async () => {
    type serverResult = [{ id: string; name: string }];

    const dbAtom = db<serverResult, string>((supabase, name) => {
      return supabase.from("users").select("*").eq("userName", name).get();
    });

    const depAtom = db<serverResult, string>((supabase, name) => (get, hash) => {
      const result = get(dbAtom, name);

      if (result.state !== "SUCCESS") {
        return {
          ...result,
          hash,
        };
      } else {
        const { data } = result;

        const depName = data[0].name;

        return supabase.from("users").select("*").eq("userName", depName).get();
      }
    });
    const name = "Nivekithan S";
    const [result, resultDep] = renderHook(
      [() => useDb(dbAtom, name), () => useDb(depAtom, name)],
      {
        dontMount: true,
        // eslint-disable-next-line react/prop-types, react/display-name
        wrapper: ({ children }) => {
          return <Wrapper client={dynamicSuccessClient}>{children}</Wrapper>;
        },
      }
    ) as [
      Result<unknown, DbResult<serverResult>, Renderer<unknown>>,
      Result<unknown, DbResult<serverResult>, Renderer<unknown>>
    ];

    setDynamicResult([{ id: 1, name }]);
    result.render();

    await result.waitFor(() => {
      return result.result.current.state === "SUCCESS";
    });
    setDynamicResult([{ id: 2, name }]);
    resultDep.render();

    await resultDep.waitFor(() => {
      return resultDep.result.current.state === "SUCCESS";
    });

    const { result: depResult } = resultDep;

    expect(depResult.current.data).toEqual([{ id: 2, name }]);
  });

  test("Success: Dependent Cache has not been created", async () => {
    type serverResult = [{ id: string; name: string }];

    const dbAtom = db<serverResult, string>((supabase, name) => {
      return supabase.from("users").select("*").eq("userName", name).get();
    });

    const depAtom = db<serverResult, string>((supabase, name) => (get, hash) => {
      const result = get(dbAtom, name);

      if (result.state !== "SUCCESS") {
        return {
          ...result,
          hash,
        };
      } else {
        const { data } = result;

        const depName = data[0].name;

        return supabase.from("users").select("*").eq("userName", depName).get();
      }
    });
    const name = "Nivekithan S";
    const [resultNon, { render, result, waitFor }] = renderHook(
      [() => useDb(dbAtom, name), () => useDb(depAtom, name)],
      {
        dontMount: true,
        // eslint-disable-next-line react/prop-types, react/display-name
        wrapper: ({ children }) => {
          return <Wrapper client={dynamicSuccessClient}>{children}</Wrapper>;
        },
      }
    ) as [
      Result<unknown, DbResult<serverResult>, Renderer<unknown>>,
      Result<unknown, DbResult<serverResult>, Renderer<unknown>>
    ];

    setDynamicResult([{ id: 1, name }]);
    render();

    await waitFor(
      () => {
        return result.current.state === "SUCCESS";
      },
      { timeout: 3000 }
    );

    expect(result.current.data).toEqual([{ id: 1, name }]);

    resultNon.render();

    expect(resultNon.result.current.state).toBe("SUCCESS");
    expect(resultNon.result.current.data).toEqual([{ id: 1, name }]);

    expect(ServerData.times).toBe(2);
  });

  test("Dependent on Dependent Db", async () => {
    const dbAtom = db<unknown, undefined>((supabase) => {
      return supabase.from("users").select("*").get();
    });

    const depDbAtom = db<unknown, undefined>((supabase) => (get, hash) => {
      const result = get(dbAtom);

      if (result.state === "SUCCESS") {
        return supabase.from("users").select("*").get();
      }

      if (result.state === "LOADING") {
        return {
          ...result,
          hash,
          state: "STALE",
        };
      }
      return {
        ...result,
        hash,
      };
    });

    const depAtom2 = db<unknown, undefined>((supabase) => (get, hash) => {
      const result = get(depDbAtom);

      if (result.state === "SUCCESS") {
        return supabase.from("users").select("*").get();
      }
      if (result.state === "LOADING") {
        return {
          ...result,
          hash,
          state: "STALE",
        };
      }
      return {
        ...result,
        hash,
      };
    });

    setDynamicResult([{ id: 1, name: "Nivekithan S" }]);
    const { result, waitFor } = renderHook(() => useDb(depAtom2), {
      // eslint-disable-next-line react/prop-types, react/display-name
      wrapper: ({ children }) => {
        return <Wrapper client={dynamicSuccessClient}>{children}</Wrapper>;
      },
    }) as Result<unknown, DbResult<unknown>, Renderer<unknown>>;

    await waitFor(() => {
      return result.current.state === "SUCCESS";
    });

    expect(ServerData.times).toBe(3);
    expect(result.current.data).toEqual([{ id: 1, name: "Nivekithan S" }]);
  });

  test("On recalculating dependent atom it returns state", async () => {
    const dbAtom = db<unknown, undefined>(
      (supabase) => {
        return supabase.from("users").select("*").get();
      },
      { cacheTime: 200, retry: 0 }
    );

    const depDbAtom = db<unknown, undefined>(
      (supabase) => (get, hash) => {
        const result = get(dbAtom);
        // console.warn(result)
        if (result.state === "ERROR") {
          return supabase.from("users").select("*").get();
        }

        if (result.state === "LOADING") {
          return {
            ...result,
            hash,
            state: "STALE",
          };
        }

        return {
          ...result,
          hash,
        };
      },
      { retry: 0 }
    );

    setSuccessOnTime(3);
    const { result, waitFor } = renderHook(() => useDb(depDbAtom, undefined), {
      // eslint-disable-next-line react/prop-types, react/display-name
      wrapper: ({ children }) => {
        return <Wrapper client={errorToSuccessClient}>{children}</Wrapper>;
      },
    }) as Result<unknown, DbResult<unknown>, Renderer<unknown>>;

    await waitFor(
      () => {
        return result.current.state === "ERROR";
      },
      { timeout: 2000 }
    );

    await waitFor(() => {
      return result.current.state === "SUCCESS";
    });
  });

  test("Dependent State is in desired state", async () => {
    const dbAtom = db<unknown, undefined>((suapbase) => {
      return suapbase.from("users").select("*").get();
    });

    const depAtom = db<unknown, undefined>((supabase) => (get, hash) => {
      const result = get(dbAtom);

      if (result.state === "SUCCESS") {
        return supabase.from("users").select("*").get();
      }

      return {
        ...result,
        hash,
      };
    });

    const [result1, result2] = renderHook([() => useDb(dbAtom), () => useDb(depAtom)], {
      // eslint-disable-next-line react/prop-types, react/display-name
      wrapper: ({ children }) => {
        return <Wrapper client={successClient}>{children}</Wrapper>;
      },
      dontMount: true,
    }) as [
      Result<unknown, DbResult<unknown>, Renderer<unknown>>,
      Result<unknown, DbResult<unknown>, Renderer<unknown>>
    ];

    result1.render();
    await result1.waitFor(() => {
      return result1.result.current.state === "SUCCESS";
    });

    result2.render();
    await result2.waitFor(() => {
      return result2.result.current.state === "SUCCESS";
    });
  });
});
