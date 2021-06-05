/**
 * @jest-environment jsdom
 */

import { getHash } from "@src/react-supabase/hash";
import { mutate } from "@src/react-supabase/mutate";
import { MutationCache } from "@src/react-supabase/mutationCache";
import { useMutate } from "@src/react-supabase/useMutate";
import { render, waitFor } from "@testing-library/react";
import React from "react";
import { errorClient, ServerData, successClient, Wrapper } from "./utils";

describe("Testing: useMutate", () => {
  test("Success: Make api calls", async () => {
    const mutate1 = mutate<unknown, string, number>((supabase, str, num) => {
      return supabase.from("table").insert([str]).order(`${num}`);
    });

    const hookValues: { hash: string; update: (setProps: number) => void } = {
      hash: "",
      update: () => {
        // DO NOTHING
      },
    };

    const Component = () => {
      const update = useMutate(mutate1, "something");
      const hash = getHash(mutate1, "something");
      hookValues.update = update;
      hookValues.hash = hash;
      return <div>Hello</div>;
    };

    render(<Component />, {
      // eslint-disable-next-line react/display-name, react/prop-types
      wrapper: ({ children }) => {
        return <Wrapper client={successClient}>{children}</Wrapper>;
      },
    });

    hookValues.update(1);

    const hash = hookValues.hash;

    await waitFor(() => {
      return MutationCache.cache[hash];
    });

    expect(ServerData.times).toBe(1);
  });

  test("Error: Make api calls", async () => {
    const mutate1 = mutate<unknown, string, number>((supabase, str, num) => {
      return supabase.from("table").insert([str]).order(`${num}`);
    });

    const hookValues: { hash: string; update: (setProps: number) => void } = {
      hash: "",
      update: () => {
        // DO NOTHING
      },
    };

    const Component = () => {
      const update = useMutate(mutate1, "something");
      const hash = getHash(mutate1, "something");
      hookValues.update = update;
      hookValues.hash = hash;
      return <div>Hello</div>;
    };

    render(<Component />, {
      // eslint-disable-next-line react/display-name, react/prop-types
      wrapper: ({ children }) => {
        return <Wrapper client={errorClient}>{children}</Wrapper>;
      },
    });

    hookValues.update(1);

    const hash = hookValues.hash;

    await waitFor(() => {
      return MutationCache.cache[hash];
    });

    expect(ServerData.times).toBe(1);
  });
});
