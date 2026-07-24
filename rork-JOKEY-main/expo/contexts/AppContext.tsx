import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { Platform } from 'react-native';
import { User, Joke, Video, ReactionEmoji, SubscriptionPlan, ImageJoke } from '@/types';
import { supabase } from '@/lib/supabase';
import { setCachedUser, getCachedUser } from '@/lib/auth-storage';
import { clientRegister, clientLogin, clientDeleteAccount, clientRequestPasswordReset, clientConfirmPasswordReset, signOutSupabase, clientGetMe } from '@/lib/auth-client';
import { handleAuthDeepLink } from '@/lib/auth-deep-link';
import * as Linking from 'expo-linking';
import { ensureDBReady, fetchJokesFromDB, fetchVideosFromDB, toggleReactionInDB, rateJokeInDB, toggleFollowInDB, deleteJokeFromDB, deleteVideoFromDB, ensureUserRecordExists, uploadAvatarToSupabase, updateUserProfileInDB, refreshUserProfileStats, fetchFollowingIdsFromDB, fetchTotalUserCount } from '@/lib/db-client';
import { filterJokes, filterVideos } from '@/lib/content-filter';
import {
  getBlockedUserIds,
  getBlockedUsers,
  syncBlockedUsersFromDB,
  blockUser as blockUserInStorage,
  unblockUser as unblockUserInStorage,
  submitReport,
  type ReportPayload,
  type BlockedUserEntry,
} from '@/lib/moderation-client';
import {
  fetchImageJokesFromDB,
  publishImageJoke as publishImageJokeToDB,
  deleteImageJokeFromDB,
} from '@/lib/image-jokes-client';
import { isSupabaseConfigured } from '@/lib/supabase';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

const PASSWORD_RECOVERY_USER = { __passwordRecovery: true } as const;
type AuthRestoreResult = User | null | typeof PASSWORD_RECOVERY_USER;

function isPasswordRecoveryResult(data: AuthRestoreResult): data is typeof PASSWORD_RECOVERY_USER {
  return data !== null && typeof data === 'object' && '__passwordRecovery' in data;
}

const STORAGE_KEYS = {
  SUBSCRIPTION: 'joky_subscription',
  SUBSCRIPTION_PLAN: 'joky_subscription_plan',
  IS_ADMIN: 'joky_is_admin',
  SETTINGS: 'joky_settings',
  LISTEN_COUNT: 'joky_listen_count',
  CREATE_COUNT: 'joky_create_count',
  TIPS_BALANCE: 'joky_tips_balance',
  PREAMBLE_ACCEPTED: 'joky_preamble_accepted',
};



interface AppSettings {
  notifications: boolean;
  safeMode: boolean;
  autoplay: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  notifications: true,
  safeMode: false,
  autoplay: true,
};

