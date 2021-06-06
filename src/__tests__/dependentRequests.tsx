/**
 * @jest-environment jsdom
 */

import { renderHook } from "@testing-library/react-hooks";
import { db } from "@src/react-supabase/db";
import { DbResult, useDb } from "@src/react-supabase/useDb";
import { act, render, waitFor } from "@testing-library/react";
import React, { useState } from "react";
import {
  Wrapper,
  setDynamicResult,
  dynamicSuccessClient,
  ServerData,
  errorToSuccessClient,
  setSuccessOnTime,
  successClient,
} from "./utils";

describe("Dependent Requests", () => {
  test("Success: Dependent cache has already been created", async () => {
    const dbAtom = db<serverResult, string>((supabase, name) => {
      return supabase.from("test").select("*").eq("name", name);
    });

    const depAtom = db<serverResult, string>((supabase, name) => (get, hash) => {
      const result = get(dbAtom, name);

      if (result.state !== "SUCCESS") {
        return {
          ...result,
          hash,
        };
      } else {
        const { data } = result;

        const depName = data[0].name;

        return supabase.from("test").select("*").eq("name", depName);
      }
    });
    const name = "Nivekithan S";

    type serverResult = [{ id: string; name: string }];

    const wrapperComponent = {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      setRenderFirst(_render: boolean) {
        // NOTHING
      },

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      setRenderSecond(_render: boolean) {
        // NOTHING
      },
    };

    const WrapperComponent = () => {
      const [renderFirst, setRenderFirst] = useState(false);
      const [renderSecond, setRenderSecond] = useState(false);

      wrapperComponent.setRenderFirst = setRenderFirst;
      wrapperComponent.setRenderSecond = setRenderSecond;

      return (
        <Wrapper client={dynamicSuccessClient}>
          {renderFirst ? <TestComponent /> : null}
          {renderSecond ? <TestComponentDep /> : null}
        </Wrapper>
      );
    };

    const testComponent: DbResult<serverResult>[] = [];

    const TestComponent = () => {
      const result = useDb(dbAtom, name);
      testComponent.push(result);

      return <div></div>;
    };
    const testComponentDep: DbResult<serverResult>[] = [];

    const TestComponentDep = () => {
      const result = useDb(depAtom, name);
      testComponentDep.push(result);
      return <div></div>;
    };

    render(<WrapperComponent />);

    setDynamicResult([{ id: 1, name }]);

    act(() => {
      wrapperComponent.setRenderFirst(true);
    });

    await waitFor(() => {
      return expect(testComponent[testComponent.length - 1].state).toBe("SUCCESS");
    });

    setDynamicResult([{ id: 2, name }]);

    act(() => {
      wrapperComponent.setRenderSecond(true);
    });

    await waitFor(() => {
      return expect(testComponentDep[testComponentDep.length - 1].state).toBe("SUCCESS");
    });

    const depResult = testComponentDep[testComponentDep.length - 1];

    expect(depResult.data).toEqual([{ id: 2, name }]);
  });

  test("Success: Dependent Cache has not been created", async () => {
    const dbAtom = db<serverResult, string>((supabase, name) => {
      return supabase.from("test").select("*").eq("name", name);
    });

    const depAtom = db<serverResult, string>((supabase, name) => (get, hash) => {
      const result = get(dbAtom, name);

      if (result.state !== "SUCCESS") {
        return {
          ...result,
          hash,
        };
      } else {
        const { data } = result;

        const depName = data[0].name;

        return supabase.from("test").select("*").eq("name", depName);
      }
    });
    const name = "Nivekithan S";

    type serverResult = [{ id: string; name: string }];

    const wrapperComponent = {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      setRenderFirst(_render: boolean) {
        // NOTHING
      },

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      setRenderSecond(_render: boolean) {
        // NOTHING
      },
    };

    const WrapperComponent = () => {
      const [renderFirst, setRenderFirst] = useState(false);
      const [renderSecond, setRenderSecond] = useState(false);

      wrapperComponent.setRenderFirst = setRenderFirst;
      wrapperComponent.setRenderSecond = setRenderSecond;

      return (
        <Wrapper client={dynamicSuccessClient}>
          {renderFirst ? <TestComponent /> : null}
          {renderSecond ? <TestComponentDep /> : null}
        </Wrapper>
      );
    };

    const testComponent: DbResult<serverResult>[] = [];

    const TestComponent = () => {
      const result = useDb(dbAtom, name);
      testComponent.push(result);

      return <div></div>;
    };
    const testComponentDep: DbResult<serverResult>[] = [];

    const TestComponentDep = () => {
      const result = useDb(depAtom, name);
      testComponentDep.push(result);
      return <div></div>;
    };

    render(<WrapperComponent />);

    setDynamicResult([{ id: 1, name }]);
    act(() => {
      wrapperComponent.setRenderSecond(true);
    });

    const currentResDep = () => {
      return testComponentDep[testComponentDep.length - 1];
    };

    await waitFor(
      () => {
        return expect(currentResDep().state).toBe("SUCCESS");
      },
      { timeout: 3000 }
    );

    expect(currentResDep().data).toEqual([{ id: 1, name }]);

    act(() => {
      wrapperComponent.setRenderFirst(true);
    });

    const currentRes = () => {
      return testComponent[testComponent.length - 1];
    };

    expect(currentRes().state).toBe("SUCCESS");
    expect(currentRes().data).toEqual([{ id: 1, name }]);

    expect(ServerData.times).toBe(2);
  });

  test("Dependent on Dependent Db", async () => {
    const dbAtom = db<unknown, undefined>((supabase) => {
      return supabase.from("users").select("*");
    });

    const depDbAtom = db<unknown, undefined>((supabase) => (get, hash) => {
      const result = get(dbAtom);

      if (result.state === "SUCCESS") {
        return supabase.from("users").select("*");
      }

      if (result.state === "LOADING") {
        return {
          ...result,
          hash,
          state: "STALE",
        };
      }
      return {
        ...result,
        hash,
      };
    });

    const depAtom2 = db<unknown, undefined>((supabase) => (get, hash) => {
      const result = get(depDbAtom);

      if (result.state === "SUCCESS") {
        return supabase.from("users").select("*");
      }
      if (result.state === "LOADING") {
        return {
          ...result,
          hash,
          state: "STALE",
        };
      }
      return {
        ...result,
        hash,
      };
    });

    setDynamicResult([{ id: 1, name: "Nivekithan S" }]);
    const { result, waitFor } = renderHook(() => useDb(depAtom2), {
      // eslint-disable-next-line react/prop-types, react/display-name
      wrapper: ({ children }) => {
        return <Wrapper client={dynamicSuccessClient}>{children}</Wrapper>;
      },
    });

    await waitFor(() => {
      return result.current.state === "SUCCESS";
    });

    expect(ServerData.times).toBe(3);
    expect(result.current.data).toEqual([{ id: 1, name: "Nivekithan S" }]);
  });

  test("On recalculating dependent atom it returns state", async () => {
    const dbAtom = db<unknown, undefined>(
      (supabase) => {
        return supabase.from("users").select("*");
      },
      { cacheTime: 200, retry: 0 }
    );

    const depDbAtom = db<unknown, undefined>(
      (supabase) => (get, hash) => {
        const result = get(dbAtom);
        // console.warn(result)
        if (result.state === "ERROR") {
          return supabase.from("users").select("*");
        }

        if (result.state === "LOADING") {
          return {
            ...result,
            hash,
            state: "STALE",
          };
        }

        return {
          ...result,
          hash,
        };
      },
      { retry: 0 }
    );

    setSuccessOnTime(3);
    const { result, waitFor } = renderHook(() => useDb(depDbAtom), {
      // eslint-disable-next-line react/prop-types, react/display-name
      wrapper: ({ children }) => {
        return <Wrapper client={errorToSuccessClient}>{children}</Wrapper>;
      },
    });

    await waitFor(
      () => {
        return result.current.state === "ERROR";
      },
      { timeout: 2000 }
    );

    await waitFor(() => {
      return result.current.state === "SUCCESS";
    });
  });

  test("Dependent State is in desired state", async () => {
    const dbAtom = db<unknown, undefined>((supabase) => {
      return supabase.from("users").select("*");
    });

    const depAtom = db<unknown, undefined>((supabase) => (get, hash) => {
      const result = get(dbAtom);

      if (result.state === "SUCCESS") {
        return supabase.from("users").select("*");
      }

      return {
        ...result,
        hash,
      };
    });

    const wrapperComponent = {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      setRenderFirst(_render: boolean) {
        // NOTHING
      },

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      setRenderSecond(_render: boolean) {
        // NOTHING
      },
    };

    const WrapperComponent = () => {
      const [renderFirst, setRenderFirst] = useState(false);
      const [renderSecond, setRenderSecond] = useState(false);

      wrapperComponent.setRenderFirst = setRenderFirst;
      wrapperComponent.setRenderSecond = setRenderSecond;

      return (
        <Wrapper client={dynamicSuccessClient}>
          {renderFirst ? <TestComponent /> : null}
          {renderSecond ? <TestComponentDep /> : null}
        </Wrapper>
      );
    };

    const testComponent: DbResult<unknown>[] = [];

    const TestComponent = () => {
      const result = useDb(dbAtom);
      testComponent.push(result);

      return <div></div>;
    };
    const testComponentDep: DbResult<unknown>[] = [];

    const TestComponentDep = () => {
      const result = useDb(depAtom);
      testComponentDep.push(result);
      return <div></div>;
    };

    render(<WrapperComponent />);

    act(() => {
      wrapperComponent.setRenderFirst(true);
    });

    const currRes = () => {
      return testComponent[testComponent.length - 1];
    };

    const currResDep = () => {
      return testComponentDep[testComponentDep.length - 1];
    };

    await waitFor(() => {
      return currRes().state === "SUCCESS";
    });

    act(() => {
      wrapperComponent.setRenderSecond(true);
    });

    await waitFor(() => {
      return currResDep().state === "SUCCESS";
    });
  });

  test("dependent request always return supabaseBuild", async () => {
    db<unknown, undefined>((supabase) => {
      return supabase.from("users").select("*");
    });

    const depDbAtom = db<unknown, undefined>((supabase) => () => {
      return supabase.from("users").select("*");
    });

    const { result, waitFor } = renderHook(() => useDb(depDbAtom), {
      // eslint-disable-next-line react/prop-types, react/display-name
      wrapper: ({ children }) => {
        return <Wrapper client={successClient}>{children}</Wrapper>;
      },
    });

    await waitFor(() => {
      return result.current.state === "SUCCESS";
    });
  });
});
