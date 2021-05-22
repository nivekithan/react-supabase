import { GoTrueClient, User } from "@supabase/gotrue-js";
import { PostgrestQueryBuilder } from "../postgrest";

export type SupabaseClientOptions = {
  /**
   * The Postgres schema which your tables belong to. Must be on the list of exposed schemas in Supabase. Defaults to 'public'.
   */
  schema?: string;
  /**
   * Optional headers for initializing the client.
   */
  headers?: { [key: string]: string };
  /**
   * Automatically refreshes the token for logged in users.
   */
  autoRefreshToken?: boolean;
  /**
   * Whether to persist a logged in session to storage.
   */
  persistSession?: boolean;
  /**
   * Detect a session from the URL. Used for OAuth login callbacks.
   */
  detectSessionInUrl?: boolean;
  /**
   * A storage provider. Used to store the logged in session.
   */
  localStorage?: Storage;
};

const DEFAULT_OPTIONS = {
  schema: "public",
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: true,
  localStorage: globalThis.localStorage,
  headers: {},
};

export class SupabaseAuthClient extends GoTrueClient {
  constructor(options: {
    url?: string;
    headers?: { [key: string]: string };
    detectSessionInUrl?: boolean;
    autoRefreshToken?: boolean;
    persistSession?: boolean;
    localStorage?: Storage;
  }) {
    super(options);
  }
}

export class SupabaseClient {
  auth: SupabaseAuthClient;
  protected schema: string;
  protected restUrl: string;
  protected authUrl: string;

  constructor(
    protected supabaseUrl: string,
    protected supabaseKey: string,
    options?: SupabaseClientOptions
  ) {
    const settings = { ...DEFAULT_OPTIONS, ...options };

    this.restUrl = `${supabaseUrl}/rest/v1`;
    this.authUrl = `${supabaseUrl}/auth/v1`;
    this.supabaseKey = supabaseKey;
    this.schema = settings.schema;

    this.auth = this._initSupabaseAuthClient(settings);
  }

  private _initSupabaseAuthClient({
    autoRefreshToken,
    persistSession,
    detectSessionInUrl,
    localStorage,
  }: SupabaseClientOptions) {
    return new SupabaseAuthClient({
      url: this.authUrl,
      headers: {
        Authorization: `Bearer ${this.supabaseKey}`,
        apikey: `${this.supabaseKey}`,
      },
      autoRefreshToken,
      persistSession,
      detectSessionInUrl,
      localStorage,
    });
  }

  from<T = any>(table: string) {
    const url = `${this.restUrl}/${table}`;
    return new PostgrestQueryBuilder<T>(url, {
      headers: this._getAuthHeaders(),
      schema: this.schema,
    });
  }

  private _getAuthHeaders(): { [key: string]: string } {
    const headers: { [key: string]: string } = {};
    const authBearer = this.auth.session()?.access_token ?? this.supabaseKey;
    headers["apikey"] = this.supabaseKey;
    headers["Authorization"] = `Bearer ${authBearer}`;
    return headers;
  }
}

export type { User };
