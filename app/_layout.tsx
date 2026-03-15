import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { UpdateProvider } from "../src/context/UpdateContext";
import { UpdateBar } from "../src/components/UpdateBar";
import { View, StyleSheet, AppState } from "react-native";
import { useEffect, useRef } from "react";
import { syncAll } from "../src/lib/sync";
import { syncContent } from "../src/lib/content-manager";
import { getSelectedChild } from "../src/lib/session";

const queryClient = new QueryClient();

export default function RootLayout() {
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    // Sync on mount (no active child yet — just pull children list)
    syncAll();
    // Sync content manifest in background
    syncContent().catch(() => {});

    // Sync when app comes to foreground (with active child if selected)
    const sub = AppState.addEventListener("change", (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === "active") {
        syncAll(getSelectedChild()?.id);
      }
      appState.current = nextState;
    });
    return () => sub.remove();
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
