import React, { useState } from "react";
import { db } from "./react-supabase/db";
import { useDb } from "./react-supabase/useDb";

const userData = db<any, { users: string }>((supabase) => {
  return supabase
    .from("users")
    .select("*")
    .lt("id", 3)
    .order("id", { ascending: false })
    .get();
});

export const App = () => {
  const [numValue, setNumValue] = useState(0);
  // const userDataRes = useDb(userData, { users: "users" });
  const onClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setNumValue((n) => n + 1);
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
      <button onClick={onClick}>Increase Number</button>
      <Component num={numValue} />
    </div>
  );
};

const Component = ({ num }: { num: number }) => {
  const userDataRes = useDb(
    userData,
    { users: `${num}` },
    { enabled: num === 3 ? true : false }
  );

  if (userDataRes.state === "LOADING") {
    console.log(2, "Loading");
  } else if (userDataRes.state === "ERROR") {
    console.log(2, "Error", userDataRes.error);
  } else {
    console.log(2, userDataRes.state, userDataRes.data);
  }

  return <div>{num}</div>;
};
