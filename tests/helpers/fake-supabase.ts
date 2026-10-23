import type { ServerSupabaseClient } from "@/lib/supabase/server";

export type Call = { method: string; args: unknown[] };
export type Query = { table: string; calls: Call[] };
export type Result = { data?: unknown; error?: unknown; count?: number | null };

type Handlers = {
  from?: (query: Query) => Result | undefined;
  rpc?: (fn: string, args: Record<string, unknown>) => Result | undefined;
};

/**
 * Minimal stand-in for the Supabase query builder. Every chained call is
 * recorded so tests can assert, e.g., that a query was filtered by owner_id.
 */
export function createFakeSupabase(handlers: Handlers = {}) {
  const queries: Query[] = [];
  const rpcs: { fn: string; args: Record<string, unknown> }[] = [];

  function builder(query: Query): unknown {
    const target = {
      then(resolve: (value: Result) => unknown, reject?: (reason: unknown) => unknown) {
        try {
          const result = handlers.from?.(query) ?? { data: null, error: null };
          return Promise.resolve({ data: null, error: null, count: null, ...result }).then(resolve, reject);
        } catch (error) {
          return Promise.reject(error).then(resolve, reject);
        }
      },
    };
    return new Proxy(target, {
      get(obj, prop) {
        if (prop === "then") return obj.then;
        return (...args: unknown[]) => {
          query.calls.push({ method: String(prop), args });
          return builder(query);
        };
      },
    });
  }

  const client = {
    from(table: string) {
      const query: Query = { table, calls: [] };
      queries.push(query);
      return builder(query);
    },
    async rpc(fn: string, args: Record<string, unknown>) {
      rpcs.push({ fn, args });
      return { data: null, error: null, ...(handlers.rpc?.(fn, args) ?? {}) };
    },
    auth: {
      getClaims: async () => ({ data: null, error: null }),
      signOut: async () => ({ error: null }),
    },
  };

  return { client: client as unknown as ServerSupabaseClient, queries, rpcs };
}

/** Helpers for asserting on recorded calls. */
export function hasCall(query: Query, method: string, ...args: unknown[]) {
  return query.calls.some(
    (call) => call.method === method && args.every((arg, i) => JSON.stringify(call.args[i]) === JSON.stringify(arg)),
  );
}

export function firstOp(query: Query) {
  return query.calls.find((c) => ["select", "insert", "update", "delete", "upsert"].includes(c.method));
}
