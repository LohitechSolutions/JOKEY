import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { setAudioModeAsync } from "expo-audio";
import * as Notifications from "expo-notifications";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AppProvider, useApp } from "@/contexts/AppContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import Colors from "@/constants/colors";
import { ensureAndroidNotificationChannel } from "@/lib/push-notifications";

void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const { isAuthenticated, authChecked, isPasswordRecovery, preambleAccepted } = useApp();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (!authChecked || preambleAccepted === null) return;

    const inAuthScreen = segments[0] === 'auth';
    const inPreambleScreen = segments[0] === 'preamble';
    const inLegalScreen = segments[0] === 'privacy' || segments[0] === 'terms';

    if (isPasswordRecovery && !inAuthScreen) {
      console.log('[RootLayout] Password recovery — redirecting to auth');
      router.replace('/auth');
      return;
    }

    if (!preambleAccepted && !inPreambleScreen && !inLegalScreen) {
      console.log('[RootLayout] Preamble not accepted — redirecting to preamble');
      router.replace('/preamble');
      return;
    }

    if (preambleAccepted && !isAuthenticated && !inAuthScreen && !inLegalScreen) {
      console.log('[RootLayout] Not authenticated, redirecting to auth');
      router.replace('/auth');
    } else if (isAuthenticated && inAuthScreen && !isPasswordRecovery) {
      console.log('[RootLayout] Authenticated, redirecting to home');
      router.replace('/');
    }
  }, [isAuthenticated, authChecked, isPasswordRecovery, preambleAccepted, segments, router]);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    void ensureAndroidNotificationChannel();

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      try {
        const data = response.notification.request.content.data as {
          contentType?: string;
          contentId?: string | null;
        };
        if (!data?.contentType) return;
        if (data.contentType === 'joke' && data.contentId) {
          router.push(`/joke/${data.contentId}`);
        } else if (data.contentType === 'video') {
          router.push('/(tabs)/videos');
        } else if (data.contentType === 'image') {
          router.push('/');
        }
      } catch (err) {
        console.warn('[RootLayout] notification tap handler failed:', err);
      }
    });

    return () => {
      sub.remove();
    };
  }, [router]);

  if (!authChecked || preambleAccepted === null) {
    return (
      <View style={loadingStyles.container}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerBackTitle: "Retour",
        headerStyle: { backgroundColor: Colors.background },
        headerTintColor: Colors.text,
        contentStyle: { backgroundColor: Colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="preamble" options={{ headerShown: false }} />
      <Stack.Screen name="auth" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="joke/[id]" options={{ title: 'Blague' }} />
      <Stack.Screen name="user/[id]" options={{ title: 'Profil' }} />
      <Stack.Screen name="settings" options={{ title: 'Paramètres' }} />

      <Stack.Screen name="admin" options={{ title: 'Administration' }} />
      <Stack.Screen name="change-password" options={{ title: 'Modifier le mot de passe' }} />
      <Stack.Screen name="delete-account" options={{ title: 'Supprimer le compte' }} />
      <Stack.Screen name="privacy" options={{ title: 'Confidentialité' }} />
      <Stack.Screen name="terms" options={{ title: "Conditions d'utilisation" }} />
      <Stack.Screen name="subscription" options={{ title: 'Abonnement' }} />
      <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

const loadingStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
});

export default function RootLayout() {
  useEffect(() => {
    void SplashScreen.hideAsync();
    
    // Ensure Android (and iOS) routes audio through the main speaker, not the earpiece,
    // and properly plays media even if the hardware switch is on silent.
    void setAudioModeAsync({
      playsInSilentMode: true,
      allowsRecording: false,
      shouldRouteThroughEarpiece: false,
      interruptionMode: 'mixWithOthers',
      shouldPlayInBackground: true,
    });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ErrorBoundary>
          <LanguageProvider>
            <AppProvider>
              <RootLayoutNav />
            </AppProvider>
          </LanguageProvider>
        </ErrorBoundary>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
