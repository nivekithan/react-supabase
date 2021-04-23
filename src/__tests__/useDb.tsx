/**
 * @jest-environment jsdom
 */

import { db, useDb } from "@src/react-supabase/db";
import { renderHook } from "@testing-library/react-hooks";
import React from "react";
import { KEY, url, Wrapper, server, successResult, errorResult } from "./utils";
import { Cache } from "@src/react-supabase/cache";
import { Key } from "@src/react-supabase/key";

beforeAll(() => server.listen());

afterEach(() => {
  Cache.reset();
  Key.reset();
  server.resetHandlers();
});

afterAll(() => server.close());

describe("Testing useDb custom hook", () => {
  test("Request is success", async () => {
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
              options={{ cacheTime: 30000 }}
            >
              {children}
            </Wrapper>
          );
        },
      }
    );

    if (result.current.state !== "LOADING") {
      expect(result.all).toHaveLength(3);
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

  test("Request is not success", async () => {
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
              options={{ cacheTime: 30000 }}
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
