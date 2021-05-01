/**
 * @jest-environment jsdom
 */

import { db, useDb } from "@src/react-supabase/db";
import { renderHook } from "@testing-library/react-hooks";
import React from "react";
import { Wrapper, ServerData, errorClient, successClient } from "./utils";
import { setHashFunction } from "@src/react-supabase/hash";

describe("Feature: Cache Hash", () => {
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

  test("Error: Different db should not access each other cache", async () => {
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

describe("Feature: Override default Hash function", () => {
  test("Success: Hashing a function", () => {
    setHashFunction((provided) => {
      return (value) => {
        if (typeof value === "object" && !Array.isArray(value) && !!value) {
          return value.key;
        } else {
          return provided(value);
        }
      };
    });

    const dbAtom = db<unknown, { key: number; someFun: () => string }>(
      (supabase) => {
        return supabase.from("users").select("name").get();
      }
    );

    const { result } = renderHook(
      () => ({
        first: useDb(dbAtom, { key: 1, someFun: () => "some" }),
        second: useDb(dbAtom, { someFun: () => "some", key: 1 }),
      }),
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

    expect(result.current.first.hash).toBe(result.current.second.hash);
  });
  test("Error: Hashing a function", () => {
    setHashFunction((provided) => {
      return (value) => {
        if (typeof value === "object" && !Array.isArray(value) && !!value) {
          return value.key;
        } else {
          return provided(value);
        }
      };
    });

    const dbAtom = db<unknown, { key: number; someFun: () => string }>(
      (supabase) => {
        return supabase.from("users").select("name").get();
      }
    );

    const { result } = renderHook(
      () => ({
        first: useDb(dbAtom, { key: 1, someFun: () => "some" }),
        second: useDb(dbAtom, { someFun: () => "some", key: 1 }),
      }),
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

    expect(result.current.first.hash).toBe(result.current.second.hash);
  });
});
