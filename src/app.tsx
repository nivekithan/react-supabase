import React, { useState } from "react";
import { DbCache, createSimpleState } from "./react-supabase/dbCache";
import { useUser } from "./react-supabase/context";
import { db } from "./react-supabase/db";
import { useDb } from "./react-supabase/useDb";
import { supabase } from "./supabase";

const dbAtom = db<{ name: string }[], string>((supabase, name) => {
  return supabase.from("test").select("*").eq("name", name);
});

const depAtom = db<{ name: string }[], string>((supabase, name) => (get, hash) => {
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
export const App = () => {
  const { state } = useDb(dbAtom, "Nivekithan");
  const [showChildren, setShowChildren] = useState(false);

  const onClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setShowChildren((s) => !s);
  };

  const logOnClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    console.log(DbCache.cache);
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
  const result = useDb(depAtom, "Nivekithan");

  console.log(result);
  return <div>Child</div>;
};