export const [AppProvider, useApp] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authChecked, setAuthChecked] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [jokes, setJokes] = useState<Joke[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [imageJokes, setImageJokes] = useState<ImageJoke[]>([]);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [myReactions, setMyReactions] = useState<Record<string, ReactionEmoji[]>>({});
  const [myRatings, setMyRatings] = useState<Record<string, number>>({});
  const [playingJokeId, setPlayingJokeId] = useState<string | null>(null);
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [subscriptionPlan, setSubscriptionPlan] = useState<SubscriptionPlan | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [listenCount, setListenCount] = useState<number>(0);
  const [createCount, setCreateCount] = useState<number>(0);
  const [tipsBalance, setTipsBalance] = useState<Record<string, number>>({});
  const [dbReady, setDbReady] = useState<boolean>(false);
  const [totalUsers, setTotalUsers] = useState<number>(0);
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUserEntry[]>([]);
  const [preambleAccepted, setPreambleAccepted] = useState<boolean | null>(null);

  const globalPlayer = useAudioPlayer(null);
  const globalAudioStatus = useAudioPlayerStatus(globalPlayer);
  const pendingPlay = useRef(false);
  const seenUnloaded = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const initDB = async () => {
      console.log('[AppContext] Initializing Supabase DB...');
      try {
        // Initialize Audio Mode (expo-audio compatible params only)
        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: false,
          shouldRouteThroughEarpiece: false,
          interruptionMode: 'mixWithOthers',
          shouldPlayInBackground: true,
        }).catch(err => console.log('[AppContext] Audio mode error:', err));

        const ok = await ensureDBReady();
        if (!cancelled) {
          console.log('[AppContext] Supabase DB ready:', ok);
          setDbReady(ok);
        }
      } catch (err) {
        console.log('[AppContext] Supabase DB init not available:', err);
        if (!cancelled) setDbReady(false);
      }
    };

    const timeout = setTimeout(() => {
      if (!cancelled) {
        void initDB();
      }
    }, 100);

    return () => { cancelled = true; clearTimeout(timeout); };
  }, []);

  const authQuery = useQuery({
    queryKey: ['auth-restore'],
    queryFn: async (): Promise<AuthRestoreResult> => {
      console.log('[AppContext] Restoring auth session... Supabase configured:', isSupabaseConfigured);

      if (!isSupabaseConfigured) {
        console.log('[AppContext] Supabase not configured, checking cache');
        const cached = await getCachedUser();
        if (cached && (cached as any).id && (cached as any).username) {
          return cached as unknown as User;
        }
        return null;
      }

      try {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) {
          const mode = await handleAuthDeepLink(initialUrl);
          if (mode === 'recovery') {
            console.log('[AppContext] Password recovery deep link handled on launch');
            return PASSWORD_RECOVERY_USER;
          }
        }

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.warn('[AppContext] Session error:', sessionError.message);
          if (sessionError.message.includes('Refresh Token') || sessionError.message.includes('refresh_token') || sessionError.message.includes('Invalid Refresh Token')) {
            console.log('[AppContext] Invalid refresh token, signing out and clearing session');
            try { await supabase.auth.signOut(); } catch (_e) { /* ignore */ }
            await setCachedUser(null as any);
            return null;
          }
        }

        if (!session?.user) {
          console.log('[AppContext] No Supabase session found');
          const cached = await getCachedUser();
          if (cached && (cached as any).id && (cached as any).username) {
            console.log('[AppContext] Using cached user:', (cached as any).username);
            return cached as unknown as User;
          }
          return null;
        }

        console.log('[AppContext] Supabase session found for:', session.user.id);

        try {
          const user = await clientGetMe(session.user.id);
          if (user) {
            console.log('[AppContext] User profile fetched:', user.username);
            await setCachedUser(user);
            return user;
          }
        } catch (err) {
          console.error('[AppContext] Failed to fetch user profile:', err);
        }

        const cached = await getCachedUser();
        if (cached && (cached as any).id) {
          return cached as unknown as User;
        }

        return null;
      } catch (err: any) {
        console.error('[AppContext] Auth restore error:', err?.message);
        if (err?.message?.includes('Refresh Token') || err?.message?.includes('refresh_token') || err?.message?.includes('Invalid Refresh Token')) {
          console.log('[AppContext] Invalid refresh token in catch, clearing session');
          try { await supabase.auth.signOut(); } catch (_e) { /* ignore */ }
          await setCachedUser(null as any);
          return null;
        }
        const cached = await getCachedUser();
        if (cached && (cached as any).id) {
          return cached as unknown as User;
        }
        return null;
      }
    },
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  });

  const [isPasswordRecovery, setIsPasswordRecovery] = useState<boolean>(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[AppContext] Auth state changed:', event);
      if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        setIsAuthenticated(false);
        queryClient.setQueryData(['auth-restore'], null);
      } else if (event === 'PASSWORD_RECOVERY') {
        console.log('[AppContext] PASSWORD_RECOVERY event — showing reset form');
        setIsPasswordRecovery(true);
        setCurrentUser(null);
        setIsAuthenticated(false);
        queryClient.setQueryData(['auth-restore'], PASSWORD_RECOVERY_USER);
      } else if (event === 'SIGNED_IN' && session?.user) {
        if (!isPasswordRecovery) {
          void queryClient.invalidateQueries({ queryKey: ['auth-restore'] });
        }
      }
    });

    const linkingSub = Linking.addEventListener('url', ({ url }) => {
      void (async () => {
        try {
          const mode = await handleAuthDeepLink(url);
          if (mode === 'recovery') {
            console.log('[AppContext] Password recovery deep link handled while running');
            setIsPasswordRecovery(true);
            setCurrentUser(null);
            setIsAuthenticated(false);
            queryClient.setQueryData(['auth-restore'], PASSWORD_RECOVERY_USER);
          }
        } catch (err) {
          console.error('[AppContext] Deep link handling failed:', err);
        }
      })();
    });

    return () => {
      subscription.unsubscribe();
      linkingSub.remove();
    };
  }, [queryClient, isPasswordRecovery]);

  const jokesQuery = useQuery({
    queryKey: ['jokes-list'],
    queryFn: async () => {
      console.log('[AppContext] Fetching jokes from Supabase...');
      return fetchJokesFromDB();
    },
    enabled: dbReady,
    retry: 1,
    staleTime: 60 * 1000,
  });

  const videosQuery = useQuery({
    queryKey: ['videos-list'],
    queryFn: async () => {
      console.log('[AppContext] Fetching videos from Supabase...');
      return fetchVideosFromDB();
    },
    enabled: dbReady,
    retry: 1,
    staleTime: 60 * 1000,
  });

  const imageJokesQuery = useQuery({
    queryKey: ['image-jokes-list'],
    queryFn: async () => {
      console.log('[AppContext] Fetching image jokes...');
      return fetchImageJokesFromDB();
    },
    retry: 1,
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    if (authQuery.isFetched) {
      if (authQuery.data && isPasswordRecoveryResult(authQuery.data)) {
        setCurrentUser(null);
        setIsAuthenticated(false);
        setIsPasswordRecovery(true);
      } else if (authQuery.data) {
        setCurrentUser(authQuery.data);
        setIsAuthenticated(true);
        console.log('[AppContext] User restored:', authQuery.data.username);
        
        // Ensure user record exists in Supabase
        if (dbReady) {
          ensureUserRecordExists(authQuery.data);
        }
      } else {
        setCurrentUser(null);
        setIsAuthenticated(false);
      }
      setAuthChecked(true);
    }
  }, [authQuery.data, authQuery.isFetched, dbReady]);

  useEffect(() => {
    if (!dbReady || !currentUser) return;

    let cancelled = false;

    const syncProfile = async () => {
      try {
        const [stats, following, adminResult] = await Promise.all([
          refreshUserProfileStats(currentUser.id),
          fetchFollowingIdsFromDB(currentUser.id),
          supabase.from('users').select('is_admin').eq('id', currentUser.id).single(),
        ]);
        if (cancelled) return;
        if (adminResult.error) {
          console.warn('[AppContext] Admin status fetch failed:', adminResult.error.message);
        }
        const isAdmin = adminResult.data?.is_admin === true;
        setCurrentUser((prev) => {
          if (!prev) return prev;
          const next = {
            ...prev,
            ...stats,
            isAdmin,
          };
          void setCachedUser(next);
          return next;
        });
        setFollowingIds(following);
      } catch (err) {
        console.warn('[AppContext] Profile stats sync failed:', err);
      }
    };

    void syncProfile();
    return () => { cancelled = true; };
  }, [dbReady, currentUser?.id]);

  useEffect(() => {
    if (!dbReady) return;

    let cancelled = false;

    const loadUserCount = async () => {
      const count = await fetchTotalUserCount();
      if (!cancelled) setTotalUsers(count);
    };

    void loadUserCount();

    const channel = supabase
      .channel('total-users')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'users' }, () => {
        void loadUserCount();
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'users' }, () => {
        void loadUserCount();
      })
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [dbReady]);

  useEffect(() => {
    if (!dbReady || !currentUser) return;

    const channel = supabase
      .channel(`user-stats-${currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${currentUser.id}`,
        },
        (payload) => {
          const row = payload.new as Record<string, number | string | boolean | null>;
          setCurrentUser((prev) => {
            if (!prev) return prev;
            const next = {
              ...prev,
              jokesCount: typeof row.jokes_count === 'number' ? row.jokes_count : prev.jokesCount,
              followersCount:
                typeof row.followers_count === 'number' ? row.followers_count : prev.followersCount,
              followingCount:
                typeof row.following_count === 'number' ? row.following_count : prev.followingCount,
              isAdmin: typeof row.is_admin === 'boolean' ? row.is_admin : prev.isAdmin,
            };
            void setCachedUser(next);
            return next;
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [dbReady, currentUser?.id]);

  useEffect(() => {
    if (authQuery.isError) {
      console.error('[AppContext] Auth restore error:', authQuery.error);
      setAuthChecked(true);
    }
  }, [authQuery.isError, authQuery.error]);

  useEffect(() => {
    if (jokesQuery.data !== undefined) {
      setJokes(jokesQuery.data);
      console.log('[AppContext] Loaded', jokesQuery.data.length, 'jokes from Supabase');
    }
  }, [jokesQuery.data]);

  useEffect(() => {
    if (videosQuery.data !== undefined) {
      setVideos(videosQuery.data);
      console.log('[AppContext] Loaded', videosQuery.data.length, 'videos from Supabase');
    }
  }, [videosQuery.data]);

  useEffect(() => {
    if (imageJokesQuery.data !== undefined) {
      setImageJokes(imageJokesQuery.data);
      console.log('[AppContext] Loaded', imageJokesQuery.data.length, 'image jokes');
    }
  }, [imageJokesQuery.data]);

  const subscriptionQuery = useQuery({
    queryKey: ['subscription-local'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.SUBSCRIPTION);
      const plan = await AsyncStorage.getItem(STORAGE_KEYS.SUBSCRIPTION_PLAN);
      return { subscribed: stored === 'true', plan: plan as SubscriptionPlan | null };
    },
  });

  const countsQuery = useQuery({
    queryKey: ['usage-counts-local'],
    queryFn: async () => {
      const lc = await AsyncStorage.getItem(STORAGE_KEYS.LISTEN_COUNT);
      const cc = await AsyncStorage.getItem(STORAGE_KEYS.CREATE_COUNT);
      const tb = await AsyncStorage.getItem(STORAGE_KEYS.TIPS_BALANCE);
      return {
        listenCount: lc ? parseInt(lc, 10) : 0,
        createCount: cc ? parseInt(cc, 10) : 0,
        tipsBalance: tb ? JSON.parse(tb) as Record<string, number> : {},
      };
    },
  });

  const adminQuery = useQuery({
    queryKey: ['admin-local'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.IS_ADMIN);
      return stored === 'true';
    },
  });

  const settingsQuery = useQuery({
    queryKey: ['appSettings-local'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
      return stored ? JSON.parse(stored) as AppSettings : DEFAULT_SETTINGS;
    },
  });

  const preambleQuery = useQuery({
    queryKey: ['preamble-accepted'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.PREAMBLE_ACCEPTED);
      return stored === 'true';
    },
  });

  const blockedUsersQuery = useQuery({
    queryKey: ['blocked-users', currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return [] as BlockedUserEntry[];
      return syncBlockedUsersFromDB(currentUser.id);
    },
    enabled: Boolean(currentUser?.id),
  });

  useEffect(() => {
    if (subscriptionQuery.data !== undefined) {
      setIsSubscribed(subscriptionQuery.data.subscribed);
      setSubscriptionPlan(subscriptionQuery.data.plan);
    }
  }, [subscriptionQuery.data]);

  useEffect(() => {
    if (countsQuery.data) {
      setListenCount(countsQuery.data.listenCount);
      setCreateCount(countsQuery.data.createCount);
      setTipsBalance(countsQuery.data.tipsBalance);
    }
  }, [countsQuery.data]);

  useEffect(() => {
    if (adminQuery.data !== undefined) setIsAdmin(adminQuery.data);
  }, [adminQuery.data]);

  useEffect(() => {
    if (settingsQuery.data) setSettings(settingsQuery.data);
  }, [settingsQuery.data]);

  useEffect(() => {
    if (preambleQuery.data !== undefined) setPreambleAccepted(preambleQuery.data);
  }, [preambleQuery.data]);

  useEffect(() => {
    if (blockedUsersQuery.data) {
      setBlockedUsers(blockedUsersQuery.data);
      setBlockedUserIds(blockedUsersQuery.data.map((e) => e.id));
    }
  }, [blockedUsersQuery.data]);

  const visibleJokes = useMemo(
    () => filterJokes(jokes, { safeMode: settings.safeMode, blockedUserIds }),
    [jokes, settings.safeMode, blockedUserIds]
  );

  const visibleVideos = useMemo(
    () => filterVideos(videos, { safeMode: settings.safeMode, blockedUserIds }),
    [videos, settings.safeMode, blockedUserIds]
  );

  const authMutation = useMutation({
    mutationFn: async (input: { type: 'register'; username: string; email: string; password: string; role?: string } | { type: 'login'; email: string; password: string }) => {
      console.log('[AppContext] Auth mutation:', input.type);

      if (input.type === 'register') {
        return await clientRegister({
          username: input.username,
          email: input.email,
          password: input.password,
          role: input.role,
        });
      } else {
        return await clientLogin({
          email: input.email,
          password: input.password,
        });
      }
    },
    onSuccess: async (data) => {
      console.log('[AppContext] Auth success:', data.user.username || data.user.id);
      const user: User = {
        ...data.user,
        role: data.user.role || 'creator',
        badges: data.user.badges || [],
        isFollowing: data.user.isFollowing ?? false,
        isAdmin: data.user.isAdmin === true,
      };
      await setCachedUser(user);
      setCurrentUser(user);
      setIsAuthenticated(true);
      setAuthError(null);
      
      // Ensure user record exists in Supabase
      if (dbReady) {
        ensureUserRecordExists(user);
      }
    },
    onError: (error: Error) => {
      console.error('[AppContext] Auth error:', error.message);
      setAuthError(error.message);
    },
  });

  const register = useCallback(
    (input: { username: string; email: string; password: string; role?: string }) => {
      setAuthError(null);
      authMutation.mutate({ type: 'register', ...input });
    },
    [authMutation]
  );

  const login = useCallback(
    (input: { email: string; password: string }) => {
      setAuthError(null);
      authMutation.mutate({ type: 'login', ...input });
    },
    [authMutation]
  );

  const requestPasswordResetMutation = useMutation({
    mutationFn: async (email: string) => {
      console.log('[AppContext] Password reset request');
      return await clientRequestPasswordReset(email);
    },
  });

  const confirmPasswordResetMutation = useMutation({
    mutationFn: async (input: { email: string; code: string; newPassword: string }) => {
      console.log('[AppContext] Confirm password reset');
      return await clientConfirmPasswordReset(input);
    },
  });

  const requestPasswordReset = useCallback(
    (email: string) => requestPasswordResetMutation.mutateAsync(email),
    [requestPasswordResetMutation]
  );

  const confirmPasswordReset = useCallback(
    (input: { email: string; code: string; newPassword: string }) => confirmPasswordResetMutation.mutateAsync(input),
    [confirmPasswordResetMutation]
  );

  const updateProfileMutation = useMutation({
    mutationFn: async (input: {
      user: User;
      localAvatarUri?: string;
      displayName?: string;
      bio?: string;
      language?: string;
    }) => {
      const { user, localAvatarUri, displayName, bio, language } = input;

      if (!isSupabaseConfigured) {
        const next: User = {
          ...user,
          ...(localAvatarUri ? { avatar: localAvatarUri } : {}),
          ...(displayName !== undefined ? { displayName } : {}),
          ...(bio !== undefined ? { bio } : {}),
          ...(language !== undefined ? { language } : {}),
        };
        return next;
      }

      await ensureUserRecordExists(user);

      let avatarUrl: string | undefined;
      if (localAvatarUri) {
        avatarUrl = await uploadAvatarToSupabase(localAvatarUri, user.id);
      }

      const patch: Parameters<typeof updateUserProfileInDB>[1] = {};
      if (avatarUrl) patch.avatar = avatarUrl;
      if (displayName !== undefined) patch.display_name = displayName;
      if (bio !== undefined) patch.bio = bio;
      if (language !== undefined) patch.language = language;

      if (Object.keys(patch).length > 0) {
        await updateUserProfileInDB(user.id, patch);
      }

      const refreshed = await clientGetMe(user.id);
      if (!refreshed) {
        throw new Error('Impossible de recharger le profil');
      }
      return refreshed;
    },
    onSuccess: async (user) => {
      await setCachedUser(user);
      setCurrentUser(user);
      setJokes(prev => prev.map(j =>
        j.userId === user.id
          ? { ...j, user: { ...j.user, avatar: user.avatar, displayName: user.displayName, bio: user.bio, language: user.language } }
          : j
      ));
    },
    onError: (error: Error) => {
      console.error('[AppContext] updateProfile error:', error.message);
    },
  });

  const updateProfile = useCallback(
    (input: { localAvatarUri?: string; displayName?: string; bio?: string; language?: string }) => {
      if (!currentUser) {
        return Promise.reject(new Error('Non authentifié'));
      }
      return updateProfileMutation.mutateAsync({ user: currentUser, ...input });
    },
    [currentUser, updateProfileMutation]
  );

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (currentUser) {
        await clientDeleteAccount(currentUser.id);
      }
      await signOutSupabase();
    },
    onSuccess: async () => {
      console.log('[AppContext] Account deleted');
      setCurrentUser(null);
      setIsAuthenticated(false);
      setAuthError(null);
      setFollowingIds([]);
      setMyReactions({});
      setMyRatings({});
      queryClient.setQueryData(['auth-restore'], null);
      queryClient.removeQueries({ queryKey: ['auth-restore'] });
    },
    onError: (error: Error) => {
      console.error('[AppContext] Delete account error:', error.message);
      setAuthError(error.message);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      console.log('[AppContext] Logout mutation started');
      await signOutSupabase();
      console.log('[AppContext] signOutSupabase completed');
    },
    onSuccess: () => {
      console.log('[AppContext] Logout onSuccess - clearing state');
      setCurrentUser(null);
      setIsAuthenticated(false);
      setAuthError(null);
      setFollowingIds([]);
      setMyReactions({});
      setMyRatings({});
      setPlayingJokeId(null);
      queryClient.setQueryData(['auth-restore'], null);
      queryClient.removeQueries({ queryKey: ['auth-restore'] });
      console.log('[AppContext] Logout state cleared');
    },
    onError: (error: Error) => {
      console.error('[AppContext] Logout error:', error.message);
      console.log('[AppContext] Force clearing state despite error');
      setCurrentUser(null);
      setIsAuthenticated(false);
      setAuthError(null);
      setFollowingIds([]);
      setMyReactions({});
      setMyRatings({});
      setPlayingJokeId(null);
      queryClient.setQueryData(['auth-restore'], null);
      queryClient.removeQueries({ queryKey: ['auth-restore'] });
    },
  });

  const logout = useCallback(() => {
    console.log('[AppContext] logout() called');
    logoutMutation.mutate();
  }, [logoutMutation]);

  const deleteAccount = useCallback(() => {
    if (currentUser) {
      deleteMutation.mutate();
    } else {
      logoutMutation.mutate();
    }
  }, [currentUser, deleteMutation, logoutMutation]);

  const followMutation = useMutation({
    mutationFn: async (userId: string) => {
      if (!currentUser) throw new Error('Non authentifié');
      return toggleFollowInDB(currentUser.id, userId);
    },
    onSuccess: (data, userId) => {
      if (data.following) {
        setFollowingIds(prev => [...prev, userId]);
      } else {
        setFollowingIds(prev => prev.filter(id => id !== userId));
      }

      setJokes(prev => prev.map(j => {
        if (j.userId !== userId || !j.user) return j;
        return {
          ...j,
          user: {
            ...j.user,
            followersCount: Math.max(0, j.user.followersCount + (data.following ? 1 : -1)),
          },
        };
      }));

      setCurrentUser(prev => prev
        ? { ...prev, followingCount: Math.max(0, prev.followingCount + (data.following ? 1 : -1)) }
        : prev);
    },
  });

  const localFollowMutation = useMutation({
    mutationFn: async (userId: string) => {
      const isCurrentlyFollowing = followingIds.includes(userId);
      return { userId, following: !isCurrentlyFollowing };
    },
    onSuccess: (data) => {
      if (data.following) {
        setFollowingIds(prev => [...prev, data.userId]);
      } else {
        setFollowingIds(prev => prev.filter(id => id !== data.userId));
      }
    },
  });

  const toggleFollow = useCallback((input: { userId: string }) => {
    const userId = input.userId;
    if (dbReady && currentUser) {
      followMutation.mutate(userId);
    } else {
      localFollowMutation.mutate(userId);
    }
  }, [dbReady, currentUser, followMutation, localFollowMutation]);

  const reactMutation = useMutation({
    mutationFn: async ({ jokeId, emoji }: { jokeId: string; emoji: ReactionEmoji }) => {
      if (!currentUser) throw new Error('Non authentifié');
      return toggleReactionInDB(jokeId, currentUser.id, emoji);
    },
    onSuccess: (data, variables) => {
      const jokeReactions = myReactions[variables.jokeId] || [];
      const emoji = variables.emoji;
      if (data.added) {
        setMyReactions(prev => ({ ...prev, [variables.jokeId]: [...jokeReactions, emoji] }));
      } else {
        setMyReactions(prev => ({ ...prev, [variables.jokeId]: jokeReactions.filter(e => e !== emoji) }));
      }
      setJokes(prev => prev.map(j => {
        if (j.id === variables.jokeId) {
          return {
            ...j,
            reactions: {
              ...j.reactions,
              [emoji]: j.reactions[emoji] + (data.added ? 1 : -1),
            },
          };
        }
        return j;
      }));
    },
  });

  const localReactMutation = useMutation({
    mutationFn: async ({ jokeId, emoji }: { jokeId: string; emoji: ReactionEmoji }) => {
      const jokeReactions = myReactions[jokeId] || [];
      const added = !jokeReactions.includes(emoji);
      return { jokeId, emoji, added };
    },
    onSuccess: ({ jokeId, emoji, added }) => {
      const jokeReactions = myReactions[jokeId] || [];
      if (added) {
        setMyReactions(prev => ({ ...prev, [jokeId]: [...jokeReactions, emoji] }));
      } else {
        setMyReactions(prev => ({ ...prev, [jokeId]: jokeReactions.filter(e => e !== emoji) }));
      }
      setJokes(prev => prev.map(j => {
        if (j.id === jokeId) {
          return {
            ...j,
            reactions: { ...j.reactions, [emoji]: j.reactions[emoji] + (added ? 1 : -1) },
          };
        }
        return j;
      }));
    },
  });

  const addReaction = useCallback((input: { jokeId: string; emoji: ReactionEmoji }) => {
    if (dbReady && currentUser) {
      reactMutation.mutate(input);
    } else {
      localReactMutation.mutate(input);
    }
  }, [dbReady, currentUser, reactMutation, localReactMutation]);

  const rateMutation = useMutation({
    mutationFn: async ({ jokeId, rating }: { jokeId: string; rating: number }) => {
      if (!currentUser) throw new Error('Non authentifié');
      return rateJokeInDB(jokeId, currentUser.id, rating);
    },
    onSuccess: (data, variables) => {
      setMyRatings(prev => ({ ...prev, [variables.jokeId]: variables.rating }));
      setJokes(prev => prev.map(j => {
        if (j.id === variables.jokeId) {
          return { ...j, averageRating: data.averageRating, totalRatings: data.totalRatings };
        }
        return j;
      }));
    },
  });

  const localRateMutation = useMutation({
    mutationFn: async ({ jokeId, rating }: { jokeId: string; rating: number }) => {
      return { jokeId, rating };
    },
    onSuccess: ({ jokeId, rating }) => {
      const oldRating = myRatings[jokeId];
      setMyRatings(prev => ({ ...prev, [jokeId]: rating }));
      setJokes(prev => prev.map(j => {
        if (j.id === jokeId) {
          const hadPrev = oldRating !== undefined;
          const newTotal = hadPrev ? j.totalRatings : j.totalRatings + 1;
          const totalSum = hadPrev
            ? (j.averageRating * j.totalRatings - oldRating + rating)
            : (j.averageRating * j.totalRatings + rating);
          return { ...j, averageRating: Math.round((totalSum / newTotal) * 10) / 10, totalRatings: newTotal };
        }
        return j;
      }));
    },
  });

  const rateJoke = useCallback((input: { jokeId: string; rating: number }) => {
    if (dbReady && currentUser) {
      rateMutation.mutate(input);
    } else {
      localRateMutation.mutate(input);
    }
  }, [dbReady, currentUser, rateMutation, localRateMutation]);

  const addJoke = useCallback((joke: Joke) => {
    setJokes(prev => [joke, ...prev]);
    if (currentUser && joke.userId === currentUser.id) {
      setCurrentUser(prev => prev ? { ...prev, jokesCount: prev.jokesCount + 1 } : prev);
    }
  }, [currentUser]);

  const addVideo = useCallback((video: Video) => {
    setVideos(prev => [video, ...prev]);
    if (currentUser && video.userId === currentUser.id) {
      setCurrentUser(prev => prev ? { ...prev, jokesCount: prev.jokesCount + 1 } : prev);
    }
  }, [currentUser]);

  const updateJokeCommentsCount = useCallback((jokeId: string, count: number) => {
    setJokes(prev => prev.map(j => (j.id === jokeId ? { ...j, commentsCount: count } : j)));
  }, []);

  const deleteJokeMutation = useMutation({
    mutationFn: async ({ jokeId, audioUri, ownerId }: { jokeId: string; audioUri: string; ownerId?: string }) => {
      if (dbReady) {
        await deleteJokeFromDB(jokeId, audioUri);
      }
      return { jokeId, ownerId };
    },
    onSuccess: ({ jokeId, ownerId }) => {
      setJokes(prev => prev.filter(j => j.id !== jokeId));
      if (ownerId && currentUser?.id === ownerId) {
        setCurrentUser(prev => prev
          ? { ...prev, jokesCount: Math.max(0, prev.jokesCount - 1) }
          : prev);
      }
      console.log('[AppContext] Joke deleted:', jokeId);
    },
    onError: (error: Error) => {
      console.error('[AppContext] Delete joke error:', error.message);
    },
  });

  const deleteJoke = useCallback((jokeId: string, audioUri: string) => {
    const ownerId = jokes.find(j => j.id === jokeId)?.userId;
    deleteJokeMutation.mutate({ jokeId, audioUri, ownerId });
  }, [deleteJokeMutation, jokes]);

  const deleteVideoMutation = useMutation({
    mutationFn: async ({ videoId, videoUri, ownerId }: { videoId: string; videoUri: string; ownerId?: string }) => {
      if (dbReady) {
        await deleteVideoFromDB(videoId, videoUri);
      }
      return { videoId, ownerId };
    },
    onSuccess: ({ videoId, ownerId }) => {
      setVideos(prev => prev.filter(v => v.id !== videoId));
      if (ownerId && currentUser?.id === ownerId) {
        setCurrentUser(prev => prev
          ? { ...prev, jokesCount: Math.max(0, prev.jokesCount - 1) }
          : prev);
      }
      console.log('[AppContext] Video deleted:', videoId);
    },
    onError: (error: Error) => {
      console.error('[AppContext] Delete video error:', error.message);
    },
  });

  const deleteVideo = useCallback((videoId: string, videoUri: string) => {
    const ownerId = videos.find(v => v.id === videoId)?.userId;
    deleteVideoMutation.mutate({ videoId, videoUri, ownerId });
  }, [deleteVideoMutation, videos]);

  const isFollowing = useCallback((userId: string) => {
    return followingIds.includes(userId);
  }, [followingIds]);

  const getJokeReactions = useCallback((jokeId: string) => {
    return myReactions[jokeId] || [];
  }, [myReactions]);

  const getMyRating = useCallback((jokeId: string) => {
    return myRatings[jokeId] ?? 0;
  }, [myRatings]);

  const totalReactions = useCallback((joke: Joke) => {
    return Object.values(joke.reactions).reduce((sum, count) => sum + count, 0);
  }, []);

  const subscribeMutation = useMutation({
    mutationFn: async ({ sub, plan }: { sub: boolean; plan?: SubscriptionPlan }) => {
      await AsyncStorage.setItem(STORAGE_KEYS.SUBSCRIPTION, sub ? 'true' : 'false');
      if (plan) {
        await AsyncStorage.setItem(STORAGE_KEYS.SUBSCRIPTION_PLAN, plan);
      } else if (!sub) {
        await AsyncStorage.removeItem(STORAGE_KEYS.SUBSCRIPTION_PLAN);
      }
      return { sub, plan: plan || null };
    },
    onSuccess: (val) => {
      setIsSubscribed(val.sub);
      setSubscriptionPlan(val.plan);
    },
  });

  const subscribe = useCallback((val: boolean, plan?: SubscriptionPlan) => {
    subscribeMutation.mutate({ sub: val, plan });
  }, [subscribeMutation]);

  const incrementListenMutation = useMutation({
    mutationFn: async () => {
      const newCount = listenCount + 1;
      await AsyncStorage.setItem(STORAGE_KEYS.LISTEN_COUNT, newCount.toString());
      return newCount;
    },
    onSuccess: (val) => setListenCount(val),
  });

  const incrementListenCount = useCallback(() => {
    incrementListenMutation.mutate();
  }, [incrementListenMutation]);

  const incrementCreateMutation = useMutation({
    mutationFn: async () => {
      const newCount = createCount + 1;
      await AsyncStorage.setItem(STORAGE_KEYS.CREATE_COUNT, newCount.toString());
      return newCount;
    },
    onSuccess: (val) => setCreateCount(val),
  });

  const incrementCreateCount = useCallback(() => {
    incrementCreateMutation.mutate();
  }, [incrementCreateMutation]);

  const sendTipMutation = useMutation({
    mutationFn: async ({ toUserId, amount }: { toUserId: string; amount: number }) => {
      const updated = { ...tipsBalance };
      updated[toUserId] = (updated[toUserId] || 0) + amount;
      await AsyncStorage.setItem(STORAGE_KEYS.TIPS_BALANCE, JSON.stringify(updated));
      return updated;
    },
    onSuccess: (val) => setTipsBalance(val),
  });

  const sendTip = useCallback((toUserId: string, amount: number) => {
    sendTipMutation.mutate({ toUserId, amount });
  }, [sendTipMutation]);

  const canListen = useCallback(() => {
    return true;
  }, []);

  const canCreate = useCallback(() => {
    return !!currentUser;
  }, [currentUser]);

  const getTipsForUser = useCallback((userId: string) => {
    return tipsBalance[userId] || 0;
  }, [tipsBalance]);

  const toggleAdminMutation = useMutation({
    mutationFn: async (admin: boolean) => {
      await AsyncStorage.setItem(STORAGE_KEYS.IS_ADMIN, admin ? 'true' : 'false');
      return admin;
    },
    onSuccess: (val) => setIsAdmin(val),
  });

  const toggleAdmin = useCallback((val: boolean) => {
    toggleAdminMutation.mutate(val);
  }, [toggleAdminMutation]);

  const updateSettingsMutation = useMutation({
    mutationFn: async (newSettings: AppSettings) => {
      await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(newSettings));
      return newSettings;
    },
    onSuccess: (s) => setSettings(s),
  });

  const updateSettings = useCallback((newSettings: AppSettings) => {
    updateSettingsMutation.mutate(newSettings);
  }, [updateSettingsMutation]);

  const acceptPreamble = useCallback(async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.PREAMBLE_ACCEPTED, 'true');
    setPreambleAccepted(true);
    queryClient.setQueryData(['preamble-accepted'], true);
  }, [queryClient]);

  const isUserBlocked = useCallback(
    (userId: string) => blockedUserIds.includes(userId),
    [blockedUserIds]
  );

  const blockUser = useCallback(
    async (userId: string, username?: string) => {
      if (!currentUser?.id || userId === currentUser.id) return;
      await blockUserInStorage(currentUser.id, userId, username);
      const updated = await getBlockedUsers(currentUser.id);
      setBlockedUsers(updated);
      setBlockedUserIds(updated.map((e) => e.id));
      queryClient.setQueryData(['blocked-users', currentUser.id], updated);
    },
    [currentUser?.id, queryClient]
  );

  const unblockUser = useCallback(
    async (userId: string) => {
      if (!currentUser?.id) return;
      await unblockUserInStorage(currentUser.id, userId);
      const updated = await getBlockedUsers(currentUser.id);
      setBlockedUsers(updated);
      setBlockedUserIds(updated.map((e) => e.id));
      queryClient.setQueryData(['blocked-users', currentUser.id], updated);
    },
    [currentUser?.id, queryClient]
  );

  const reportContent = useCallback(
    async (payload: Omit<ReportPayload, 'reporterId'>): Promise<boolean> => {
      if (!currentUser?.id) return false;
      return submitReport({ ...payload, reporterId: currentUser.id });
    },
    [currentUser?.id]
  );

  const refreshJokes = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['jokes-list'] });
  }, [queryClient]);

  const refreshVideos = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['videos-list'] });
  }, [queryClient]);

  const refreshImageJokes = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['image-jokes-list'] });
  }, [queryClient]);

  const publishImageJokeMutation = useMutation({
    mutationFn: async ({ title, localImageUri }: { title: string; localImageUri: string }) => {
      if (!currentUser?.id) throw new Error('Not authenticated');
      if (!currentUser.isAdmin) throw new Error('Admin access required');
      return publishImageJokeToDB(title, localImageUri, currentUser.id);
    },
    onSuccess: (joke) => {
      setImageJokes((prev) => [joke, ...prev]);
      queryClient.setQueryData<ImageJoke[]>(['image-jokes-list'], (prev) => [joke, ...(prev ?? [])]);
    },
  });

  const deleteImageJokeMutation = useMutation({
    mutationFn: async (joke: ImageJoke) => {
      if (!currentUser?.isAdmin) throw new Error('Admin access required');
      await deleteImageJokeFromDB(joke);
      return joke.id;
    },
    onSuccess: (jokeId) => {
      setImageJokes((prev) => prev.filter((j) => j.id !== jokeId));
      queryClient.setQueryData<ImageJoke[]>(['image-jokes-list'], (prev) =>
        (prev ?? []).filter((j) => j.id !== jokeId)
      );
    },
  });

  const publishImageJoke = useCallback(
    async (title: string, localImageUri: string) => {
      return publishImageJokeMutation.mutateAsync({ title, localImageUri });
    },
    [publishImageJokeMutation]
  );

  const deleteImageJoke = useCallback(
    async (joke: ImageJoke) => {
      await deleteImageJokeMutation.mutateAsync(joke);
    },
    [deleteImageJokeMutation]
  );

  // ─── Global audio play / pause ────────────────────────────────────────────

  // When audio finishes, clear playing state
  useEffect(() => {
    if (globalAudioStatus.didJustFinish) {
      pendingPlay.current = false;
      setPlayingJokeId(null);
    }
  }, [globalAudioStatus.didJustFinish]);

  // When audio becomes loaded AND we have a pending play request → start playing
  useEffect(() => {
    if (pendingPlay.current) {
      if (!globalAudioStatus.isLoaded) {
        seenUnloaded.current = true;
      }
      
      if (globalAudioStatus.isLoaded && !globalAudioStatus.playing && seenUnloaded.current) {
        console.log('[Audio] Source loaded — starting playback now. Player ID:', globalPlayer.id, 'Loaded:', globalAudioStatus.isLoaded);
        pendingPlay.current = false;
        globalPlayer.volume = 1.0;
        console.log('[Audio] Setting volume to 1.0 and calling play()');
        try {
          globalPlayer.play();
        } catch (err) {
          console.error('[Audio] Play error:', err);
        }
      }
    }
  }, [globalAudioStatus.isLoaded, globalAudioStatus.playing, globalPlayer]);

  const playJoke = useCallback((joke: Joke) => {
    if (!joke.audioUri) {
      console.log('[Audio] No audioUri for joke:', joke.id);
      return;
    }
    
    // If it's already the current joke, just resume playing
    if (playingJokeId === joke.id) {
      console.log('[Audio] Resuming current joke:', joke.id);
      try {
        globalPlayer.play();
      } catch (err) {
        console.error('[Audio] Resume play error:', err);
      }
      return;
    }

    console.log('[Audio] Loading joke:', joke.id, 'uri:', joke.audioUri);
    setPlayingJokeId(joke.id);
    
    seenUnloaded.current = false;
    pendingPlay.current = true;
    
    // On Android, ensure audio mode is set properly for playback before loading.
    // Use 'doNotMix' to force the system to give us exclusive audio focus and full volume.
    if (Platform.OS === 'android') {
      setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: false,
        shouldRouteThroughEarpiece: false,
        interruptionMode: 'doNotMix',
        shouldPlayInBackground: true,
      }).catch(err => console.log('[Audio] Android audio mode setup error:', err));
    }
    
    try {
      globalPlayer.replace({ uri: joke.audioUri });
    } catch (err) {
      console.error('[Audio] Replace error:', err);
      pendingPlay.current = false;
      setPlayingJokeId(null);
      return;
    }

    // Fallback: if it's a fast local load and isLoaded never becomes false
    const timeoutId = setTimeout(() => {
      if (pendingPlay.current) {
        console.log('[Audio] Fallback check after 1000ms. isLoaded:', globalPlayer.currentStatus?.isLoaded);
        seenUnloaded.current = true;
        if (globalPlayer.currentStatus?.isLoaded) {
          console.log('[Audio] Fallback play trigger executed');
          pendingPlay.current = false;
          try {
            globalPlayer.volume = 1.0;
            globalPlayer.play();
          } catch (err) {
            console.error('[Audio] Fallback play error:', err);
            setPlayingJokeId(null);
          }
        }
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [globalPlayer, playingJokeId]);

  const pauseAudio = useCallback(() => {
    console.log('[Audio] Pausing');
    pendingPlay.current = false;
    globalPlayer.pause();
  }, [globalPlayer]);

  return useMemo(() => ({
    currentUser,
    isAuthenticated,
    authChecked,
    authError,
    jokes,
    videos,
    imageJokes,
    visibleJokes,
    visibleVideos,
    followingIds,
    playingJokeId,
    setPlayingJokeId,
    playJoke,
    pauseAudio,
    globalAudioStatus,
    login,
    register,
    logout,
    deleteAccount,
    updateProfile,
    isUpdatingProfile: updateProfileMutation.isPending,
    toggleFollow,
    addReaction,
    rateJoke,
    addJoke,
    addVideo,
    updateJokeCommentsCount,
    deleteJoke,
    deleteVideo,
    isDeletingJoke: deleteJokeMutation.isPending,
    isDeletingVideo: deleteVideoMutation.isPending,
    isFollowing,
    getJokeReactions,
    getMyRating,
    totalReactions,
    isSubscribed,
    subscriptionPlan,
    subscribe,
    listenCount,
    createCount,
    incrementListenCount,
    incrementCreateCount,
    canListen,
    canCreate,
    sendTip,
    getTipsForUser,
    tipsBalance,
    isAdmin,
    toggleAdmin,
    settings,
    updateSettings,
    preambleAccepted,
    acceptPreamble,
    blockedUserIds,
    blockedUsers,
    blockUser,
    unblockUser,
    isUserBlocked,
    reportContent,
    backendAvailable: dbReady,
    directDBAvailable: dbReady,
    refreshJokes,
    refreshVideos,
    refreshImageJokes,
    publishImageJoke,
    deleteImageJoke,
    isPublishingImageJoke: publishImageJokeMutation.isPending,
    isDeletingImageJoke: deleteImageJokeMutation.isPending,
    totalUsers,
    isLoading: authQuery.isLoading,
    isRegistering: authMutation.isPending && (authMutation.variables as any)?.type === 'register',
    isLoggingIn: authMutation.isPending && (authMutation.variables as any)?.type === 'login',
    isLoggingOut: logoutMutation.isPending,
    isDeletingAccount: deleteMutation.isPending,
    requestPasswordReset,
    confirmPasswordReset,
    isRequestingReset: requestPasswordResetMutation.isPending,
    isConfirmingReset: confirmPasswordResetMutation.isPending,
    isPasswordRecovery,
    setIsPasswordRecovery,
  }), [
    currentUser, isAuthenticated, authChecked, authError, jokes, videos, imageJokes, visibleJokes, visibleVideos, followingIds,
    playingJokeId, playJoke, pauseAudio, globalAudioStatus,
    login, register, logout, deleteAccount, updateProfile, updateProfileMutation.isPending, toggleFollow,
    addReaction, rateJoke, addJoke, addVideo, updateJokeCommentsCount, deleteJoke, deleteVideo, deleteJokeMutation.isPending, deleteVideoMutation.isPending, isFollowing, getJokeReactions, getMyRating,
    totalReactions, isSubscribed, subscriptionPlan, subscribe,
    listenCount, createCount, incrementListenCount, incrementCreateCount,
    canListen, canCreate, sendTip, getTipsForUser, tipsBalance,
    isAdmin, toggleAdmin,
    settings, updateSettings, preambleAccepted, acceptPreamble,
    blockedUserIds, blockedUsers, blockUser, unblockUser, isUserBlocked, reportContent,
    dbReady,
    refreshJokes, refreshVideos, refreshImageJokes, publishImageJoke, deleteImageJoke,
    publishImageJokeMutation.isPending, deleteImageJokeMutation.isPending,
    totalUsers, authQuery.isLoading, authMutation.isPending, authMutation.variables,
    logoutMutation.isPending, deleteMutation.isPending,
    requestPasswordReset, confirmPasswordReset,
    requestPasswordResetMutation.isPending, confirmPasswordResetMutation.isPending,
    isPasswordRecovery, setIsPasswordRecovery,
  ]);
});
