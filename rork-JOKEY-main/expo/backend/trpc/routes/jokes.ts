import * as z from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "../create-context";
import { dbQuery, dbQueryFirst, esc, initDB, extractId } from "../../db";

async function ensureDB() {
  await initDB();
}

function mapJoke(j: any): any {
  const uid = j.user_id || '';
  return {
    id: j.joke_id || extractId(j.id),
    userId: uid,
    user: j._user || {
      id: uid,
      username: j.user_username || 'unknown',
      displayName: j.user_display_name || j.user_username || 'Unknown',
      avatar: j.user_avatar || 'https://ui-avatars.com/api/?name=U&background=1565C0&color=fff&size=150',
      bio: '',
      language: 'FR',
      jokesCount: 0,
      totalLikes: 0,
      followersCount: 0,
      followingCount: 0,
      isFollowing: false,
      badges: [],
      createdAt: '',
    },
    title: j.title || '',
    audioUri: j.audio_uri || '',
    duration: j.duration || 0,
    category: j.category || 'courtes',
    tags: j.tags || [],
    language: j.language || 'FR',
    level: j.level || 'all',
    allowComments: j.allow_comments !== false,
    reactions: {
      '😂': j.reactions_laugh || 0,
      '🤣': j.reactions_rofl || 0,
      '😭': j.reactions_cry || 0,
      '💀': j.reactions_skull || 0,
      '👏': j.reactions_clap || 0,
      '❤️': j.reactions_heart || 0,
    },
    commentsCount: j.comments_count || 0,
    createdAt: j.created_at || new Date().toISOString(),
    isTrending: j.is_trending || false,
    isJokeOfDay: j.is_joke_of_day || false,
    averageRating: j.average_rating || 0,
    totalRatings: j.total_ratings || 0,
  };
}

async function enrichJokesWithUsers(jokes: any[]): Promise<any[]> {
  if (jokes.length === 0) return [];

  const userIds = Array.from(new Set(jokes.map(j => j.user_id).filter(Boolean)));
  if (userIds.length === 0) return jokes.map(mapJoke);

  const whereClause = userIds.map(id => `uid = '${esc(id)}'`).join(' OR ');
  let users: any[] = [];
  try {
    users = await dbQuery(`SELECT * FROM users WHERE ${whereClause};`);
  } catch (err) {
    console.error('[jokes] Failed to fetch users:', err);
  }

  const userMap = new Map<string, any>();
  for (const u of users) {
    const uid = u.uid || extractId(u.id);
    userMap.set(uid, {
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
    });
  }

  return jokes.map(j => {
    const mapped = mapJoke(j);
    const user = userMap.get(j.user_id);
    if (user) mapped.user = user;
    return mapped;
  });
}

