import { rest } from "msw";
import { setupServer } from "msw/node";
import { url } from "./utils";

export const successResult = "success";
export const errorResult = "error";

const handlers = [
  rest.get(new RegExp(`${url.success}/rest/v1`), (req, res, ctx) => {
    return res(ctx.text(JSON.stringify(successResult)), ctx.status(200));
  }),

  rest.get(new RegExp(`${url.error}/rest/v1`), (req, res, ctx) => {
    return res(ctx.json(errorResult), ctx.status(500, "error"));
  }),
];

export const server = setupServer(...handlers);
