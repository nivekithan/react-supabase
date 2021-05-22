import { Cache } from "@src/react-supabase/cache";
import { Key } from "@src/react-supabase/key";
import { server, ServerData } from "./server";
import { resetClients } from "./utils";

beforeAll(() => server.listen());

afterEach(() => {
  Cache.reset();
  Key.reset();
  ServerData.reset();
  server.resetHandlers();
  jest.useRealTimers();
  resetClients();
});

afterAll(() => server.close());
