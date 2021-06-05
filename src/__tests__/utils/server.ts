import { PostgrestError } from "@src/react-supabase/useDb";
import { rest } from "msw";
import { setupServer } from "msw/node";
import { successClient, url } from "./utils";

export const authUser = {
  access_token: "12345",
  token_type: "bearer",
  expires_in: 3600,
  refresh_token: "12345",
  user: {
    id: "12345",
    aud: "authenticated",
    role: "authenticated",
    email: "example@gmail.com",
    confirmed_at: "2021-05-21T05:08:14.593094Z",
    last_sign_in_at: "2021-05-22T04:17:37.291225252Z",
    app_metadata: { provider: "email" },
    user_metadata: {},
    created_at: "2021-05-21T05:08:14.590132Z",
    updated_at: "2021-05-22T04:17:37.292025Z",
  },
};

export const authUserError = {
  error: "invalid_grant",
  error_description: "Invalid email or password",
};

const authHandlers = [
  rest.post(new RegExp(`${url.success}/auth/v1/token`), (req, res, ctx) => {
    ServerData.add("sigIn");
    return res(ctx.json(authUser), ctx.status(200, "The user is logged in"));
  }),

  rest.post(new RegExp(`${url.error}/auth/v1/token`), (req, res, ctx) => {
    ServerData.add("signInError");
    return res(ctx.json(authUserError), ctx.status(400));
  }),

  rest.post(new RegExp(`${url.success}/auth/v1/logout`), async (req, res, ctx) => {
    ServerData.add("logout");
    return res(ctx.status(204));
  }),
];

export const successResult = ["success"];
export const errorResult: PostgrestError = {
  code: "100",
  details: "Something is wrong",
  hint: "No hint",
  message: "This is error",
};

let successOnTime = 0;
let times = 1;
let dynamicResult: unknown[] = ["success"];

const restHandlers = [
  rest.get(new RegExp(`${url.success}/rest/v1`), (req, res, ctx) => {
    ServerData.add("SUCCESS");
    return res(ctx.text(JSON.stringify(successResult)), ctx.status(200, "The request is success"));
  }),

  rest.post(new RegExp(`${url.success}/rest/v1`), (req, res, ctx) => {
    ServerData.add("SUCCESS");
    return res(ctx.text(JSON.stringify(successResult)), ctx.status(200, "The request is success"));
  }),

  rest.get(new RegExp(`${url.error}/rest/v1`), (req, res, ctx) => {
    ServerData.add("ERROR");
    return res(ctx.json(errorResult), ctx.status(500, "The request is not success"));
  }),

  rest.post(new RegExp(`${url.error}/rest/v1`), (req, res, ctx) => {
    ServerData.add("SUCCESS");
    return res(ctx.json(errorResult), ctx.status(500, "The request is not success"));
  }),

  rest.get(new RegExp(`${url.errorToSuccess}/rest/v1`), (req, res, ctx) => {
    ServerData.add("ERROR_TO_SUCCESS");
    if (times === successOnTime) {
      return res(
        ctx.text(JSON.stringify(successResult)),
        ctx.status(200, "The request is success")
      );
    } else {
      times++;
      return res(ctx.json(errorResult), ctx.status(500, "The request is not success"));
    }
  }),

  rest.get(new RegExp(`${url.dynamicSuccess}/rest/v1`), (req, res, ctx) => {
    ServerData.add("DYNAMIC_SUCCESS");

    return res(ctx.text(JSON.stringify(dynamicResult)), ctx.status(200, "The request is success"));
  }),
];

export const server = setupServer(...restHandlers, ...authHandlers);

type ServerDataInfo = {
  type:
    | "ERROR"
    | "SUCCESS"
    | "ERROR_TO_SUCCESS"
    | "DYNAMIC_SUCCESS"
    | "sigIn"
    | "signInError"
    | "logout";
};

export class ServerData {
  static times = 0;
  static info: ServerDataInfo[] = [];

  static add(type: ServerDataInfo["type"]) {
    ServerData.info.push({
      type,
    });
    ServerData.times++;
  }

  static reset() {
    ServerData.times = 0;
    ServerData.info = [];
    times = 1;
    successOnTime = 0;
    dynamicResult = ["success"];
  }
}

export const setSuccessOnTime = (times: number) => {
  successOnTime = times;
};

export const setDynamicResult = (result: unknown[]) => {
  dynamicResult = result;
};
