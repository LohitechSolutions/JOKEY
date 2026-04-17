import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { appRouter } from "./trpc/app-router";
import { createContext } from "./trpc/create-context";

declare global {
  var __dbConfig: { endpoint: string; ns: string; token: string } | undefined;
}

const app = new Hono();

app.use("*", cors());

app.use("*", async (c, next) => {
  const ep = c.req.header("x-db-endpoint");
  const ns = c.req.header("x-db-ns");
  const tk = c.req.header("x-db-token");
  if (ep && ns && tk) {
    globalThis.__dbConfig = { endpoint: ep, ns: ns, token: tk };
    console.log("[Hono] DB config injected from headers - EP:", ep.substring(0, 30));
  }
  await next();
});

app.use(
  "/trpc/*",
  trpcServer({
    endpoint: "/api/trpc",
    router: appRouter,
    createContext,
  }),
);

app.get("/", (c) => {
  const hasConfig = !!globalThis.__dbConfig;
  return c.json({ ok: true, dbReady: hasConfig, ts: Date.now() });
});

app.get("/db-config", (c) => {
  const ep = c.req.header("x-db-endpoint");
  const ns = c.req.header("x-db-ns");
  const tk = c.req.header("x-db-token");
  if (ep && ns && tk) {
    console.log('[db-config] Returning from headers');
    return c.json({ endpoint: ep, ns: ns, token: tk });
  }
  if (globalThis.__dbConfig?.endpoint && globalThis.__dbConfig?.ns && globalThis.__dbConfig?.token) {
    console.log('[db-config] Returning from globalThis');
    return c.json(globalThis.__dbConfig);
  }

  let envEp = '';
  let envNs = '';
  let envTk = '';
  try {
    // @ts-ignore - Deno runtime
    if (typeof Deno !== 'undefined' && Deno.env) {
      // @ts-ignore
      envEp = Deno.env.get('EXPO_PUBLIC_RORK_DB_ENDPOINT') || '';
      // @ts-ignore
      envNs = Deno.env.get('EXPO_PUBLIC_RORK_DB_NAMESPACE') || '';
      // @ts-ignore
      envTk = Deno.env.get('EXPO_PUBLIC_RORK_DB_TOKEN') || '';
    }
  } catch {}
  if (!envEp && typeof process !== 'undefined' && process.env) {
    envEp = process.env.EXPO_PUBLIC_RORK_DB_ENDPOINT || '';
    envNs = process.env.EXPO_PUBLIC_RORK_DB_NAMESPACE || '';
    envTk = process.env.EXPO_PUBLIC_RORK_DB_TOKEN || '';
  }

  console.log('[db-config] env check - EP:', envEp ? 'SET' : 'EMPTY', 'NS:', envNs ? 'SET' : 'EMPTY', 'TK:', envTk ? 'SET' : 'EMPTY');

  if (envEp && envNs && envTk) {
    globalThis.__dbConfig = { endpoint: envEp, ns: envNs, token: envTk };
    return c.json({ endpoint: envEp, ns: envNs, token: envTk });
  }
  return c.json({ error: "No DB config available", ep: !!envEp, ns: !!envNs, tk: !!envTk }, 404);
});

export default app;
