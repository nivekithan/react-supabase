import React, { useState } from "react";
import { Cache, createSimpleState } from "./react-supabase/cache";
import { useUser } from "./react-supabase/context";
import { db } from "./react-supabase/db";
import { useDb } from "./react-supabase/useDb";
import { supabase } from "./supabase";
const dbAtom = db<unknown, undefined>(
  (supabase) => {
    return supabase.from("todos").select("*").get();
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

    return supabase.from("todos").select("*").get();
  },
  {
    resetCacheOnAuthChange: () => true,
  }
);
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

  const onClickAction = async (
    e: React.MouseEvent<HTMLButtonElement>,
    action: "signIn" | "signOut"
  ) => {
    e.preventDefault();

    const result = await supabase.auth[action]({
      email: import.meta.env.VITE_ACCOUNT_EMAIL as string,
      password: import.meta.env.VITE_ACCOUNT_PASSWORD as string,
    });

    console.log(result);
  };

  return (
    <div>
      <p>Start of Supabase management</p>
      {state === "SUCCESS" ? <small>Success</small> : null}
      <button onClick={onClick}>Shown children </button>
      <button onClick={logOnClick}>Log Cache object</button>
      <button onClick={(e) => onClickAction(e, "signIn")}>SignIn</button>
      <button onClick={(e) => onClickAction(e, "signOut")}>SignOut</button>

      {showChildren ? <Component /> : null}
    </div>
  );
};

const Component = () => {
  const result = useDb(depDbAtom);
  const user = useUser();

  const resultStr = JSON.stringify(result, null, 8);

  console.log(result);
  console.log(user);
  return <div>{resultStr}</div>;
};
