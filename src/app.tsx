import { renderHook } from "@nivekithan/react-hooks";
import React, { useState } from "react";
import { Cache } from "./react-supabase/cache";
import { db } from "./react-supabase/db";
import { useDb } from "./react-supabase/useDb";

const dbAtom = db<unknown, undefined>((supabase) => {
  return supabase.from("users").select("*").get();
});

const depDbAtom = db<unknown, undefined>((supabase) => (get, hash) => {
  const result = get(dbAtom);

  if (result.state === "SUCCESS") {
    return supabase.from("users").select("*").get();
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
    return supabase.from("users").select("*").get();
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
export const App = () => {
  // const { state, data } = useDb(userData, "users");
  const state = "SUCCESS";
  const [showChildren, setShowChildren] = useState(false);

  const onClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setShowChildren((s) => !s);
  };

  const logOnClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    console.log(Cache.cache);
  };

  return (
    <div>
      <p>Start of Supabase management</p>
      {state === "SUCCESS" ? <small>Success</small> : null}
      <button onClick={onClick}>Shown children </button>
      <button onClick={logOnClick}>Log Cache object</button>
      {showChildren ? <Component /> : null}
    </div>
  );
};

const Component = () => {
  const result = useDb(depAtom2);

  console.log(result);

  return <div>Children !</div>;
};
