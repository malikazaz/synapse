export interface Env {
  DB: D1Database; OAUTH_KV: KVNamespace; ASSETS: Fetcher;
  APP_ORIGIN: string; OWNER_EMAIL: string; SPREADSHEET_ID: string;
  GOOGLE_CLIENT_ID?: string; GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_SERVICE_ACCOUNT?: string; SHEETS_ENABLED: string;
  OAUTH_PROVIDER?: any;
}
export interface Actor { id: string; email: string; }
export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) { super(message); }
}
export const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
export function assert(value: unknown, message: string, status = 400): asserts value { if (!value) throw new HttpError(status, message); }
export const now = () => new Date().toISOString();
