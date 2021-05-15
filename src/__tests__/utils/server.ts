import { PostgrestError } from "@src/react-supabase/useDb";
import { rest } from "msw";
import { setupServer } from "msw/node";
import { url } from "./utils";

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

const handlers = [
  rest.get(new RegExp(`${url.success}/rest/v1`), (req, res, ctx) => {
    ServerData.add("SUCCESS");
    return res(ctx.text(JSON.stringify(successResult)), ctx.status(200, "The request is success"));
  }),

  rest.get(new RegExp(`${url.error}/rest/v1`), (req, res, ctx) => {
    ServerData.add("ERROR");
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

export const server = setupServer(...handlers);

type ServerDataInfo = {
  type: "ERROR" | "SUCCESS" | "ERROR_TO_SUCCESS" | "DYNAMIC_SUCCESS";
};

export class ServerData {
  static times = 0;
  static info: ServerDataInfo[] = [];

  static add(type: "ERROR" | "SUCCESS" | "ERROR_TO_SUCCESS" | "DYNAMIC_SUCCESS") {
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