export const jokesRouter = createTRPCRouter({
  list: publicProcedure
    .input(
      z.object({
        tab: z.enum(['jour', 'nouveautes', 'tendances', 'abonnements']).optional(),
        category: z.string().optional(),
        userId: z.string().optional(),
        search: z.string().optional(),
        limit: z.number().optional(),
      }).optional()
    )
    .query(async ({ input, ctx }) => {
      await ensureDB();

      let sql = 'SELECT * FROM jokes';
      const conditions: string[] = [];

      if (input?.category) {
        conditions.push(`category = '${esc(input.category)}'`);
      }
      if (input?.userId) {
        conditions.push(`user_id = '${esc(input.userId)}'`);
      }
      if (input?.search) {
        conditions.push(`(title CONTAINS '${esc(input.search)}' OR string::lowercase(title) CONTAINS '${esc(input.search.toLowerCase())}')`);
      }

      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }

      if (input?.tab === 'jour') {
        sql += conditions.length > 0 ? ' AND' : ' WHERE';
        sql += ' (is_joke_of_day = true OR is_trending = true)';
      }

      sql += ' ORDER BY created_at DESC';

      if (input?.limit) {
        sql += ` LIMIT ${input.limit}`;
      }

      sql += ';';

      let jokes: any[] = [];
      try {
        jokes = await dbQuery(sql);
      } catch (err) {
        console.error('[jokes.list] Query error:', err);
        return { jokes: [] };
      }

      const enriched = await enrichJokesWithUsers(jokes);

      if (input?.tab === 'tendances') {
        enriched.sort((a: any, b: any) => {
          const aTotal = Object.values(a.reactions as Record<string, number>).reduce((s: number, c: number) => s + c, 0);
          const bTotal = Object.values(b.reactions as Record<string, number>).reduce((s: number, c: number) => s + c, 0);
          return bTotal - aTotal;
        });
      }

      if (input?.tab === 'abonnements' && ctx.userId) {
        try {
          const follows = await dbQuery(`SELECT following_id FROM follows WHERE follower_id = '${esc(ctx.userId)}';`);
          const followingIds = new Set(follows.map((f: any) => f.following_id));
          return { jokes: enriched.filter((j: any) => followingIds.has(j.userId)) };
        } catch {
          return { jokes: [] };
        }
      }

      return { jokes: enriched };
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      await ensureDB();
      const joke = await dbQueryFirst<any>(`SELECT * FROM jokes WHERE joke_id = '${esc(input.id)}' LIMIT 1;`);
      if (!joke) return { joke: null };

      const enriched = await enrichJokesWithUsers([joke]);
      return { joke: enriched[0] || null };
    }),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string(),
        audioUri: z.string(),
        duration: z.number(),
        category: z.string(),
        tags: z.array(z.string()).optional(),
        language: z.string().optional(),
        level: z.enum(['all', 'adult']).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ensureDB();
      const jokeId = 'j_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);

      await dbQuery(`
        CREATE jokes SET
          joke_id = '${esc(jokeId)}',
          user_id = '${esc(ctx.userId)}',
          title = '${esc(input.title)}',
          audio_uri = '${esc(input.audioUri)}',
          duration = ${input.duration},
          category = '${esc(input.category)}',
          tags = ${JSON.stringify(input.tags || [])},
          language = '${esc(input.language || 'FR')}',
          level = '${esc(input.level || 'all')}',
          allow_comments = true,
          reactions_laugh = 0,
          reactions_rofl = 0,
          reactions_cry = 0,
          reactions_skull = 0,
          reactions_clap = 0,
          reactions_heart = 0,
          comments_count = 0,
          is_trending = false,
          is_joke_of_day = false,
          average_rating = 0,
          total_ratings = 0,
          created_at = time::now();
      `);

      await dbQuery(`UPDATE users SET jokes_count += 1 WHERE uid = '${esc(ctx.userId)}';`);

      console.log("[jokes.create] Created:", jokeId);
      return { jokeId };
    }),

  react: protectedProcedure
    .input(
      z.object({
        jokeId: z.string(),
        emoji: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ensureDB();
      const existing = await dbQueryFirst<any>(`
        SELECT * FROM reactions WHERE user_id = '${esc(ctx.userId)}' AND joke_id = '${esc(input.jokeId)}' AND emoji = '${esc(input.emoji)}' LIMIT 1;
      `);

      const emojiFieldMap: Record<string, string> = {
        '😂': 'reactions_laugh',
        '🤣': 'reactions_rofl',
        '😭': 'reactions_cry',
        '💀': 'reactions_skull',
        '👏': 'reactions_clap',
        '❤️': 'reactions_heart',
      };

      const field = emojiFieldMap[input.emoji];
      if (!field) throw new Error('Invalid emoji');

      if (existing) {
        await dbQuery(`DELETE FROM reactions WHERE user_id = '${esc(ctx.userId)}' AND joke_id = '${esc(input.jokeId)}' AND emoji = '${esc(input.emoji)}';`);
        await dbQuery(`UPDATE jokes SET ${field} -= 1 WHERE joke_id = '${esc(input.jokeId)}' AND ${field} > 0;`);
        return { added: false };
      } else {
        await dbQuery(`
          CREATE reactions SET
            user_id = '${esc(ctx.userId)}',
            joke_id = '${esc(input.jokeId)}',
            emoji = '${esc(input.emoji)}',
            created_at = time::now();
        `);
        await dbQuery(`UPDATE jokes SET ${field} += 1 WHERE joke_id = '${esc(input.jokeId)}';`);
        return { added: true };
      }
    }),

  rate: protectedProcedure
    .input(
      z.object({
        jokeId: z.string(),
        rating: z.number().min(1).max(5),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ensureDB();
      const existing = await dbQueryFirst<any>(`
        SELECT * FROM ratings WHERE user_id = '${esc(ctx.userId)}' AND joke_id = '${esc(input.jokeId)}' LIMIT 1;
      `);

      if (existing) {
        await dbQuery(`UPDATE ratings SET rating = ${input.rating} WHERE user_id = '${esc(ctx.userId)}' AND joke_id = '${esc(input.jokeId)}';`);
      } else {
        await dbQuery(`
          CREATE ratings SET
            user_id = '${esc(ctx.userId)}',
            joke_id = '${esc(input.jokeId)}',
            rating = ${input.rating},
            created_at = time::now();
        `);
      }

      const allRatings = await dbQuery<any>(`SELECT rating FROM ratings WHERE joke_id = '${esc(input.jokeId)}';`);
      const total = allRatings.length;
      const avg = total > 0 ? allRatings.reduce((s: number, r: any) => s + (r.rating || 0), 0) / total : 0;
      const avgRounded = Math.round(avg * 10) / 10;

      await dbQuery(`UPDATE jokes SET average_rating = ${avgRounded}, total_ratings = ${total} WHERE joke_id = '${esc(input.jokeId)}';`);

      return { averageRating: avgRounded, totalRatings: total };
    }),

  getMyReactions: protectedProcedure
    .input(z.object({ jokeIds: z.array(z.string()) }))
    .query(async ({ ctx, input }) => {
      await ensureDB();
      if (input.jokeIds.length === 0) return { reactions: {} };

      const where = input.jokeIds.map(id => `joke_id = '${esc(id)}'`).join(' OR ');
      const results = await dbQuery<any>(`SELECT joke_id, emoji FROM reactions WHERE user_id = '${esc(ctx.userId)}' AND (${where});`);

      const reactions: Record<string, string[]> = {};
      for (const r of results) {
        if (!reactions[r.joke_id]) reactions[r.joke_id] = [];
        reactions[r.joke_id].push(r.emoji);
      }

      return { reactions };
    }),

  getMyRatings: protectedProcedure
    .input(z.object({ jokeIds: z.array(z.string()) }))
    .query(async ({ ctx, input }) => {
      await ensureDB();
      if (input.jokeIds.length === 0) return { ratings: {} };

      const where = input.jokeIds.map(id => `joke_id = '${esc(id)}'`).join(' OR ');
      const results = await dbQuery<any>(`SELECT joke_id, rating FROM ratings WHERE user_id = '${esc(ctx.userId)}' AND (${where});`);

      const ratings: Record<string, number> = {};
      for (const r of results) {
        ratings[r.joke_id] = r.rating;
      }

      return { ratings };
    }),

  getComments: publicProcedure
    .input(z.object({ jokeId: z.string() }))
    .query(async ({ input }) => {
      await ensureDB();
      const comments = await dbQuery<any>(`SELECT * FROM comments WHERE joke_id = '${esc(input.jokeId)}' ORDER BY created_at DESC;`);

      const userIds = Array.from(new Set(comments.map((c: any) => c.user_id).filter(Boolean)));
      let userMap = new Map<string, any>();

      if (userIds.length > 0) {
        const whereClause = userIds.map(id => `uid = '${esc(id)}'`).join(' OR ');
        const users = await dbQuery<any>(`SELECT * FROM users WHERE ${whereClause};`);
        for (const u of users) {
          const uid = u.uid || extractId(u.id);
          userMap.set(uid, {
            id: uid,
            username: u.username,
            displayName: u.display_name || u.username,
            avatar: u.avatar,
            bio: u.bio || '',
            language: u.language || 'FR',
            jokesCount: 0,
            totalLikes: 0,
            followersCount: 0,
            followingCount: 0,
            isFollowing: false,
            badges: [],
            createdAt: u.created_at || '',
          });
        }
      }

      return {
        comments: comments.map((c: any) => ({
          id: c.comment_id || extractId(c.id),
          userId: c.user_id,
          user: userMap.get(c.user_id) || null,
          jokeId: c.joke_id,
          text: c.text,
          createdAt: c.created_at,
          likes: c.likes || 0,
        })),
      };
    }),

  addComment: protectedProcedure
    .input(
      z.object({
        jokeId: z.string(),
        text: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ensureDB();
      const commentId = 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);

      await dbQuery(`
        CREATE comments SET
          comment_id = '${esc(commentId)}',
          user_id = '${esc(ctx.userId)}',
          joke_id = '${esc(input.jokeId)}',
          text = '${esc(input.text)}',
          likes = 0,
          created_at = time::now();
      `);

      await dbQuery(`UPDATE jokes SET comments_count += 1 WHERE joke_id = '${esc(input.jokeId)}';`);

      return { commentId };
    }),

  seed: publicProcedure.mutation(async () => {
    await ensureDB();

    const existing = await dbQuery(`SELECT count() as total FROM jokes GROUP ALL;`);
    const count = existing[0]?.total || existing[0]?.count || 0;
    if (count > 0) {
      console.log('[jokes.seed] Already seeded, count:', count);
      return { seeded: false, count };
    }

    console.log('[jokes.seed] Seeding database with mock data...');

    const mockUsers = [
      { uid: 'u1', username: 'blagueur_pro', display_name: 'Marco le Blagueur', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face', bio: 'Champion de la blague rapide 🎤', jokes_count: 42, total_likes: 1250, followers_count: 890, following_count: 120 },
      { uid: 'u2', username: 'rire_assure', display_name: 'Sophie Rires', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=face', bio: 'Je raconte des histoires qui font mourir de rire 😂', jokes_count: 67, total_likes: 3400, followers_count: 2100, following_count: 340 },
      { uid: 'u3', username: 'humour_geek', display_name: 'Alex Dev', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face', bio: 'Blagues de développeur et humour tech 🤓', jokes_count: 28, total_likes: 780, followers_count: 560, following_count: 90 },
      { uid: 'u4', username: 'papa_blagues', display_name: 'Papa Blague', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face', bio: 'Les meilleures dad jokes en français 👨‍👧', jokes_count: 95, total_likes: 5600, followers_count: 4200, following_count: 50 },
      { uid: 'u5', username: 'stand_up_lili', display_name: 'Lili Stand-Up', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face', bio: 'Humoriste en herbe, blagues du quotidien 🎭', jokes_count: 33, total_likes: 1890, followers_count: 1100, following_count: 200 },
    ];

    for (const u of mockUsers) {
      try {
        await dbQuery(`
          CREATE users SET
            uid = '${esc(u.uid)}',
            username = '${esc(u.username)}',
            email = '${esc(u.username)}@joky.app',
            password_hash = 'mock',
            password_salt = 'mock',
            display_name = '${esc(u.display_name)}',
            avatar = '${esc(u.avatar)}',
            bio = '${esc(u.bio)}',
            language = 'FR',
            jokes_count = ${u.jokes_count},
            total_likes = ${u.total_likes},
            followers_count = ${u.followers_count},
            following_count = ${u.following_count},
            badges = [],
            is_admin = false,
            is_subscribed = false,
            created_at = '2025-06-15T00:00:00Z';
        `);
      } catch (err) {
        console.log('[seed] User create error (may already exist):', err);
      }
    }

    const mockJokes = [
      { joke_id: 'j1', user_id: 'u4', title: 'Le plombier', audio_uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', duration: 18, category: 'courtes', tags: "['papa','classique']", is_trending: true, is_joke_of_day: true, reactions_laugh: 245, reactions_rofl: 180, reactions_cry: 12, reactions_skull: 89, reactions_clap: 34, reactions_heart: 56, average_rating: 4.7, total_ratings: 312, created_at: '2026-03-01T10:30:00Z' },
      { joke_id: 'j2', user_id: 'u2', title: 'Le rendez-vous catastrophe', audio_uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', duration: 65, category: 'couple', tags: "['amour','date']", is_trending: true, is_joke_of_day: false, reactions_laugh: 567, reactions_rofl: 340, reactions_cry: 45, reactions_skull: 120, reactions_clap: 89, reactions_heart: 210, average_rating: 4.9, total_ratings: 489, created_at: '2026-03-01T08:15:00Z' },
      { joke_id: 'j3', user_id: 'u3', title: 'Bug en production', audio_uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', duration: 32, category: 'geek', tags: "['dev','code','bug']", is_trending: false, is_joke_of_day: false, reactions_laugh: 189, reactions_rofl: 145, reactions_cry: 67, reactions_skull: 234, reactions_clap: 45, reactions_heart: 23, average_rating: 4.2, total_ratings: 198, created_at: '2026-03-01T14:20:00Z' },
      { joke_id: 'j4', user_id: 'u1', title: 'Le prof de maths', audio_uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3', duration: 15, category: 'ecole', tags: "['ecole','maths']", is_trending: true, is_joke_of_day: false, reactions_laugh: 312, reactions_rofl: 198, reactions_cry: 5, reactions_skull: 56, reactions_clap: 78, reactions_heart: 34, average_rating: 4.5, total_ratings: 267, created_at: '2026-02-28T16:45:00Z' },
      { joke_id: 'j5', user_id: 'u5', title: 'Lundi matin au bureau', audio_uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3', duration: 45, category: 'travail', tags: "['bureau','lundi','boss']", is_trending: true, is_joke_of_day: false, reactions_laugh: 423, reactions_rofl: 267, reactions_cry: 89, reactions_skull: 145, reactions_clap: 56, reactions_heart: 78, average_rating: 4.6, total_ratings: 345, created_at: '2026-02-28T09:00:00Z' },
      { joke_id: 'j6', user_id: 'u4', title: 'Le médecin et le patient', audio_uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3', duration: 22, category: 'clean', tags: "['medecin','classique']", is_trending: false, is_joke_of_day: false, reactions_laugh: 189, reactions_rofl: 134, reactions_cry: 8, reactions_skull: 67, reactions_clap: 90, reactions_heart: 45, average_rating: 3.8, total_ratings: 156, created_at: '2026-02-27T12:30:00Z' },
      { joke_id: 'j7', user_id: 'u2', title: 'La belle-mère', audio_uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3', duration: 55, category: 'histoires', tags: "['famille','belle-mere']", is_trending: true, is_joke_of_day: false, reactions_laugh: 678, reactions_rofl: 445, reactions_cry: 34, reactions_skull: 189, reactions_clap: 67, reactions_heart: 123, average_rating: 4.8, total_ratings: 523, created_at: '2026-02-27T18:00:00Z' },
      { joke_id: 'j8', user_id: 'u1', title: 'Match de foot', audio_uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3', duration: 28, category: 'sport', tags: "['foot','sport']", is_trending: false, is_joke_of_day: false, reactions_laugh: 156, reactions_rofl: 98, reactions_cry: 12, reactions_skull: 45, reactions_clap: 123, reactions_heart: 34, average_rating: 3.5, total_ratings: 134, created_at: '2026-02-26T20:15:00Z' },
      { joke_id: 'j9', user_id: 'u3', title: 'Stack Overflow', audio_uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3', duration: 20, category: 'geek', tags: "['dev','stackoverflow']", is_trending: false, is_joke_of_day: false, reactions_laugh: 345, reactions_rofl: 234, reactions_cry: 56, reactions_skull: 178, reactions_clap: 34, reactions_heart: 12, average_rating: 4.3, total_ratings: 278, created_at: '2026-02-26T11:00:00Z' },
      { joke_id: 'j10', user_id: 'u5', title: 'Le voisin bruyant', audio_uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3', duration: 40, category: 'histoires', tags: "['voisin','quotidien']", is_trending: false, is_joke_of_day: false, reactions_laugh: 234, reactions_rofl: 156, reactions_cry: 23, reactions_skull: 89, reactions_clap: 45, reactions_heart: 67, average_rating: 4.1, total_ratings: 189, created_at: '2026-02-25T15:30:00Z' },
    ];

    for (const j of mockJokes) {
      try {
        await dbQuery(`
          CREATE jokes SET
            joke_id = '${esc(j.joke_id)}',
            user_id = '${esc(j.user_id)}',
            title = '${esc(j.title)}',
            audio_uri = '${esc(j.audio_uri)}',
            duration = ${j.duration},
            category = '${esc(j.category)}',
            tags = ${j.tags},
            language = 'FR',
            level = 'all',
            allow_comments = true,
            reactions_laugh = ${j.reactions_laugh},
            reactions_rofl = ${j.reactions_rofl},
            reactions_cry = ${j.reactions_cry},
            reactions_skull = ${j.reactions_skull},
            reactions_clap = ${j.reactions_clap},
            reactions_heart = ${j.reactions_heart},
            comments_count = 0,
            is_trending = ${j.is_trending},
            is_joke_of_day = ${j.is_joke_of_day},
            average_rating = ${j.average_rating},
            total_ratings = ${j.total_ratings},
            created_at = '${j.created_at}';
        `);
      } catch (err) {
        console.log('[seed] Joke create error:', err);
      }
    }

    console.log('[jokes.seed] Seeding complete');
    return { seeded: true, count: mockJokes.length };
  }),
});
