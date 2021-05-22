import { PostgrestBuilder, Headers } from "./types";
import { PostgrestFilterBuilder } from "./postgrestFilterBuilder";

export class PostgrestQueryBuilder<T> extends PostgrestBuilder<T> {
  constructor(
    url: string,
    { headers = {}, schema }: { headers?: { [key: string]: string }; schema?: string } = {}
  ) {
    super({} as PostgrestBuilder<T>);
    this.url = new URL(url);
    this.schema = schema;
    this.headers = { ...headers };
  }

  /**
   * Performs vertical filtering with SELECT.
   *
   * @param columns  The columns to retrieve, separated by commas.
   * @param head  When set to true, select will void data.
   * @param count  Count algorithm to use to count rows in a table.
   */
  select(
    columns = "*",
    {
      head = false,
      count = null,
    }: {
      head?: boolean;
      count?: null | "exact" | "planned" | "estimated";
    } = {}
  ): PostgrestFilterBuilder<T> {
    this.method = "GET";
    // Remove whitespaces except when quoted
    let quoted = false;
    const cleanedColumns = columns
      .split("")
      .map((c) => {
        if (/\s/.test(c) && !quoted) {
          return "";
        }
        if (c === '"') {
          quoted = !quoted;
        }
        return c;
      })
      .join("");
    this.url.searchParams.set("select", cleanedColumns);
    if (count) {
      this.headers["Prefer"] = `count=${count}`;
    }
    if (head) {
      this.method = "HEAD";
    }
    return new PostgrestFilterBuilder(this);
  }
}
