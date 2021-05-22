/**
 * @jest-environment jsdom
 */

import { act, Renderer, renderHook, Result } from "@nivekithan/react-hooks";
import { createSimpleState } from "@src/react-supabase/cache";
import { useUser, useAuthUser } from "@src/react-supabase/context";
import { db } from "@src/react-supabase/db";
import { DbResult, useDb } from "@src/react-supabase/useDb";
import { User } from "@src/supbase-js/supabaseClient";
import { time } from "node:console";
import React from "react";
import { errorClient, successClient, Wrapper } from "./utils";
import { ServerData } from "./utils/server";

/*
 * Authorization is handled by the package @supabase/gotrue-js which is official
 * package from supabase.
 *
 * So we will not be testing weather authorization works or not since we can assume that it will work
 * rather we will be testing features related to authorization works or not like
 *
 *  - useUser hook
 *  - useAuthUser hook
 *  - Cache reset based on auth state change
 *  - Headers uses the correct key after auth change
 *  -  more ....
 */

describe("Testing authorization", () => {
  test("useUser should throw error when used outside the context tree", async () => {
    const result = renderHook(() => useUser()) as Result<unknown, User | null, Renderer<unknown>>;

    expect(result.result.error).toEqual(Error("use useUser inside SupabaseProvider tree"));
  });

  test("Not signedIn: useUser should not throw error when used inside the context tree", async () => {
    const result = renderHook(() => useUser(), {
      // eslint-disable-next-line react/prop-types, react/display-name
      wrapper: ({ children }) => {
        return (
          <Wrapper client={successClient} options={{ cacheTime: 300000, retry: 0 }}>
            {children}
          </Wrapper>
        );
      },
    }) as Result<unknown, User | null, Renderer<unknown>>;

    expect(result.result.current).toBeNull();
  });

  test("Success signedIn: useUser should not be null", async () => {
    await successClient.auth.signIn({
      email: "any-email@will-be-okay.com",
      password: "any-password-will-be-okay",
    });

    const result = renderHook(() => useUser(), {
      // eslint-disable-next-line react/prop-types, react/display-name
      wrapper: ({ children }) => {
        return (
          <Wrapper client={successClient} options={{ cacheTime: 300000, retry: 0 }}>
            {children}
          </Wrapper>
        );
      },
    }) as Result<unknown, User | null, Renderer<unknown>>;

    expect(result.result.current).not.toBeNull();
  });

  test("Error signedIn: useUser should be null", async () => {
    await errorClient.auth.signIn({
      email: "any-email@will-be-okay.com",
      password: "any-password-will-be-okay",
    });

    const result = renderHook(() => useUser(), {
      // eslint-disable-next-line react/prop-types, react/display-name
      wrapper: ({ children }) => {
        return (
          <Wrapper client={errorClient} options={{ cacheTime: 300000, retry: 0 }}>
            {children}
          </Wrapper>
        );
      },
    }) as Result<unknown, User | null, Renderer<unknown>>;

    expect(result.result.current).toBeNull();
  });

  test("Signing out a signIn uses should make user user null", async () => {
    await successClient.auth.signIn({
      email: "any-email@will-be-okay.com",
      password: "any-password-will-be-okay",
    });

    const result = renderHook(() => useUser(), {
      // eslint-disable-next-line react/prop-types, react/display-name
      wrapper: ({ children }) => {
        return (
          <Wrapper client={successClient} options={{ cacheTime: 300000, retry: 0 }}>
            {children}
          </Wrapper>
        );
      },
    }) as Result<unknown, User | null, Renderer<unknown>>;

    expect(result.result.current).not.toBeNull();
    await act(async () => {
      await successClient.auth.signOut();
    });

    expect(result.result.current).toBeNull();
  });

  test("useAuth user should throw error even if its inside the context tree but user is null", () => {
    const result = renderHook(() => useAuthUser(), {
      // eslint-disable-next-line react/prop-types, react/display-name
      wrapper: ({ children }) => {
        return (
          <Wrapper client={successClient} options={{ cacheTime: 300000, retry: 0 }}>
            {children}
          </Wrapper>
        );
      },
    }) as Result<unknown, User, Renderer<unknown>>;

    expect(result.result.error).toEqual(Error("The user is not authenticated"));
  });

  test("Success signedIn : useAuth user should not throw error if the user is authenticated", async () => {
    await successClient.auth.signIn({
      email: "some-email@gmail.com",
      password: "13245",
    });

    const result = renderHook(() => useAuthUser(), {
      // eslint-disable-next-line react/prop-types, react/display-name
      wrapper: ({ children }) => {
        return (
          <Wrapper client={successClient} options={{ cacheTime: 300000, retry: 0 }}>
            {children}
          </Wrapper>
        );
      },
    }) as Result<unknown, User | null, Renderer<unknown>>;

    expect(result.result.current).not.toBeNull();
  });

  test("Error signedIn : useAuth user should throw error if the user is authenticated", async () => {
    await errorClient.auth.signIn({
      email: "some-email@gmail.com",
      password: "13245",
    });

    const result = renderHook(() => useAuthUser(), {
      // eslint-disable-next-line react/prop-types, react/display-name
      wrapper: ({ children }) => {
        return (
          <Wrapper client={errorClient} options={{ cacheTime: 300000, retry: 0 }}>
            {children}
          </Wrapper>
        );
      },
    }) as Result<unknown, User | null, Renderer<unknown>>;

    expect(result.result.error).toEqual(Error("The user is not authenticated"));
  });

  test("Non dep req: Changing the auth should reset the cache ", async () => {
    const dbAtom = db<unknown, undefined>((supabase) => {
      return supabase.from("users").select("*").get();
    });

    await successClient.auth.signIn({
      email: "fake@email.com",
      password: "fake-password",
    });

    const { result, waitFor, waitForNextUpdate } = renderHook(() => useDb(dbAtom), {
      // eslint-disable-next-line react/prop-types, react/display-name
      wrapper: ({ children }) => {
        return (
          <Wrapper client={successClient} options={{ cacheTime: 300000, retry: 0 }}>
            {children}
          </Wrapper>
        );
      },
    }) as Result<unknown, DbResult<unknown>, Renderer<unknown>>;

    await waitFor(() => {
      return result.current.state === "SUCCESS";
    });

    const times = ServerData.times;

    await act(async () => {
      await successClient.auth.signOut();
    });

    if (ServerData.times === times + 1) {
      await waitForNextUpdate();
    }

    await waitFor(() => {
      return result.current.state === "SUCCESS";
    });
    expect(ServerData.times === times + 2);
  });

  test("dep req: Changing the auth should reset the cache ", async () => {
    const dbAtom = db<unknown, undefined>((supabase) => {
      return supabase.from("users").select("*").get();
    });

    const depAtom = db<unknown, undefined>((supabase) => (get, hash) => {
      const result = get(dbAtom);

      if (result.state !== "SUCCESS") {
        return createSimpleState(hash, "STALE");
      }

      return supabase.from("users").select("*").get();
    });

    await successClient.auth.signIn({
      email: "fake@email.com",
      password: "fake-password",
    });

    const { result, waitFor, waitForNextUpdate } = renderHook(() => useDb(depAtom), {
      // eslint-disable-next-line react/prop-types, react/display-name
      wrapper: ({ children }) => {
        return (
          <Wrapper client={successClient} options={{ cacheTime: 300000, retry: 0 }}>
            {children}
          </Wrapper>
        );
      },
    }) as Result<unknown, DbResult<unknown>, Renderer<unknown>>;

    await waitFor(() => {
      return result.current.state === "SUCCESS";
    });

    const times = ServerData.times;

    await act(async () => {
      await successClient.auth.signOut();
    });

    if (ServerData.times === times + 1) {
      await waitForNextUpdate();
    }

    await waitFor(() => {
      return result.current.state === "SUCCESS";
    });
  });

  test("non dep req: Setting resetCacheOnAuthChange to false, Should not reset the cache", async () => {
    const dbAtom = db<unknown, undefined>(
      (supabase) => {
        return supabase.from("users").select("*").get();
      },
      {
        resetCacheOnAuthChange: false,
      }
    );

    await successClient.auth.signIn({
      email: "fake@email.com",
      password: "fake-password",
    });

    const { result, waitFor } = renderHook(() => useDb(dbAtom), {
      // eslint-disable-next-line react/prop-types, react/display-name
      wrapper: ({ children }) => {
        return (
          <Wrapper client={successClient} options={{ cacheTime: 300000, retry: 0 }}>
            {children}
          </Wrapper>
        );
      },
    }) as Result<unknown, DbResult<unknown>, Renderer<unknown>>;

    await waitFor(() => {
      return result.current.state === "SUCCESS";
    });

    await act(async () => {
      await successClient.auth.signOut();
    });
    const times = ServerData.times;

    await new Promise((r) => setTimeout(r, 1000));

    expect(ServerData.times).toBe(times);
    expect(ServerData.info[ServerData.info.length - 1]).toEqual({ type: "logout" });
  });
  test("non dep req: Setting resetCacheOnAuthChange to a function which resolves to false, Should not reset the cache", async () => {
    const dbAtom = db<unknown, undefined>(
      (supabase) => {
        return supabase.from("users").select("*").get();
      },
      {
        resetCacheOnAuthChange: () => false,
      }
    );

    await successClient.auth.signIn({
      email: "fake@email.com",
      password: "fake-password",
    });

    const { result, waitFor } = renderHook(() => useDb(dbAtom), {
      // eslint-disable-next-line react/prop-types, react/display-name
      wrapper: ({ children }) => {
        return (
          <Wrapper client={successClient} options={{ cacheTime: 300000, retry: 0 }}>
            {children}
          </Wrapper>
        );
      },
    }) as Result<unknown, DbResult<unknown>, Renderer<unknown>>;

    await waitFor(() => {
      return result.current.state === "SUCCESS";
    });

    await act(async () => {
      await successClient.auth.signOut();
    });
    const times = ServerData.times;

    await new Promise((r) => setTimeout(r, 1000));

    expect(ServerData.times).toBe(times);
    expect(ServerData.info[ServerData.info.length - 1]).toEqual({ type: "logout" });
  });
  test("non dep req: Setting resetCacheOnAuthChange to a function which resolves to true, Should  reset the cache", async () => {
    const dbAtom = db<unknown, undefined>(
      (supabase) => {
        return supabase.from("users").select("*").get();
      },
      {
        resetCacheOnAuthChange: () => true,
      }
    );

    await successClient.auth.signIn({
      email: "fake@email.com",
      password: "fake-password",
    });

    const { result, waitFor, waitForNextUpdate } = renderHook(() => useDb(dbAtom), {
      // eslint-disable-next-line react/prop-types, react/display-name
      wrapper: ({ children }) => {
        return (
          <Wrapper client={successClient} options={{ cacheTime: 300000, retry: 0 }}>
            {children}
          </Wrapper>
        );
      },
    }) as Result<unknown, DbResult<unknown>, Renderer<unknown>>;

    await waitFor(() => {
      return result.current.state === "SUCCESS";
    });

    await act(async () => {
      await successClient.auth.signOut();
    });
    const times = ServerData.times;

    if (ServerData.times === times + 1) {
      await waitForNextUpdate();
    }

    await waitFor(() => {
      return result.current.state === "SUCCESS";
    });
  });

  test("dep req: Setting resetCacheOnAuthChange to false, Should not reset the cache", async () => {
    const dbAtom = db<unknown, undefined>(
      (supabase) => {
        return supabase.from("users").select("*").get();
      },
      {
        resetCacheOnAuthChange: false,
      }
    );

    const depDbAtom = db<unknown, undefined>(
      (supabase) => (get, hash) => {
        const result = get(dbAtom);

        if (result.state !== "SUCCESS") {
          return createSimpleState(hash, "STALE");
        }

        return supabase.from("users").select("*").get();
      },
      {
        resetCacheOnAuthChange: false,
      }
    );

    await successClient.auth.signIn({
      email: "fake@email.com",
      password: "fake-password",
    });

    const { result, waitFor } = renderHook(() => useDb(depDbAtom), {
      // eslint-disable-next-line react/prop-types, react/display-name
      wrapper: ({ children }) => {
        return (
          <Wrapper client={successClient} options={{ cacheTime: 300000, retry: 0 }}>
            {children}
          </Wrapper>
        );
      },
    }) as Result<unknown, DbResult<unknown>, Renderer<unknown>>;

    await waitFor(() => {
      return result.current.state === "SUCCESS";
    });

    await act(async () => {
      await successClient.auth.signOut();
    });
    const times = ServerData.times;

    await new Promise((r) => setTimeout(r, 1000));

    expect(ServerData.times).toBe(times);
    expect(ServerData.info[ServerData.info.length - 1]).toEqual({ type: "logout" });
  });
  test("dep req: Setting resetCacheOnAuthChange to a function which resolves to false, Should not reset the cache", async () => {
    const dbAtom = db<unknown, undefined>(
      (supabase) => {
        return supabase.from("users").select("*").get();
      },
      {
        resetCacheOnAuthChange: () => false,
      }
    );

    const depDbAtom = db<unknown, undefined>(
      (supabase) => (get, hash) => {
        const result = get(dbAtom);

        if (result.state !== "SUCCESS") {
          return createSimpleState(hash, "STALE");
        }

        return supabase.from("users").select("*").get();
      },
      {
        resetCacheOnAuthChange: () => false,
      }
    );

    await successClient.auth.signIn({
      email: "fake@email.com",
      password: "fake-password",
    });

    const { result, waitFor } = renderHook(() => useDb(depDbAtom), {
      // eslint-disable-next-line react/prop-types, react/display-name
      wrapper: ({ children }) => {
        return (
          <Wrapper client={successClient} options={{ cacheTime: 300000, retry: 0 }}>
            {children}
          </Wrapper>
        );
      },
    }) as Result<unknown, DbResult<unknown>, Renderer<unknown>>;

    await waitFor(() => {
      return result.current.state === "SUCCESS";
    });

    await act(async () => {
      await successClient.auth.signOut();
    });
    const times = ServerData.times;

    await new Promise((r) => setTimeout(r, 1000));

    expect(ServerData.times).toBe(times);
    expect(ServerData.info[ServerData.info.length - 1]).toEqual({ type: "logout" });
  });
  test("dep req: Setting resetCacheOnAuthChange to a function which resolves to true, Should  reset the cache", async () => {
    const dbAtom = db<unknown, undefined>(
      (supabase) => {
        return supabase.from("users").select("*").get();
      },
      {
        resetCacheOnAuthChange: () => true,
      }
    );

    const depDbAtom = db<unknown, undefined>(
      (supabase) => (get, hash) => {
        const result = get(dbAtom);

        if (result.state !== "SUCCESS") {
          return createSimpleState(hash, "STALE");
        }

        return supabase.from("users").select("*").get();
      },
      {
        resetCacheOnAuthChange: () => true,
      }
    );

    await successClient.auth.signIn({
      email: "fake@email.com",
      password: "fake-password",
    });

    const { result, waitFor, waitForNextUpdate } = renderHook(() => useDb(depDbAtom), {
      // eslint-disable-next-line react/prop-types, react/display-name
      wrapper: ({ children }) => {
        return (
          <Wrapper client={successClient} options={{ cacheTime: 300000, retry: 0 }}>
            {children}
          </Wrapper>
        );
      },
    }) as Result<unknown, DbResult<unknown>, Renderer<unknown>>;

    await waitFor(() => {
      return result.current.state === "SUCCESS";
    });

    await act(async () => {
      await successClient.auth.signOut();
    });
    const times = ServerData.times;

    if (ServerData.times === times + 1) {
      await waitForNextUpdate();
    }

    await waitFor(() => {
      return result.current.state === "SUCCESS";
    });
  });
});
