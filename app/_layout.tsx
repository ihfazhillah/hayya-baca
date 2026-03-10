import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { UpdateProvider } from "../src/context/UpdateContext";
import { UpdateBar } from "../src/components/UpdateBar";
import { View, StyleSheet } from "react-native";

const queryClient = new QueryClient();

export default function RootLayout() {
  return (
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
