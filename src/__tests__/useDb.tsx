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
} from "./utils";
import { Cache } from "@src/react-supabase/cache";
import { Key } from "@src/react-supabase/key";

beforeAll(() => server.listen());

afterEach(() => {
  Cache.reset();
  Key.reset();
  ServerData.reset();
  server.resetHandlers();
});

afterAll(() => server.close());

describe("Flow of requests", () => {
  test("Success: Request is success", async () => {
    const dbAtom = db((supabase) => {
      return supabase.from("users").select("name").get();
    });

    const { result, waitForNextUpdate } = renderHook(
      () => useDb(dbAtom, undefined),
      {
        // eslint-disable-next-line react/prop-types, react/display-name
        wrapper: ({ children }) => {
          return (
            <Wrapper
              config={{ key: KEY, url: url.success }}
              options={{ cacheTime: 300000 }}
            >
              {children}
            </Wrapper>
          );
        },
      }
    );

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
    const dbAtom = db((supabase) => {
      return supabase.from("users").select("name").get();
    });

    const { result, waitForNextUpdate } = renderHook(
      () => useDb(dbAtom, undefined),
      {
        // eslint-disable-next-line react/prop-types, react/display-name
        wrapper: ({ children }) => {
          return (
            <Wrapper
              config={{ key: KEY, url: url.error }}
              options={{ cacheTime: 300000 }}
            >
              {children}
            </Wrapper>
          );
        },
      }
    );

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

describe("Feature: Refetch based on Cache time", () => {
  test("Success: Should refetch the requests based on cache time ", async () => {
    const dbAtom = db((supabase) => {
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
              config={{ key: KEY, url: url.success }}
              options={{ cacheTime: 100 }}
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
    const dbAtom = db((supabase) => {
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
              config={{ key: KEY, url: url.error }}
              options={{ cacheTime: 100 }}
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
  describe("Feature: Background fetching", () => {
    test("Success: Refetching request should happen in background", async () => {
      const dbAtom = db((supabase) => {
        return supabase.from("users").select("name").get();
      });

      const { result, waitFor, waitForNextUpdate } = renderHook(
        () => useDb(dbAtom, undefined),
        {
          // eslint-disable-next-line react/prop-types, react/display-name
          wrapper: ({ children }) => {
            return (
              <Wrapper
                config={{ key: KEY, url: url.success }}
                options={{ cacheTime: 100 }}
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

      await waitForNextUpdate({ timeout: 200 });

      expect(result.current.state).toBe("SUCCESS");
      expect(result.all.length).toBe(stateChanges + 1);
    });

    test("Error: Refetching request should happen in background", async () => {
      const dbAtom = db((supabase) => {
        return supabase.from("users").select("name").get();
      });

      const { result, waitFor, waitForNextUpdate } = renderHook(
        () => useDb(dbAtom, undefined),
        {
          // eslint-disable-next-line react/prop-types, react/display-name
          wrapper: ({ children }) => {
            return (
              <Wrapper
                config={{ key: KEY, url: url.error }}
                options={{ cacheTime: 100 }}
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
      const dbAtom = db((supabase) => {
        return supabase.from("users").select("name").get();
      });

      const { result, waitFor, waitForNextUpdate } = renderHook(
        () => useDb(dbAtom, undefined),
        {
          // eslint-disable-next-line react/prop-types, react/display-name
          wrapper: ({ children }) => {
            return (
              <Wrapper
                config={{ key: KEY, url: url.success }}
                options={{ cacheTime: 100, backgroundFetch: false }}
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
      const dbAtom = db((supabase) => {
        return supabase.from("users").select("name").get();
      });

      const { result, waitFor, waitForNextUpdate } = renderHook(
        () => useDb(dbAtom, undefined),
        {
          // eslint-disable-next-line react/prop-types, react/display-name
          wrapper: ({ children }) => {
            return (
              <Wrapper
                config={{ key: KEY, url: url.error }}
                options={{ cacheTime: 100, backgroundFetch: false }}
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

    test("Success: The option given in db should take precedence over option provided in context", async () => {
      const dbAtom = db(
        (supabase) => {
          return supabase.from("users").select("name").get();
        },
        { backgroundFetch: true }
      );

      const { result, waitFor, waitForNextUpdate } = renderHook(
        () => useDb(dbAtom, undefined),
        {
          // eslint-disable-next-line react/prop-types, react/display-name
          wrapper: ({ children }) => {
            return (
              <Wrapper
                config={{ key: KEY, url: url.success }}
                options={{ cacheTime: 100, backgroundFetch: false }}
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

    test("Error: The option given in db should take precedence over option provided in context", async () => {
      const dbAtom = db(
        (supabase) => {
          return supabase.from("users").select("name").get();
        },
        { backgroundFetch: true }
      );

      const { result, waitFor, waitForNextUpdate } = renderHook(
        () => useDb(dbAtom, undefined),
        {
          // eslint-disable-next-line react/prop-types, react/display-name
          wrapper: ({ children }) => {
            return (
              <Wrapper
                config={{ key: KEY, url: url.error }}
                options={{ cacheTime: 100, backgroundFetch: false }}
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

      await waitForNextUpdate({ timeout: 250 });

      expect(result.current.state).toBe("ERROR");
      expect(result.all.length).toBe(stateChanges + 1);
    });

    test("Success: Option provided in useDb should override both db and context", async () => {
      const dbAtom = db(
        (supabase) => {
          return supabase.from("users").select("name").get();
        },
        { backgroundFetch: false }
      );

      const { result, waitFor, waitForNextUpdate } = renderHook(
        () => useDb(dbAtom, undefined, { backgroundFetch: true }),
        {
          // eslint-disable-next-line react/prop-types, react/display-name
          wrapper: ({ children }) => {
            return (
              <Wrapper
                config={{ key: KEY, url: url.success }}
                options={{ cacheTime: 100, backgroundFetch: false }}
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
    test("Error: Option provided in useDb should override both db and context", async () => {
      const dbAtom = db(
        (supabase) => {
          return supabase.from("users").select("name").get();
        },
        { backgroundFetch: false }
      );

      const { result, waitFor, waitForNextUpdate } = renderHook(
        () => useDb(dbAtom, undefined, { backgroundFetch: true }),
        {
          // eslint-disable-next-line react/prop-types, react/display-name
          wrapper: ({ children }) => {
            return (
              <Wrapper
                config={{ key: KEY, url: url.error }}
                options={{ cacheTime: 100, backgroundFetch: false }}
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

      await waitForNextUpdate({ timeout: 250 });

      expect(result.current.state).toBe("ERROR");
      expect(result.all.length).toBe(stateChanges + 1);
    });
  });
});

describe("Feature: Cache", () => {
  test("Success: If hash is same no additional requests should be made to server", async () => {
    const dbAtom = db((supabase) => {
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
              config={{ key: KEY, url: url.success }}
              options={{ cacheTime: 300000 }}
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
    const dbAtom = db((supabase) => {
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
              config={{ key: KEY, url: url.error }}
              options={{ cacheTime: 300000 }}
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
    const dbAtom = db((supabase) => {
      return supabase.from("users").select("name").get();
    });

    const { result, waitFor } = renderHook(
      () => ({
        first: useDb(dbAtom, { name: "name", secondName: "secondName" }),
        second: useDb(dbAtom, undefined),
      }),
      {
        // eslint-disable-next-line react/prop-types, react/display-name
        wrapper: ({ children }) => {
          return (
            <Wrapper
              config={{ key: KEY, url: url.success }}
              options={{ cacheTime: 300000 }}
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
    const dbAtom = db((supabase) => {
      return supabase.from("users").select("name").get();
    });

    const { result, waitFor } = renderHook(
      () => ({
        first: useDb(dbAtom, undefined),
        second: useDb(dbAtom, { name: "name", secondName: "secondName" }),
      }),
      {
        // eslint-disable-next-line react/prop-types, react/display-name
        wrapper: ({ children }) => {
          return (
            <Wrapper
              config={{ key: KEY, url: url.error }}
              options={{ cacheTime: 300000 }}
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
    const dbAtom1 = db((supabase) => {
      return supabase.from("users").select("name").get();
    });
    const dbAtom2 = db((supabase) => {
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
              config={{ key: KEY, url: url.success }}
              options={{ cacheTime: 300000 }}
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

  test("Error: Different db should not access each other cache", async () => {
    const dbAtom1 = db((supabase) => {
      return supabase.from("users").select("name").get();
    });
    const dbAtom2 = db((supabase) => {
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
              config={{ key: KEY, url: url.error }}
              options={{ cacheTime: 300000 }}
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
