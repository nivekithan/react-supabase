import React, { useState } from "react";
import { db, useDb } from "./react-supabase/db";

const userData = db<{ users: string }>((supabase, arg) => {
  return supabase
    .from("users")
    .select("*")
    .lt("id", 3)
    .order("id", { ascending: false })
    .get();
});

export const App = () => {
  const userDataRes = useDb(userData, { users: "users" });
  const [showChildren, setShowChildren] = useState(true);

  const onClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setShowChildren((s) => !s);
  };

  if (userDataRes.state === "LOADING") {
    console.log(1, "Loading");
  } else if (userDataRes.state === "ERROR") {
    console.log(1, "Error", userDataRes.error);
  } else {
    console.log(1, userDataRes.state, userDataRes.data);
  }

  return (
    <div>
      <p>Start of Supabase management</p>
      <button onClick={onClick}>toggle children</button>
      {showChildren ? <Component /> : null}
    </div>
  );
};

const Component = () => {
  const userDataRes = useDb(userData, { users: "users" });

  if (userDataRes.state === "LOADING") {
    console.log(2, "Loading");
  } else if (userDataRes.state === "ERROR") {
    console.log(2, "Error", userDataRes.error);
  } else {
    console.log(2, userDataRes.state, userDataRes.data);
  }

  return <div>Children !</div>;
};
