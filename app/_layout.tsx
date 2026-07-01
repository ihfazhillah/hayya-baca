import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { UpdateProvider } from "../src/context/UpdateContext";
import { UpdateBar } from "../src/components/UpdateBar";
import { View, StyleSheet, AppState, Platform } from "react-native";
import { useEffect, useRef } from "react";
import { syncAll, attachSessionSyncTrigger, attachNetInfoReconnectTrigger } from "../src/lib/sync";
import { syncContent } from "../src/lib/content-manager";
import { getSelectedChild } from "../src/lib/session";
import { setSetting } from "../src/lib/database";

const queryClient = new QueryClient();

export default function RootLayout() {
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    // Pull content manifest and record outcome (don't swallow silently).
    const runContentSync = () => {
      syncContent()
        .then((r) => {
          setSetting(
            "last_content_sync",
            `downloaded=${r.downloaded} removed=${r.removed} errors=${r.errors}`
          );
        })
        .catch((e) => {
          setSetting("last_content_sync", `error: ${e?.message ?? e}`);
        });
    };

    // Sync on mount (no active child yet — just pull children list)
    syncAll().then((report) => {
      setSetting("last_sync_status", report.success ? "ok" : report.errors.join("; "));
    }).catch(() => {});
    // Sync content manifest in background
    runContentSync();

    // MC-2: Flush ALL children on foreground, not just active child.
    // Profile switch already triggers sync via attachSessionSyncTrigger.
    // This ensures queued data for every child gets pushed.
    const sub = AppState.addEventListener("change", (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === "active") {
        syncAll().then((report) => {
          setSetting("last_sync_status", report.success ? "ok" : report.errors.join("; "));
        }).catch(() => {});
        // Content can change server-side while the app is backgrounded — re-pull
        // so new books/articles/quizzes show up without a full app restart.
        runContentSync();
      }
      appState.current = nextState;
    });
    // Trigger sync when the active child changes (e.g. user picks a profile)
    const detachSession = attachSessionSyncTrigger();
    // Flush the queue the moment connectivity is restored.
    const detachNetInfo = attachNetInfoReconnectTrigger();

    // Periodic background sync every 5 minutes — catches data that accumulates
    // while user is in-activity (reading a book). Only on foreground to avoid
    // background execution limits on iOS/Android.
    const interval = setInterval(() => {
      if (AppState.currentState === "active") {
        syncAll().catch(() => {});
      }
    }, 5 * 60 * 1000);

    return () => {
      sub.remove();
      detachSession();
      detachNetInfo();
      clearInterval(interval);
    };
  }, []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <UpdateProvider>
          <StatusBar style="light" />
          <View style={styles.container}>
            <Stack
              screenOptions={{
                headerShown: false,
              }}
            />
            <UpdateBar />
          </View>
        </UpdateProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
