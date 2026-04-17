import { initTRPC, TRPCError } from "@trpc/server";
import { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import superjson from "superjson";
import { sign, verify } from "hono/jwt";

declare global {
  var __dbConfig: { endpoint: string; ns: string; token: string } | undefined;
}

const FALLBACK_SECRET = 'joky-production-secret-2026';

function getJWTSecret(): string {
  return globalThis.__dbConfig?.token || FALLBACK_SECRET;
}

export const createContext = async (opts: FetchCreateContextFnOptions) => {
  let userId: string | null = null;

  const dbEndpoint = opts.req.headers.get('x-db-endpoint');
  const dbNs = opts.req.headers.get('x-db-ns');
  const dbToken = opts.req.headers.get('x-db-token');

  if (dbEndpoint && dbNs && dbToken) {
    globalThis.__dbConfig = { endpoint: dbEndpoint, ns: dbNs, token: dbToken };
    console.log('[Context] DB config injected from client headers');
  }

  const authHeader = opts.req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const payload = await verify(token, getJWTSecret(), 'HS256');
      userId = payload.sub as string;
      console.log('[Context] Authenticated user:', userId);
    } catch (err) {
      console.log('[Context] Invalid token:', err);
    }
  }

  return {
    req: opts.req,
    userId,
  };
};

export type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
    });
  }
  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId,
    },
  });
});

export async function createJWT(userId: string): Promise<string> {
  const payload = {
    sub: userId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
  };
  return sign(payload, getJWTSecret(), 'HS256');
}
