import { Headers } from "./lib/types";
import { PostgrestQueryBuilder } from "./lib/postgrestQueryBuilder";

export  class PostgrestClient {
  url: string;
  headers: Headers;
  schema = "public";

  /**
   * Creates a PostgREST client.
   *
   * @param url  URL of the PostgREST endpoint.
   * @param headers  Custom headers.
   * @param schema  Postgres schema to switch to.
   */
  constructor(url: string, headers: Headers) {
    this.url = url;
    this.headers = headers;
  }

  /**
   * Perform a table operation.
   *
   * @param table  The table name to operate on.
   */
  from<T = any>(table: string): PostgrestQueryBuilder<T> {
    const url = `${this.url}/${table}`;
    return new PostgrestQueryBuilder<T>(url, this.headers);
  }
}
