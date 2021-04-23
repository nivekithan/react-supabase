/**
 * @jest-environment jsdom
 */

import { db, useDb } from "@src/react-supabase/db";
import {
  SupabaseProvider,
  SupabaseProviderProps,
} from "@src/react-supabase/context";
import { renderHook, WrapperComponent } from "@testing-library/react-hooks";
import React from "react";
import { rest } from "msw";
import { setupServer } from "msw/node";
import { KEY, URL } from "./constants";

const handlers = [
  rest.get(new RegExp(`${URL}/rest/v1`), (req, res, ctx) => {
    return res(ctx.text('"THis is great"'), ctx.status(200));
  }),
];

const server = setupServer(...handlers);

beforeAll(() => server.listen());

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => server.close());

describe("Testing useDb custom hook", () => {
  test("Demo tests", async () => {
    const dbAtom = db((supabase) => {
      return supabase.from("users").select("name").get();
    });

    const wrapper: WrapperComponent<SupabaseProviderProps> = ({
      children,
      config,
      options,
    }) => {
      return (
        <SupabaseProvider config={config} options={options}>
          {children}
        </SupabaseProvider>
      );
    };

    const { result, waitFor, waitForNextUpdate } = renderHook(
      () => useDb(dbAtom, undefined),
      {
        wrapper: ({ children }) =>
          wrapper({
            children,
            config: { key: KEY, url: URL },
            options: { cacheTime: 3000 },
          }),
      }
    );

    await waitFor(() => {
      return expect(result.current.state === "LOADING").toBe(true);
    });

    expect(result.all).toHaveLength(2);

    if (!["ERROR", "SUCCESS"].includes(result.current.state)) {
      await waitForNextUpdate({
        timeout: 3000,
      });
    }

    const isValidState = ["ERROR", "SUCCESS"].includes(result.current.state);

    expect(isValidState).toBeTruthy();
  });
});
