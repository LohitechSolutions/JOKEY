import * as z from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "../create-context";
import { dbQuery, dbQueryFirst, esc, initDB, extractId } from "../../db";

async function ensureDB() {
  await initDB();
}

function mapUser(u: any): any {
  const uid = u.uid || extractId(u.id);
  return {
    id: uid,
    username: u.username,
    displayName: u.display_name || u.username,
    avatar: u.avatar,
    bio: u.bio || '',
    language: u.language || 'FR',
    jokesCount: u.jokes_count || 0,
    totalLikes: u.total_likes || 0,
    followersCount: u.followers_count || 0,
    followingCount: u.following_count || 0,
    isFollowing: false,
    badges: u.badges || [],
    createdAt: u.created_at || '',
  };
}

export const usersRouter = createTRPCRouter({
  getById: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input, ctx }) => {
      await ensureDB();
      const user = await dbQueryFirst<any>(`SELECT * FROM users WHERE uid = '${esc(input.userId)}' LIMIT 1;`);
      if (!user) return { user: null };

      const mapped = mapUser(user);

      if (ctx.userId) {
        const follow = await dbQueryFirst<any>(`
          SELECT * FROM follows WHERE follower_id = '${esc(ctx.userId)}' AND following_id = '${esc(input.userId)}' LIMIT 1;
        `);
        mapped.isFollowing = !!follow;
      }

      return { user: mapped };
    }),

  follow: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ensureDB();
      const existing = await dbQueryFirst<any>(`
        SELECT * FROM follows WHERE follower_id = '${esc(ctx.userId)}' AND following_id = '${esc(input.userId)}' LIMIT 1;
      `);

      if (existing) {
        await dbQuery(`DELETE FROM follows WHERE follower_id = '${esc(ctx.userId)}' AND following_id = '${esc(input.userId)}';`);
        await dbQuery(`UPDATE users SET followers_count -= 1 WHERE uid = '${esc(input.userId)}' AND followers_count > 0;`);
        await dbQuery(`UPDATE users SET following_count -= 1 WHERE uid = '${esc(ctx.userId)}' AND following_count > 0;`);
        return { following: false };
      } else {
        await dbQuery(`
          CREATE follows SET
            follower_id = '${esc(ctx.userId)}',
            following_id = '${esc(input.userId)}',
            created_at = time::now();
        `);
        await dbQuery(`UPDATE users SET followers_count += 1 WHERE uid = '${esc(input.userId)}';`);
        await dbQuery(`UPDATE users SET following_count += 1 WHERE uid = '${esc(ctx.userId)}';`);
        return { following: true };
      }
    }),

  getFollowing: protectedProcedure.query(async ({ ctx }) => {
    await ensureDB();
    const follows = await dbQuery<any>(`SELECT following_id FROM follows WHERE follower_id = '${esc(ctx.userId)}';`);
    return { followingIds: follows.map((f: any) => f.following_id) };
  }),

  search: publicProcedure
    .input(z.object({ query: z.string() }))
    .query(async ({ input }) => {
      await ensureDB();
      const q = esc(input.query.toLowerCase());
      const users = await dbQuery<any>(`
        SELECT * FROM users WHERE 
          string::lowercase(username) CONTAINS '${q}' 
          OR string::lowercase(display_name) CONTAINS '${q}'
        LIMIT 20;
      `);
      return { users: users.map(mapUser) };
    }),

  ranking: publicProcedure
    .input(z.object({ limit: z.number().optional() }).optional())
    .query(async ({ input }) => {
      await ensureDB();
      const limit = input?.limit || 100;
      const users = await dbQuery<any>(`SELECT * FROM users ORDER BY total_likes DESC LIMIT ${limit};`);
      return { users: users.map(mapUser) };
    }),
});
