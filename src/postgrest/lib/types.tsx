export type Headers = {
  [key: string]: string;
};

export type SupabaseBuild = {
  method: "GET" | "HEAD" | "POST" | "PATCH" | "DELETE";
  url: URL;
  headers: Headers;
};

export abstract class PostgrestBuilder<T> {
  protected method!: "GET" | "HEAD" | "POST" | "PATCH" | "DELETE";
  protected url!: URL;
  protected headers!: Headers;
  protected schema = "public";

  constructor(builder: PostgrestBuilder<T>) {
    Object.assign(this, builder);
  }

  get(): SupabaseBuild {
    if (typeof this.schema === "undefined") {
      // skip
    } else if (["GET", "HEAD"].includes(this.method)) {
      this.headers["Accept-Profile"] = this.schema;
    } else {
      this.headers["Content-Profile"] = this.schema;
    }
    if (this.method !== "GET" && this.method !== "HEAD") {
      this.headers["Content-Type"] = "application/json";
    }

    return {
      method: this.method,
      url: this.url,
      headers: this.headers,
    };
  }
}
