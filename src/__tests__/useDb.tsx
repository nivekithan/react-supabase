/**
 * @jest-environment jsdom
 */

import { db, useDb } from "@src/react-supabase/db";
import { renderHook } from "@testing-library/react-hooks";
import React from "react";
import {
  KEY,
  url,
  Wrapper,
  server,
  successResult,
  errorResult,
  ServerData,
  setSuccessOnTime,
} from "./utils";
import { Cache } from "@src/react-supabase/cache";
import { Key } from "@src/react-supabase/key";
import { createClient } from "@src/react-supabase/context";

beforeAll(() => server.listen());

afterEach(() => {
  Cache.reset();
  Key.reset();
  ServerData.reset();
  server.resetHandlers();
  jest.useRealTimers();
});

afterAll(() => server.close());

const successClient = createClient({
  url: url.success,
  key: KEY,
});

const errorClient = createClient({
  url: url.error,
  key: KEY,
});

const errorToSuccessClient = createClient({
  url: url.errorToSuccess,
  key: KEY,
});

describe("Flow of requests", () => {
  test("Success: Request is success", async () => {
    const dbAtom = db<unknown, undefined>((supabase) => {
      return supabase.from("users").select("name").get();
    });

    const { result, waitForNextUpdate } = renderHook(
      () => useDb(dbAtom, undefined),
      {
        // eslint-disable-next-line react/prop-types, react/display-name
        wrapper: ({ children }) => {
          return (
            <Wrapper
              client={successClient}
              options={{ cacheTime: 300000, retry: 0 }}
            >
              {children}
            </Wrapper>
          );
        },
      }
    );

    await waitForNextUpdate();

    if (result.current.state !== "LOADING") {
      expect(result.current.state).toBe("SUCCESS");
      expect(result.current.data).toBe(successResult);
      expect(result.current.error).toBeUndefined();
    } else {
      expect(result.all).toHaveLength(2);
      await waitForNextUpdate({
        timeout: 3000,
      });
      expect(result.current.state).toBe("SUCCESS");
      expect(result.current.data).toBe(successResult);
      expect(result.current.error).toBeUndefined();
    }
  });

  test("Error: Request is not success", async () => {
    const dbAtom = db<unknown, undefined>((supabase) => {
      return supabase.from("users").select("name").get();
    });

    const { result, waitForNextUpdate } = renderHook(
      () => useDb(dbAtom, undefined),
      {
        // eslint-disable-next-line react/prop-types, react/display-name
        wrapper: ({ children }) => {
          return (
            <Wrapper
              client={errorClient}
              options={{ cacheTime: 300000, retry: 0 }}
            >
              {children}
            </Wrapper>
          );
        },
      }
    );

    await waitForNextUpdate();

    if (result.current.state !== "LOADING") {
      expect(result.all).toHaveLength(3);
      expect(result.current.state).toBe("ERROR");
      expect(result.current.error).toBe(errorResult);
      expect(result.current.data).toBeUndefined();
    } else {
      expect(result.all).toHaveLength(2);
      await waitForNextUpdate({
        timeout: 3000,
      });
      expect(result.current.state).toBe("ERROR");
      expect(result.current.error).toBe(errorResult);
      expect(result.current.data).toBeUndefined();
    }
  });
});

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

