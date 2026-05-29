import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet, Text, TouchableOpacity } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { setAudioModeAsync } from "expo-audio";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AppProvider, useApp } from "@/contexts/AppContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import Colors from "@/constants/colors";

void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const { isAuthenticated, authChecked, isPasswordRecovery, notification, dismissNotification } = useApp();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (!authChecked) return;

    const inAuthScreen = segments[0] === 'auth';

    if (isPasswordRecovery && !inAuthScreen) {
      console.log('[RootLayout] Password recovery — redirecting to auth');
      router.replace('/auth');
      return;
    }

    if (!isAuthenticated && !inAuthScreen) {
      console.log('[RootLayout] Not authenticated, redirecting to auth');
      router.replace('/auth');
    } else if (isAuthenticated && inAuthScreen && !isPasswordRecovery) {
      console.log('[RootLayout] Authenticated, redirecting to home');
      router.replace('/');
    }
  }, [isAuthenticated, authChecked, isPasswordRecovery, segments, router]);

  if (!authChecked) {
    return (
      <View style={loadingStyles.container}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.shell}>
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

      {notification && (
        <View pointerEvents="box-none" style={styles.notificationLayer}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={dismissNotification}
            style={[
              styles.notificationCard,
              notification.kind === 'success' && styles.notificationSuccess,
              notification.kind === 'error' && styles.notificationError,
              notification.kind === 'warning' && styles.notificationWarning,
              notification.kind === 'info' && styles.notificationInfo,
            ]}
          >
            <View style={styles.notificationTextWrap}>
              <Text style={styles.notificationTitle}>{notification.title}</Text>
              <Text style={styles.notificationMessage}>{notification.message}</Text>
            </View>
            <Text style={styles.notificationClose}>×</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
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

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  notificationLayer: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    zIndex: 50,
    elevation: 50,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  notificationTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  notificationTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  notificationMessage: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  notificationClose: {
    color: Colors.textMuted,
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 20,
  },
  notificationSuccess: {
    backgroundColor: Colors.success + '18',
    borderColor: Colors.success + '40',
  },
  notificationInfo: {
    backgroundColor: Colors.primary + '18',
    borderColor: Colors.primary + '40',
  },
  notificationWarning: {
    backgroundColor: Colors.warning + '18',
    borderColor: Colors.warning + '40',
  },
  notificationError: {
    backgroundColor: Colors.error + '18',
    borderColor: Colors.error + '40',
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
