import { rest } from "msw";
import { setupServer } from "msw/node";
import { url } from "./utils";

export const successResult = "success";
export const errorResult = "error";
let successOnTime = 0;
let times = 1;

const handlers = [
  rest.get(new RegExp(`${url.success}/rest/v1`), (req, res, ctx) => {
    ServerData.add("SUCCESS");
    return res(ctx.text(JSON.stringify(successResult)), ctx.status(200));
  }),

  rest.get(new RegExp(`${url.error}/rest/v1`), (req, res, ctx) => {
    ServerData.add("ERROR");
    return res(ctx.json(errorResult), ctx.status(500, "error"));
  }),

  rest.get(new RegExp(`${url.errorToSuccess}/rest/v1`), (req, res, ctx) => {
    ServerData.add("ERROR_TO_SUCCESS");
    if (times === successOnTime) {
      return res(ctx.text(JSON.stringify(successResult)), ctx.status(200));
    } else {
      times++;
      return res(ctx.json(errorResult), ctx.status(500, "error"));
    }
  }),
];

export const server = setupServer(...handlers);

type ServerDataInfo = {
  type: "ERROR" | "SUCCESS" | "ERROR_TO_SUCCESS";
};

export class ServerData {
  static times = 0;
  static info: ServerDataInfo[] = [];

  static add(type: "ERROR" | "SUCCESS" | "ERROR_TO_SUCCESS") {
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
  }
}

export const setSuccessOnTime = (times: number) => {
  successOnTime = times;
};
