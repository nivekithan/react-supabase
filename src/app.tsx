import React, { useEffect } from "react";
import { PostgrestClient } from "./postgrest";

export const App = () => {
  useEffect(() => {
    fetchUsersData();
  });

  return <div>Start of Supabase state management</div>;
};

const fetchUsersData = async () => {
  const supabase = new PostgrestClient(
    `${import.meta.env.VITE_DB_URL as string}/rest/v1`,
    {
      apiKey: import.meta.env.VITE_DB_KEY as string,
      Authorization: `Bearer ${import.meta.env.VITE_DB_KEY as string}`,
    }
  );
  const { url, headers, method } = supabase
    .from("users")
    .select("*")
    .lt("id", 3)
    .order("id", { ascending: false })
    .get();

  const result = await fetch(url, {
    method,
    headers: headers,
  });

  if (result.ok) {
    const text = await result.text();
    let data;
    if (text && text !== "") {
      data = JSON.parse(text);
    }
    console.log(data);
  } else {
    console.warn(await result.json());
  }
};
