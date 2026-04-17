import { createTRPCRouter } from "./create-context";
import { authRouter } from "./routes/auth";
import { jokesRouter } from "./routes/jokes";
import { usersRouter } from "./routes/users";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  jokes: jokesRouter,
  users: usersRouter,
});

export type AppRouter = typeof appRouter;
