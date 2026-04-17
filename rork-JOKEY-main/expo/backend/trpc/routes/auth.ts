import * as z from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure, createJWT } from "../create-context";
import { dbQuery, dbQueryFirst, esc, hashPassword, verifyPassword, initDB, extractId } from "../../db";

async function ensureDB() {
  await initDB();
}

export const authRouter = createTRPCRouter({
  register: publicProcedure
    .input(
      z.object({
        username: z.string().min(3),
        email: z.string().email(),
        password: z.string().min(6),
        language: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      await ensureDB();
      const normalizedEmail = input.email.trim().toLowerCase();
      console.log("[auth.register] Attempting:", normalizedEmail);

      const existingEmail = await dbQueryFirst(`SELECT * FROM users WHERE email = '${esc(normalizedEmail)}' LIMIT 1;`);
      if (existingEmail) {
        throw new Error("Un compte avec cet email existe déjà");
      }

      const existingUsername = await dbQueryFirst(`SELECT * FROM users WHERE username = '${esc(input.username)}' LIMIT 1;`);
      if (existingUsername) {
        throw new Error("Ce pseudo est déjà pris");
      }

      const { hash, salt } = await hashPassword(input.password);
      const uid = 'u_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

      const results = await dbQuery(`
        CREATE users SET
          uid = '${esc(uid)}',
          username = '${esc(input.username)}',
          email = '${esc(normalizedEmail)}',
          password_hash = '${esc(hash)}',
          password_salt = '${esc(salt)}',
          display_name = '${esc(input.username)}',
          avatar = 'https://ui-avatars.com/api/?name=${encodeURIComponent(input.username)}&background=1565C0&color=fff&size=150',
          bio = '',
          language = '${esc(input.language || 'FR')}',
          jokes_count = 0,
          total_likes = 0,
          followers_count = 0,
          following_count = 0,
          badges = [],
          is_admin = false,
          is_subscribed = false,
          created_at = time::now();
      `);

      const dbUser = results[0];
      console.log("[auth.register] User created:", uid);

      const verifyUser = await dbQueryFirst(`SELECT uid, email FROM users WHERE uid = '${esc(uid)}' LIMIT 1;`);
      if (!verifyUser) {
        console.error('[auth.register] CRITICAL: User not persisted after CREATE!');
        throw new Error('Erreur lors de la création du compte');
      }
      console.log('[auth.register] User verified in DB:', JSON.stringify(verifyUser));

      const token = await createJWT(uid);

      return {
        token,
        user: {
          id: uid,
          username: input.username,
          displayName: input.username,
          avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(input.username)}&background=1565C0&color=fff&size=150`,
          bio: '',
          language: input.language || 'FR',
          jokesCount: 0,
          totalLikes: 0,
          followersCount: 0,
          followingCount: 0,
          badges: [],
          createdAt: dbUser?.created_at || new Date().toISOString(),
          isFollowing: false,
        },
      };
    }),

  login: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      await ensureDB();
      const normalizedEmail = input.email.trim().toLowerCase();
      console.log("[auth.login] Attempting:", normalizedEmail);

      const dbUser = await dbQueryFirst<any>(`SELECT * FROM users WHERE email = '${esc(normalizedEmail)}' LIMIT 1;`);
      if (!dbUser) {
        console.log("[auth.login] No user found for email:", normalizedEmail);
        throw new Error("Aucun compte trouvé avec cet email");
      }

      console.log("[auth.login] User found:", dbUser.username, "uid:", dbUser.uid);

      if (!dbUser.password_hash || !dbUser.password_salt) {
        console.error("[auth.login] Missing password data for user:", dbUser.uid);
        throw new Error("Erreur de compte. Veuillez réinitialiser votre mot de passe.");
      }

      const valid = await verifyPassword(input.password, dbUser.password_salt, dbUser.password_hash);
      if (!valid) {
        console.log("[auth.login] Invalid password for:", normalizedEmail);
        throw new Error("Mot de passe incorrect");
      }

      const uid = dbUser.uid || extractId(dbUser.id);
      const token = await createJWT(uid);
      console.log("[auth.login] Success for:", dbUser.username);

      return {
        token,
        user: {
          id: uid,
          username: dbUser.username,
          displayName: dbUser.display_name || dbUser.username,
          avatar: dbUser.avatar,
          bio: dbUser.bio || '',
          language: dbUser.language || 'FR',
          jokesCount: dbUser.jokes_count || 0,
          totalLikes: dbUser.total_likes || 0,
          followersCount: dbUser.followers_count || 0,
          followingCount: dbUser.following_count || 0,
          badges: dbUser.badges || [],
          createdAt: dbUser.created_at || new Date().toISOString(),
          isFollowing: false,
        },
      };
    }),

  getMe: protectedProcedure.query(async ({ ctx }) => {
    await ensureDB();
    const dbUser = await dbQueryFirst<any>(`SELECT * FROM users WHERE uid = '${esc(ctx.userId)}' LIMIT 1;`);
    if (!dbUser) {
      throw new Error("Utilisateur non trouvé");
    }

    const uid = dbUser.uid || extractId(dbUser.id);
    return {
      user: {
        id: uid,
        username: dbUser.username,
        displayName: dbUser.display_name || dbUser.username,
        avatar: dbUser.avatar,
        bio: dbUser.bio || '',
        language: dbUser.language || 'FR',
        jokesCount: dbUser.jokes_count || 0,
        totalLikes: dbUser.total_likes || 0,
        followersCount: dbUser.followers_count || 0,
        followingCount: dbUser.following_count || 0,
        badges: dbUser.badges || [],
        createdAt: dbUser.created_at || new Date().toISOString(),
        isFollowing: false,
        isAdmin: dbUser.is_admin || false,
        isSubscribed: dbUser.is_subscribed || false,
      },
    };
  }),

  updateProfile: protectedProcedure
    .input(
      z.object({
        displayName: z.string().optional(),
        bio: z.string().optional(),
        avatar: z.string().optional(),
        language: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ensureDB();
      const sets: string[] = [];
      if (input.displayName !== undefined) sets.push(`display_name = '${esc(input.displayName)}'`);
      if (input.bio !== undefined) sets.push(`bio = '${esc(input.bio)}'`);
      if (input.avatar !== undefined) sets.push(`avatar = '${esc(input.avatar)}'`);
      if (input.language !== undefined) sets.push(`language = '${esc(input.language)}'`);

      if (sets.length > 0) {
        await dbQuery(`UPDATE users SET ${sets.join(', ')} WHERE uid = '${esc(ctx.userId)}';`);
      }

      return { success: true };
    }),

  deleteAccount: protectedProcedure.mutation(async ({ ctx }) => {
    await ensureDB();
    console.log("[auth.deleteAccount] Deleting:", ctx.userId);
    await dbQuery(`DELETE FROM reactions WHERE user_id = '${esc(ctx.userId)}';`);
    await dbQuery(`DELETE FROM ratings WHERE user_id = '${esc(ctx.userId)}';`);
    await dbQuery(`DELETE FROM comments WHERE user_id = '${esc(ctx.userId)}';`);
    await dbQuery(`DELETE FROM follows WHERE follower_id = '${esc(ctx.userId)}' OR following_id = '${esc(ctx.userId)}';`);
    await dbQuery(`DELETE FROM jokes WHERE user_id = '${esc(ctx.userId)}';`);
    await dbQuery(`DELETE FROM users WHERE uid = '${esc(ctx.userId)}';`);
    return { success: true };
  }),

  requestPasswordReset: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      await ensureDB();
      const normalizedEmail = input.email.trim().toLowerCase();
      const user = await dbQueryFirst<any>(`SELECT * FROM users WHERE email = '${esc(normalizedEmail)}' LIMIT 1;`);
      if (!user) {
        console.log("[auth.requestPasswordReset] No user found for:", normalizedEmail);
        return { success: true, code: null };
      }

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const uid = user.uid || extractId(user.id);

      await dbQuery(`DELETE FROM reset_codes WHERE user_id = '${esc(uid)}';`);
      await dbQuery(`
        CREATE reset_codes SET
          user_id = '${esc(uid)}',
          code = '${code}',
          expires_at = time::now() + 15m;
      `);

      console.log("[auth.requestPasswordReset] Code generated for:", input.email, "Code:", code);

      return { success: true, code };
    }),

  confirmPasswordReset: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        code: z.string().length(6),
        newPassword: z.string().min(6),
      })
    )
    .mutation(async ({ input }) => {
      await ensureDB();
      const normalizedEmail = input.email.trim().toLowerCase();
      const user = await dbQueryFirst<any>(`SELECT * FROM users WHERE email = '${esc(normalizedEmail)}' LIMIT 1;`);
      if (!user) {
        throw new Error("Email non trouvé");
      }

      const uid = user.uid || extractId(user.id);
      const resetCode = await dbQueryFirst<any>(`
        SELECT * FROM reset_codes WHERE user_id = '${esc(uid)}' AND code = '${esc(input.code)}' LIMIT 1;
      `);

      if (!resetCode) {
        throw new Error("Code invalide ou expiré");
      }

      const { hash, salt } = await hashPassword(input.newPassword);
      await dbQuery(`UPDATE users SET password_hash = '${esc(hash)}', password_salt = '${esc(salt)}' WHERE uid = '${esc(uid)}';`);
      await dbQuery(`DELETE FROM reset_codes WHERE user_id = '${esc(uid)}';`);

      console.log("[auth.confirmPasswordReset] Password reset for:", input.email);
      return { success: true };
    }),
});
