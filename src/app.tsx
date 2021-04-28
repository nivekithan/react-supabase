import React, { useState } from "react";
import { db, useDb } from "./react-supabase/db";

const userData = db<any, { users: string }>(
  (supabase) => {
    return supabase
      .from("users")
      .select("*")
      .lt("id", 3)
      .order("id", { ascending: false })
      .get();
  },
  {
    shouldComponentUpdate: (curr, next) => {
      if (curr.state === "STALE" && next.state === "LOADING") {
        return false;
      } else {
        return true;
      }
    },
  }
);

export const App = () => {
  const [showChildren, setShowChildren] = useState(false);

  const onClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setShowChildren((s) => !s);
  };

  // if (userDataRes.state === "LOADING") {
  //   console.log(1, "Loading");
  // } else if (userDataRes.state === "ERROR") {
  //   console.log(1, "Error", userDataRes.error);
  // } else {
  //   console.log(1, userDataRes.state, userDataRes.data, userDataRes.error);
  // }

  return (
    <div>
      <p>Start of Supabase management</p>
      <button onClick={onClick}>toggle children</button>
      {showChildren ? <Component /> : null}
    </div>
  );
};

const Component = () => {
  const userDataRes = useDb(
    userData,
    { users: "users" },
    { cacheTime: 2000, stopRefetchTimeout: 100 }
  );

  if (userDataRes.state === "LOADING") {
    console.log(2, "Loading");
  } else if (userDataRes.state === "ERROR") {
    console.log(2, "Error", userDataRes.error);
  } else {
    console.log(2, userDataRes.state, userDataRes.data);
  }

  return <div>Children !</div>;
};
