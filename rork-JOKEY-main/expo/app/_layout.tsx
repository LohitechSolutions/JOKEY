import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { setAudioModeAsync } from "expo-audio";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AppProvider, useApp } from "@/contexts/AppContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import Colors from "@/constants/colors";

void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const { isAuthenticated, authChecked } = useApp();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (!authChecked) return;

    const inAuthScreen = segments[0] === 'auth';

    if (!isAuthenticated && !inAuthScreen) {
      console.log('[RootLayout] Not authenticated, redirecting to auth');
      router.replace('/auth');
    } else if (isAuthenticated && inAuthScreen) {
      console.log('[RootLayout] Authenticated, redirecting to home');
      router.replace('/');
    }
  }, [isAuthenticated, authChecked, segments, router]);

  if (!authChecked) {
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
