import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { Platform } from 'react-native';
import { User, Joke, ReactionEmoji, SubscriptionPlan } from '@/types';
import { supabase } from '@/lib/supabase';
import { setCachedUser, getCachedUser } from '@/lib/auth-storage';
import { clientRegister, clientLogin, clientDeleteAccount, clientRequestPasswordReset, clientConfirmPasswordReset, signOutSupabase, clientGetMe } from '@/lib/auth-client';
import { ensureDBReady, fetchJokesFromDB, toggleReactionInDB, rateJokeInDB, toggleFollowInDB, deleteJokeFromDB, ensureUserRecordExists, uploadAvatarToSupabase, updateUserProfile } from '@/lib/db-client';
import { isSupabaseConfigured } from '@/lib/supabase';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

const STORAGE_KEYS = {
  SUBSCRIPTION: 'joky_subscription',
  SUBSCRIPTION_PLAN: 'joky_subscription_plan',
  IS_ADMIN: 'joky_is_admin',
  SETTINGS: 'joky_settings',
  LISTEN_COUNT: 'joky_listen_count',
  CREATE_COUNT: 'joky_create_count',
  TIPS_BALANCE: 'joky_tips_balance',
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
    queryFn: async () => {
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
        // User clicked the reset password link in their email.
        // Supabase has established a recovery session. Signal the UI to show
        // the "set new password" form.
        console.log('[AppContext] PASSWORD_RECOVERY event — showing reset form');
        setIsPasswordRecovery(true);
      } else if (event === 'SIGNED_IN' && session?.user) {
        if (!isPasswordRecovery) {
          void queryClient.invalidateQueries({ queryKey: ['auth-restore'] });
        }
      }
    });

    return () => {
      subscription.unsubscribe();
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

  useEffect(() => {
    if (authQuery.isFetched) {
      if (authQuery.data) {
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
    if (authQuery.isError) {
      console.error('[AppContext] Auth restore error:', authQuery.error);
      setAuthChecked(true);
    }
  }, [authQuery.isError, authQuery.error]);

  useEffect(() => {
    if (jokesQuery.data && jokesQuery.data.length > 0) {
      setJokes(jokesQuery.data);
      console.log('[AppContext] Loaded', jokesQuery.data.length, 'jokes from Supabase');
    }
  }, [jokesQuery.data]);

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
        role: data.user.role || 'visitor',
        badges: data.user.badges || [],
        isFollowing: data.user.isFollowing ?? false,
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
      setCurrentUser(null);
      setIsAuthenticated(false);
      queryClient.setQueryData(['auth-restore'], null);
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
  }, []);

  const deleteJokeMutation = useMutation({
    mutationFn: async ({ jokeId, audioUri }: { jokeId: string; audioUri: string }) => {
      if (dbReady) {
        await deleteJokeFromDB(jokeId, audioUri);
      }
      return jokeId;
    },
    onSuccess: (jokeId) => {
      setJokes(prev => prev.filter(j => j.id !== jokeId));
      console.log('[AppContext] Joke deleted:', jokeId);
    },
    onError: (error: Error) => {
      console.error('[AppContext] Delete joke error:', error.message);
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (updates: Partial<User> & { localAvatarUri?: string }) => {
      if (!currentUser) throw new Error('Not authenticated');
      
      let avatarUrl = updates.avatar;
      if (updates.localAvatarUri) {
        if (!dbReady) {
          throw new Error('Database not ready. Please check your connection and try again.');
        }
        try {
          avatarUrl = await uploadAvatarToSupabase(updates.localAvatarUri, currentUser.id);
          console.log('[AppContext] Avatar uploaded successfully:', avatarUrl);
        } catch (uploadErr: any) {
          console.error('[AppContext] Avatar upload failed:', uploadErr?.message);
          throw new Error(`Avatar upload failed: ${uploadErr?.message}`);
        }
      }
      
      if (avatarUrl || updates.avatar !== undefined) {
        const updatedUser = await updateUserProfile(currentUser.id, { ...updates, avatar: avatarUrl });
        return updatedUser;
      }
      
      return currentUser;
    },
    onSuccess: async (updatedUser) => {
      if (updatedUser) {
        setCurrentUser(updatedUser);
        await setCachedUser(updatedUser);
        console.log('[AppContext] Profile updated successfully');
      }
    },
    onError: (error: Error) => {
      console.error('[AppContext] Update profile error:', error.message);
    },
  });

  const updateProfile = useCallback((updates: Partial<User> & { localAvatarUri?: string }) => {
    return updateProfileMutation.mutateAsync(updates);
  }, [updateProfileMutation]);

  const deleteJoke = useCallback((jokeId: string, audioUri: string) => {
    deleteJokeMutation.mutate({ jokeId, audioUri });
  }, [deleteJokeMutation]);

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
    if (currentUser?.role !== 'creator') return false;
    return true;
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

  const refreshJokes = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['jokes-list'] });
  }, [queryClient]);

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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);
    };
  }, []);

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
    toggleFollow,
    addReaction,
    rateJoke,
    addJoke,
    deleteJoke,
    isDeletingJoke: deleteJokeMutation.isPending,
    updateProfile,
    isUpdatingProfile: updateProfileMutation.isPending,
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
    backendAvailable: dbReady,
    directDBAvailable: dbReady,
    refreshJokes,
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
    currentUser, isAuthenticated, authChecked, authError, jokes, followingIds,
    playingJokeId, playJoke, pauseAudio, globalAudioStatus,
    login, register, logout, deleteAccount, toggleFollow,
    addReaction, rateJoke, addJoke, deleteJoke, deleteJokeMutation.isPending,
    updateProfile, updateProfileMutation.isPending,
    isFollowing, getJokeReactions, getMyRating,
    totalReactions, isSubscribed, subscriptionPlan, subscribe,
    listenCount, createCount, incrementListenCount, incrementCreateCount,
    canListen, canCreate, sendTip, getTipsForUser, tipsBalance,
    isAdmin, toggleAdmin,
    settings, updateSettings, dbReady,
    refreshJokes, authQuery.isLoading, authMutation.isPending, authMutation.variables,
    logoutMutation.isPending, deleteMutation.isPending,
    requestPasswordReset, confirmPasswordReset,
    requestPasswordResetMutation.isPending, confirmPasswordResetMutation.isPending,
    isPasswordRecovery, setIsPasswordRecovery,
  ]);
});
