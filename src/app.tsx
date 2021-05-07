import React, { useState } from "react";
import { db } from "./react-supabase/db";
import { deDb, useDeDb } from "./react-supabase/deDb";
import { useDb } from "./react-supabase/useDb";

const userData = db<{ id: number; userName: string }, string>(
  (supabase, table) => {
    return supabase.from(table).select("*").eq("id", 3).get();
  }
);

const plus1User = deDb<{ id: number; userName: string }, string>(
  (supabase) => (get) => {
    const result = get(userData, "users");

    if (result.state === "SUCCESS") {
      return supabase
        .from("users")
        .select("*")
        .eq("id", result.data[0].id + 1)
        .get();
    } else {
      return supabase.from("users").select("*").eq("id", 1).get();
    }
  }
);

export const App = () => {
  const { state, data } = useDb(userData, "users");
  const [showChildren, setShowChildren] = useState(true);

  const onClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setShowChildren((s) => !s);
  };

  return (
    <div>
      <p>Start of Supabase management</p>
      {state === "SUCCESS" ? <small>Success</small> : null}
      <button onClick={onClick}>Shown children </button>
      {showChildren ? <Component /> : null}
    </div>
  );
};

const Component = () => {
  const result = useDeDb(plus1User, "users");

  console.log(result);

  return <div>Children !</div>;
};
