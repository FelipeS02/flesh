import type { SupabaseClient } from "@supabase/supabase-js";

type Reply = { data?: unknown; error?: { code?: string; message?: string } | null };

export type RecordedCall = { table: string; ops: [method: string, ...args: unknown[]][] };

/**
 * A scripted stand-in for the slice of the Supabase query builder the
 * repositories use. Every `from()` is one call; the builder records each chained
 * method and resolves with the next scripted reply when the chain is awaited or
 * ends in `single`/`maybeSingle`. Asserting on `calls` pins what was written
 * without reimplementing PostgREST.
 */
export function createFakeSupabase(replies: Reply[]) {
  const calls: RecordedCall[] = [];
  const queue = [...replies];

  function next(): { data: unknown; error: Reply["error"] } {
    const reply = queue.shift();
    if (!reply) throw new Error("fake supabase: no scripted reply left");
    return { data: reply.data ?? null, error: reply.error ?? null };
  }

  const client = {
    from(table: string) {
      const call: RecordedCall = { table, ops: [] };
      calls.push(call);
      const builder: Record<string, unknown> = {};
      for (const method of ["select", "insert", "update", "eq", "is", "in", "order", "range", "limit"]) {
        builder[method] = (...args: unknown[]) => {
          call.ops.push([method, ...args]);
          return builder;
        };
      }
      for (const method of ["single", "maybeSingle"]) {
        builder[method] = () => {
          call.ops.push([method]);
          return Promise.resolve(next());
        };
      }
      builder.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve(next()).then(resolve, reject);
      return builder;
    },
  };

  return { client: client as unknown as SupabaseClient, calls, remaining: () => queue.length };
}
