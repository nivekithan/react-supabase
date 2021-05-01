/**
 * @jest-environment jsdom
 */

import { db, useDb } from "@src/react-supabase/db";
import { renderHook } from "@testing-library/react-hooks";
import React from "react";
import { Wrapper, ServerData, errorClient, successClient } from "./utils";

describe("Supabase options", () => {
  test("Success: Behavior of default supabaseOptions", async () => {
    jest.useFakeTimers();

    const dbAtom = db<unknown, undefined>((supabase) => {
      return supabase.from("users").select("name").get();
    });

    const {
      result,
      waitFor,
      waitForNextUpdate,
      unmount,
      rerender,
    } = renderHook(() => useDb(dbAtom, undefined), {
      // eslint-disable-next-line react/prop-types, react/display-name
      wrapper: ({ children }) => {
        return <Wrapper client={successClient}>{children}</Wrapper>;
      },
    });
    await waitFor(() => {
      return result.current.state === "SUCCESS";
    });

    const stateChanges = result.all.length;

    jest.advanceTimersByTime(3000 * 60);

    await waitForNextUpdate({
      timeout: 250,
    });

    expect(result.all.length).toBe(stateChanges + 1);

    unmount();

    jest.advanceTimersByTime(3000 * 60);

    /**
     * Even though we advanced the time that does not mean that the api request also
     * gets resolved.  Api request happens real-time so we have to wait for some time
     */

    jest.useRealTimers();

    await new Promise((r) => setTimeout(r, 200));

    expect(ServerData.times).toBe(3);

    jest.useFakeTimers();
    jest.advanceTimersByTime(3000 * 60);

    jest.useRealTimers();
    await new Promise((r) => setTimeout(r, 200));
    expect(ServerData.times).toBe(3);

    jest.useFakeTimers();

    jest.advanceTimersByTime(3000 * 60 * 10);

    rerender();

    await waitFor(() => {
      return result.current.state === "SUCCESS";
    });

    expect(ServerData.times).toBe(4);
  });

  test("Error: Behavior of default supabaseOptions", async () => {
    jest.useFakeTimers();
    const dbAtom = db<unknown, undefined>((supabase) => {
      return supabase.from("users").select("name").get();
    });

    const {
      result,
      waitFor,
      waitForNextUpdate,
      unmount,
      rerender,
    } = renderHook(() => useDb(dbAtom, undefined), {
      // eslint-disable-next-line react/prop-types, react/display-name
      wrapper: ({ children }) => {
        return <Wrapper client={errorClient}>{children}</Wrapper>;
      },
    });

    await waitFor(() => {
      return result.current.state === "ERROR";
    });

    const stateChanges = result.all.length;
    const times = ServerData.times;

    jest.advanceTimersByTime(3000 * 60);

    await waitForNextUpdate({
      timeout: 3000 * 60 + 250,
    });

    expect(result.current.state).toBe("ERROR");
    expect(result.all.length).toBe(stateChanges + 1);
    expect(ServerData.times).toBe(times + 4);

    unmount();
    jest.advanceTimersByTime(3000 * 60);

    jest.useRealTimers();

    await new Promise((r) => setTimeout(r, 200));
    expect(ServerData.times).toBe(times + 4 + 4);

    jest.useFakeTimers();
    jest.advanceTimersByTime(3000 * 60);

    jest.useRealTimers();

    await new Promise((r) => setTimeout(r, 200));

    expect(ServerData.times).toBe(times + 4 + 4);

    jest.useFakeTimers();

    jest.advanceTimersByTime(3000 * 60 * 10);

    rerender();

    await waitFor(() => {
      return result.current.state === "ERROR";
    });

    expect(ServerData.times).toBe(times + 4 + 4 + 4);
  });

  test("Success: Options provided in Context should overwrite the default Config", async () => {
    const dbAtom = db<unknown, undefined>((supabase) => {
      return supabase.from("users").select("name").get();
    });

    const { result, waitFor, waitForNextUpdate } = renderHook(
      () => useDb(dbAtom, undefined),
      {
        // eslint-disable-next-line react/prop-types, react/display-name
        wrapper: ({ children }) => {
          return (
            <Wrapper
              client={successClient}
              options={{
                cacheTime: 100,
                retry: 0,
              }}
            >
              {children}
            </Wrapper>
          );
        },
      }
    );

    await waitFor(() => {
      return result.current.state === "SUCCESS";
    });

    const stateChanges = result.all.length;
    await waitForNextUpdate();

    expect(result.current.state).toBe("SUCCESS");
    expect(result.all.length).toBe(stateChanges + 1);
  });
  test("Error: Options provided in Context should overwrite the default Config", async () => {
    const dbAtom = db<unknown, undefined>((supabase) => {
      return supabase.from("users").select("name").get();
    });

    const { result, waitFor, waitForNextUpdate } = renderHook(
      () => useDb(dbAtom, undefined),
      {
        // eslint-disable-next-line react/prop-types, react/display-name
        wrapper: ({ children }) => {
          return (
            <Wrapper
              client={errorClient}
              options={{
                cacheTime: 100,
                retry: 0,
              }}
            >
              {children}
            </Wrapper>
          );
        },
      }
    );

    await waitFor(() => {
      return result.current.state === "ERROR";
    });

    const stateChanges = result.all.length;

    await waitForNextUpdate();

    expect(result.current.state).toBe("ERROR");
    expect(result.all.length).toBe(stateChanges + 1);
  });

  test("Success : Option provided in db should overwrite default and context options", async () => {
    const dbAtom = db<unknown, undefined>(
      (supabase) => {
        return supabase.from("users").select("name").get();
      },
      { cacheTime: 100 }
    );

    const { result, waitFor, waitForNextUpdate } = renderHook(
      () => useDb(dbAtom, undefined),
      {
        // eslint-disable-next-line react/prop-types, react/display-name
        wrapper: ({ children }) => {
          return (
            <Wrapper
              client={successClient}
              options={{
                cacheTime: 1000 * 60 * 60,
                retry: 0,
              }}
            >
              {children}
            </Wrapper>
          );
        },
      }
    );
    await waitFor(() => {
      return result.current.state === "SUCCESS";
    });

    const stateChanges = result.all.length;

    await waitForNextUpdate();

    expect(result.current.state).toBe("SUCCESS");
    expect(result.all.length).toBe(stateChanges + 1);
  });

  test("Error: Options provided in db should overwrite the default Config and context", async () => {
    const dbAtom = db<unknown, undefined>(
      (supabase) => {
        return supabase.from("users").select("name").get();
      },
      { cacheTime: 100 }
    );

    const { result, waitFor, waitForNextUpdate } = renderHook(
      () => useDb(dbAtom, undefined),
      {
        // eslint-disable-next-line react/prop-types, react/display-name
        wrapper: ({ children }) => {
          return (
            <Wrapper
              client={errorClient}
              options={{
                cacheTime: 1000 * 60 * 60,
                retry: 0,
              }}
            >
              {children}
            </Wrapper>
          );
        },
      }
    );

    await waitFor(() => {
      return result.current.state === "ERROR";
    });

    const stateChanges = result.all.length;

    await waitForNextUpdate();

    expect(result.current.state).toBe("ERROR");
    expect(result.all.length).toBe(stateChanges + 1);
  });

  test("Success : Option provided in useDb should overwrite default, context options and dbOptions", async () => {
    const dbAtom = db<unknown, undefined>(
      (supabase) => {
        return supabase.from("users").select("name").get();
      },
      { cacheTime: 1000 * 60 * 60 }
    );

    const { result, waitFor, waitForNextUpdate } = renderHook(
      () => useDb(dbAtom, undefined, { cacheTime: 100 }),
      {
        // eslint-disable-next-line react/prop-types, react/display-name
        wrapper: ({ children }) => {
          return (
            <Wrapper
              client={successClient}
              options={{
                cacheTime: 1000 * 60 * 60,
                retry: 0,
              }}
            >
              {children}
            </Wrapper>
          );
        },
      }
    );
    await waitFor(() => {
      return result.current.state === "SUCCESS";
    });

    const stateChanges = result.all.length;

    await waitForNextUpdate();

    expect(result.current.state).toBe("SUCCESS");
    expect(result.all.length).toBe(stateChanges + 1);
  });

  test("Error: Options provided in db should overwrite the default Config ,context and db options", async () => {
    const dbAtom = db<unknown, undefined>(
      (supabase) => {
        return supabase.from("users").select("name").get();
      },
      { cacheTime: 1000 * 60 * 60 }
    );

    const { result, waitFor, waitForNextUpdate } = renderHook(
      () => useDb(dbAtom, undefined, { cacheTime: 100 }),
      {
        // eslint-disable-next-line react/prop-types, react/display-name
        wrapper: ({ children }) => {
          return (
            <Wrapper
              client={errorClient}
              options={{
                cacheTime: 1000 * 60 * 60,
                retry: 0,
              }}
            >
              {children}
            </Wrapper>
          );
        },
      }
    );

    await waitFor(() => {
      return result.current.state === "ERROR";
    });

    const stateChanges = result.all.length;

    await waitForNextUpdate();

    expect(result.current.state).toBe("ERROR");
    expect(result.all.length).toBe(stateChanges + 1);
  });
});
