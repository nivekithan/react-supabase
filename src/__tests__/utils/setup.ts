import { DbCache } from "@src/react-supabase/dbCache";
import { Key } from "@src/react-supabase/key";
import { server, ServerData } from "./server";
import { resetClients } from "./utils";

beforeAll(() => server.listen());

afterEach(() => {
  DbCache.reset();
  Key.reset();
  ServerData.reset();
  server.resetHandlers();
  jest.useRealTimers();
  resetClients();
});

afterAll(() => server.close());
