/**
 * @jest-environment jsdom
 */

import { db } from "@src/react-supabase/db";
import { DbResult, useDb } from "@src/react-supabase/useDb";
import { Renderer, renderHook, Result } from "@nivekithan/react-hooks";
import React from "react";
import { Wrapper, successResult, errorResult, errorClient, successClient } from "./utils";
import { Cache, createSimpleState } from "@src/react-supabase/cache";
import { SupabaseBuild } from "@src/react-supabase/types";

describe("Flow of requests", () => {
  test("Success: Request is success", async () => {
    const dbAtom = db<unknown, undefined>((supabase) => {
      return supabase.from("users").select("name");
    });

    const { result, waitForNextUpdate } = renderHook(() => useDb(dbAtom, undefined), {
      // eslint-disable-next-line react/prop-types, react/display-name
      wrapper: ({ children }) => {
        return (
          <Wrapper client={successClient} options={{ cacheTime: 300000, retry: 0 }}>
            {children}
          </Wrapper>
        );
      },
    }) as Result<unknown, DbResult<unknown>, Renderer<unknown>>;

    await waitForNextUpdate();

    if (result.current.state !== "LOADING") {
      expect(result.current.state).toBe("SUCCESS");
      expect(result.current.data).toStrictEqual(successResult);
      expect(result.current.error).toBeUndefined();
      expect(result.current.status).toBe(200);
      expect(result.current.statusText).toBe("The request is success");
    } else {
      expect(result.all).toHaveLength(2);
      await waitForNextUpdate({
        timeout: 3000,
      });
      expect(result.current.state).toBe("SUCCESS");
      expect(result.current.data).toBe(successResult);
      expect(result.current.error).toBeUndefined();
      expect(result.current.status).toBe(200);
      expect(result.current.statusText).toBe("The request is success");
    }
  });

  test("Error: Request is not success", async () => {
    const dbAtom = db<unknown, undefined>((supabase) => {
      return supabase.from("users").select("name");
    });

    const { result, waitForNextUpdate } = renderHook(() => useDb(dbAtom, undefined), {
      // eslint-disable-next-line react/prop-types, react/display-name
      wrapper: ({ children }) => {
        return (
          <Wrapper client={errorClient} options={{ cacheTime: 300000, retry: 0 }}>
            {children}
          </Wrapper>
        );
      },
    }) as Result<unknown, DbResult<unknown>, Renderer<unknown>>;

    await waitForNextUpdate();

    if (result.current.state !== "LOADING") {
      expect(result.all).toHaveLength(3);
      expect(result.current.state).toBe("ERROR");
      expect(result.current.error).toStrictEqual(errorResult);
      expect(result.current.data).toBeUndefined();
      expect(result.current.status).toBe(500);
      expect(result.current.statusText).toBe("The request is not success");
    } else {
      expect(result.all).toHaveLength(2);
      await waitForNextUpdate({
        timeout: 3000,
      });
      expect(result.all).toHaveLength(3);
      expect(result.current.state).toBe("ERROR");
      expect(result.current.error).toStrictEqual(errorResult);
      expect(result.current.data).toBeUndefined();
      expect(result.current.status).toBe(500);
      expect(result.current.statusText).toBe("The request is not success");
    }
  });
});

describe("Testing basic functionality of Cache class", () => {
  test("Passing unknown hash to Cache.setCache should throw error", () => {
    const hash = "123444";
    expect(() => Cache.setCache(hash, createSimpleState(hash, "STALE"))).toThrowError(
      Error(
        `Cache.setCache: There is no cache with hash ${hash} use new Cache() to create new Cache`
      )
    );
  });

  test("Passing unknown hash to Cache.subscribe should throw error", () => {
    const hash = "12344";
    expect(() =>
      Cache.subscribe(
        hash,
        () => {
          return;
        },
        () => {
          return;
        },
        { unique: "1" }
      )
    ).toThrowError(
      Error(
        `Cache.subscribe: There is no cache with hash ${hash} use new Cache() to create new cache`
      )
    );
  });

  test("Creating new cache with a hash, for which there is already an cache should throw error", () => {
    const hash = "123455";
    const supabase = {
      then: () => {
        // Do Nothing
      },
    } as SupabaseBuild;

    const options = {
      backgroundFetch: true,
      cacheTime: 3000 * 60,
      clearCacheTimeout: 3000 * 60,
      retry: 0,
      shouldComponentUpdate: () => false,
      stopRefetchTimeout: 2000 * 60,
      resetCacheOnAuthChange: true,
    };
    new Cache(successClient, () => supabase, hash, options, {});

    expect(() => new Cache(successClient, () => supabase, hash, options, {})).toThrowError(
      Error(
        `new Cache: There is already a cache with hash ${hash} use Cache.clearCache to remove it before creating a new one`
      )
    );
  });

  test("Getting option of unknown cache should throw error", () => {
    const hash = "124545";

    expect(() => Cache.getOptions(hash, "backgroundFetch")).toThrowError(
      Error(
        `Cache.getOptions: There is no cache with hash ${hash} use new Cache() to create new cache`
      )
    );
  });
  test("Passing unknown hash to Cache.getCache should throw error", () => {
    const hash = "12345";

    expect(() => Cache.getCache(hash)).toThrowError(
      Error(
        `Cache.getCache: There is no cache with hash ${hash} use new Cache() to create new Cache`
      )
    );
  });

  test("Passing unknown hash to Cache.setOptions should throw error", () => {
    const hash = "12345";

    expect(() => Cache.setOptions(hash, { cacheTime: 3000 })).toThrowError(
      Error(
        `Cache.setOptions: There is no cache with hash ${hash} use new Cache() to create new cache`
      )
    );
  });
});