describe("Feature: Refetch based on Cache time", () => {
  test("Success: Should refetch the requests based on cache time ", async () => {
    const dbAtom = db<unknown, undefined>((supabase) => {
      return supabase.from("users").select("name").get();
    });

    const { result, waitFor, waitForNextUpdate } = renderHook(
      () => {
        return useDb(dbAtom, undefined);
      },
      {
        // eslint-disable-next-line react/prop-types, react/display-name
        wrapper: ({ children }) => {
          return (
            <Wrapper
              client={successClient}
              options={{ cacheTime: 100, retry: 0 }}
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

    await waitForNextUpdate({
      timeout: 150,
    });

    expect(ServerData.times).toBe(2);
  });

  test("Error: Should refetch the requests based on cache time", async () => {
    const dbAtom = db<unknown, undefined>((supabase) => {
      return supabase.from("users").select("name").get();
    });

    const { result, waitFor, waitForNextUpdate } = renderHook(
      () => {
        return useDb(dbAtom, undefined);
      },
      {
        // eslint-disable-next-line react/prop-types, react/display-name
        wrapper: ({ children }) => {
          return (
            <Wrapper
              client={errorClient}
              options={{ cacheTime: 100, retry: 0 }}
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

    await waitForNextUpdate({
      timeout: 150,
    });

    expect(ServerData.times).toBe(2);
  });
});
describe("Feature: Background fetching", () => {
  test("Success: Refetching request should happen in background", async () => {
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
              options={{ cacheTime: 100, retry: 0 }}
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

    await waitForNextUpdate({ timeout: 250 });

    expect(result.current.state).toBe("SUCCESS");
    expect(result.all.length).toBe(stateChanges + 1);
  });

  test("Error: Refetching request should happen in background", async () => {
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
              options={{ cacheTime: 100, retry: 0 }}
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

    await waitForNextUpdate({ timeout: 200 });

    expect(result.current.state).toBe("ERROR");
    expect(result.all.length).toBe(stateChanges + 1);
  });

  test("Success: If background refetching is disabled then state change should be reflected", async () => {
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
              options={{ cacheTime: 100, backgroundFetch: false, retry: 0 }}
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

    await waitFor(() => {
      return result.current.state === "SUCCESS";
    });

    expect(result.all.length).toBe(stateChanges + 3);
  });

  test("Error: If background refetching is disabled then state change should be reflected", async () => {
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
              options={{ cacheTime: 100, backgroundFetch: false, retry: 0 }}
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

    await waitFor(() => {
      return result.current.state === "ERROR";
    });

    expect(result.all.length).toBe(stateChanges + 3);
  });
});

describe("Feature: Cache", () => {
  test("Success: If hash is same no additional requests should be made to server", async () => {
    const dbAtom = db<unknown, undefined>((supabase) => {
      return supabase.from("users").select("name").get();
    });

    const { result, waitFor } = renderHook(
      () => ({
        first: useDb(dbAtom, undefined),
        second: useDb(dbAtom, undefined),
      }),
      {
        // eslint-disable-next-line react/prop-types, react/display-name
        wrapper: ({ children }) => {
          return (
            <Wrapper
              client={successClient}
              options={{ cacheTime: 300000, retry: 0 }}
            >
              {children}
            </Wrapper>
          );
        },
      }
    );

    await waitFor(() => {
      return (
        result.current.first.state === "SUCCESS" &&
        result.current.second.state === "SUCCESS"
      );
    });
    expect(ServerData.times).toBe(1);
  });

  test("Error: If hash is same no additional requests should be made to server", async () => {
    const dbAtom = db<unknown, undefined>((supabase) => {
      return supabase.from("users").select("name").get();
    });

    const { result, waitFor } = renderHook(
      () => ({
        first: useDb(dbAtom, undefined),
        second: useDb(dbAtom, undefined),
        third: useDb(dbAtom, undefined),
      }),
      {
        // eslint-disable-next-line react/prop-types, react/display-name
        wrapper: ({ children }) => {
          return (
            <Wrapper
              client={errorClient}
              options={{ cacheTime: 300000, retry: 0 }}
            >
              {children}
            </Wrapper>
          );
        },
      }
    );

    await waitFor(() => {
      return (
        result.current.first.state === "ERROR" &&
        result.current.second.state === "ERROR"
      );
    });
    expect(ServerData.times).toBe(1);
  });

  test("Success: If db is same but hash is different there should be additional request which then should be cached", async () => {
    const dbAtom = db<unknown, { name: string }>((supabase) => {
      return supabase.from("users").select("name").get();
    });

    const { result, waitFor } = renderHook(
      () => ({
        first: useDb(dbAtom, { name: "name" }),
        second: useDb(dbAtom, { name: "someother name" }),
      }),
      {
        // eslint-disable-next-line react/prop-types, react/display-name
        wrapper: ({ children }) => {
          return (
            <Wrapper
              client={successClient}
              options={{ cacheTime: 300000, retry: 0 }}
            >
              {children}
            </Wrapper>
          );
        },
      }
    );

    await waitFor(() => {
      return (
        result.current.first.state === "SUCCESS" &&
        result.current.second.state === "SUCCESS"
      );
    });
    expect(ServerData.times).toBe(2);
  });
  test("Error: If db is same but hash is different then there should be additional request which then should be cached", async () => {
    const dbAtom = db<unknown, { name: string }>((supabase) => {
      return supabase.from("users").select("name").get();
    });

    const { result, waitFor } = renderHook(
      () => ({
        first: useDb(dbAtom, { name: "someother" }),
        second: useDb(dbAtom, { name: "name" }),
      }),
      {
        // eslint-disable-next-line react/prop-types, react/display-name
        wrapper: ({ children }) => {
          return (
            <Wrapper
              client={errorClient}
              options={{ cacheTime: 300000, retry: 0 }}
            >
              {children}
            </Wrapper>
          );
        },
      }
    );

    await waitFor(() => {
      return (
        result.current.first.state === "ERROR" &&
        result.current.second.state === "ERROR"
      );
    });
    expect(ServerData.times).toBe(2);
  });

  test("Success: Different db should not access each other cache", async () => {
    const dbAtom1 = db<unknown, undefined>((supabase) => {
      return supabase.from("users").select("name").get();
    });
    const dbAtom2 = db<unknown, undefined>((supabase) => {
      return supabase.from("users").select("name").get();
    });

    const { result, waitFor } = renderHook(
      () => {
        return {
          first: useDb(dbAtom1, undefined),
          second: useDb(dbAtom2, undefined),
        };
      },
      {
        // eslint-disable-next-line react/prop-types, react/display-name
        wrapper: ({ children }) => {
          return (
            <Wrapper
              client={successClient}
              options={{ cacheTime: 300000, retry: 0 }}
            >
              {children}
            </Wrapper>
          );
        },
      }
    );

    await waitFor(() => {
      return (
        result.current.first.state === "SUCCESS" &&
        result.current.second.state === "SUCCESS"
      );
    });

    expect(ServerData.times).toBe(2);
  });

  test("Error: Different db<unknown, undefined> should not access each other cache", async () => {
    const dbAtom1 = db<unknown, undefined>((supabase) => {
      return supabase.from("users").select("name").get();
    });
    const dbAtom2 = db<unknown, undefined>((supabase) => {
      return supabase.from("users").select("name").get();
    });

    const { result, waitFor } = renderHook(
      () => {
        return {
          first: useDb(dbAtom1, undefined),
          second: useDb(dbAtom2, undefined),
        };
      },
      {
        // eslint-disable-next-line react/prop-types, react/display-name
        wrapper: ({ children }) => {
          return (
            <Wrapper
              client={errorClient}
              options={{ cacheTime: 300000, retry: 0 }}
            >
              {children}
            </Wrapper>
          );
        },
      }
    );

    await waitFor(() => {
      return (
        result.current.first.state === "ERROR" &&
        result.current.second.state === "ERROR"
      );
    });

    expect(ServerData.times).toBe(2);
  });
});

describe("Feature: ShouldComponentUpdate", () => {
  test("Success: testing ShouldComponentUpdate", async () => {
    const dbAtom = db<unknown, undefined>(
      (supabase) => {
        return supabase.from("users").select("name").get();
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
    });

    await waitFor(() => {
      return result.current.state === "SUCCESS";
    });

    expect(result.all.length).toBe(2);
  });
  test("Error: testing ShouldComponentUpdate", async () => {
    const dbAtom = db<unknown, undefined>(
      (supabase) => {
        return supabase.from("users").select("name").get();
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
    });

    await waitFor(() => {
      return result.current.state === "ERROR";
    });

    expect(result.all.length).toBe(2);
  });
});

describe("Feature: Refetching error request", () => {
  test("ErrorToSuccess : The first response is success ", async () => {
    setSuccessOnTime(1);

    const dbAtom = db<unknown, undefined>((supabase) => {
      return supabase.from("users").select("name").get();
    });

    const { result, waitFor } = renderHook(() => useDb(dbAtom, undefined), {
      // eslint-disable-next-line react/prop-types, react/display-name
      wrapper: ({ children }) => {
        return <Wrapper client={errorToSuccessClient}>{children}</Wrapper>;
      },
    });

    await waitFor(() => {
      return result.current.state === "SUCCESS";
    });

    expect(ServerData.times).toBe(1);
  });

  test("ErrorToSuccess: Success on last try", async () => {
    setSuccessOnTime(4);

    const dbAtom = db<unknown, undefined>((supabase) => {
      return supabase.from("users").select("name").get();
    });

    const { result, waitFor } = renderHook(() => useDb(dbAtom, undefined), {
      // eslint-disable-next-line react/prop-types, react/display-name
      wrapper: ({ children }) => {
        return <Wrapper client={errorToSuccessClient}>{children}</Wrapper>;
      },
    });

    await waitFor(() => {
      return result.current.state === "SUCCESS";
    });

    expect(ServerData.times).toBe(4);
  });

  test("ErrorToSuccess: Success on in between try", async () => {
    setSuccessOnTime(3);

    const dbAtom = db<unknown, undefined>((supabase) => {
      return supabase.from("users").select("name").get();
    });

    const { result, waitFor } = renderHook(() => useDb(dbAtom, undefined), {
      // eslint-disable-next-line react/prop-types, react/display-name
      wrapper: ({ children }) => {
        return <Wrapper client={errorToSuccessClient}>{children}</Wrapper>;
      },
    });

    await waitFor(() => {
      return result.current.state === "SUCCESS";
    });

    expect(ServerData.times).toBe(3);
  });

  test("ErrorToSuccess: Never a success response", async () => {
    const dbAtom = db<unknown, undefined>((supabase) => {
      return supabase.from("users").select("name").get();
    });

    const { result, waitFor } = renderHook(() => useDb(dbAtom, undefined), {
      // eslint-disable-next-line react/prop-types, react/display-name
      wrapper: ({ children }) => {
        return <Wrapper client={errorToSuccessClient}>{children}</Wrapper>;
      },
    });

    await waitFor(() => {
      return result.current.state === "ERROR";
    });

    expect(ServerData.times).toBe(4);
  });
});

describe("Feature: Garbage collection", () => {
  test("Success: The refetching request based on cache time should stopped if there are no subscribers for stopRefetchTimeout", async () => {
    const dbAtom = db<unknown, undefined>((supabase) => {
      return supabase.from("users").select("name").get();
    });

    const { result, waitFor, unmount, rerender } = renderHook(
      () => useDb(dbAtom, undefined),
      {
        // eslint-disable-next-line react/prop-types, react/display-name
        wrapper: ({ children }) => {
          return (
            <Wrapper
              client={successClient}
              options={{ cacheTime: 200, retry: 0, stopRefetchTimeout: 100 }}
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
    const serverCalls = ServerData.times;

    unmount();

    rerender();

    unmount();

    await new Promise((r) => setTimeout(r, 200));

    expect(ServerData.times).toBe(serverCalls);
  });

  test("Error: The refetching request based on cache time should stopped if there are no subscribers for stopRefetchTimeout", async () => {
    const dbAtom = db<unknown, undefined>((supabase) => {
      return supabase.from("users").select("name").get();
    });

    const { result, waitFor, unmount, rerender } = renderHook(
      () => useDb(dbAtom, undefined),
      {
        // eslint-disable-next-line react/prop-types, react/display-name
        wrapper: ({ children }) => {
          return (
            <Wrapper
              client={errorClient}
              options={{ cacheTime: 200, retry: 0, stopRefetchTimeout: 100 }}
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
    const serverCalls = ServerData.times;

    unmount();

    rerender();

    unmount();

    await new Promise((r) => setTimeout(r, 200));

    expect(ServerData.times).toBe(serverCalls);
  });

  test("Success: The cache should be cleared based on clearCacheTimeout if there are no subscribers", async () => {
    const dbAtom = db<unknown, undefined>((supabase) => {
      return supabase.from("users").select("name").get();
    });

    const { result, waitFor, unmount, rerender } = renderHook(
      () => useDb(dbAtom, undefined),
      {
        // eslint-disable-next-line react/prop-types, react/display-name
        wrapper: ({ children }) => {
          return (
            <Wrapper
              client={successClient}
              options={{ retry: 0, clearCacheTimeout: 200 }}
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
    const serverCalls = ServerData.times;

    unmount();

    rerender();

    unmount();

    await new Promise((r) => setTimeout(r, 250));

    rerender();

    await waitFor(() => {
      return result.current.state === "SUCCESS";
    });

    expect(ServerData.times).toBe(serverCalls + 1);
  });

  test("Error: The cache should be cleared based on clearCacheTimeout if there are no subscribers", async () => {
    const dbAtom = db<unknown, undefined>((supabase) => {
      return supabase.from("users").select("name").get();
    });

    const { result, waitFor, unmount, rerender } = renderHook(
      () => useDb(dbAtom, undefined),
      {
        // eslint-disable-next-line react/prop-types, react/display-name
        wrapper: ({ children }) => {
          return (
            <Wrapper
              client={errorClient}
              options={{ retry: 0, clearCacheTimeout: 200 }}
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
    const serverCalls = ServerData.times;

    unmount();

    rerender();

    unmount();

    await new Promise((r) => setTimeout(r, 250));

    rerender();

    await waitFor(() => {
      return result.current.state === "ERROR";
    });

    expect(ServerData.times).toBe(serverCalls + 1);
  });
});
