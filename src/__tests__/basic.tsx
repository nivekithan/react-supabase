/**
 * @jest-environment jsdom
 */

import { db, useDb } from "@src/react-supabase/db";
import { renderHook } from "@testing-library/react-hooks";
import React from "react";
import {
  Wrapper,
  successResult,
  errorResult,
  errorClient,
  successClient,
} from "./utils";

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
      expect(result.current.data).toStrictEqual(successResult);
      expect(result.current.error).toBeUndefined();
      expect(result.current.status).toBe(200);
      expect(result.current.statusText).toBe("The request is success");
      expect(result.current.count).toBeUndefined();
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
      expect(result.current.count).toBeUndefined();
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
      expect(result.current.error).toStrictEqual(errorResult);
      expect(result.current.data).toBeUndefined();
      expect(result.current.count).toBeUndefined();
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
      expect(result.current.count).toBeUndefined();
      expect(result.current.status).toBe(500);
      expect(result.current.statusText).toBe("The request is not success");
    }
  });
});
