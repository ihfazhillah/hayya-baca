// Setup for e2e tests. Mocks only native modules that can't run in Node;
// keeps fetch/network real so tests hit the local Django backend.
import "./setup"; // reuse base mocks (expo-sqlite, reanimated, etc)

// Override expo-constants to inject API_BASE_URL from harness env into
// Constants.expoConfig.extra.apiBaseUrl so api.ts's getApiBase() picks it up.
jest.mock("expo-constants", () => ({
  expoConfig: {
    version: "0.0.0-e2e",
    extra: {
      apiBaseUrl: process.env.API_BASE_URL || "http://127.0.0.1:8124/api",
    },
  },
}));

// Ensure any fetch polyfill needed — Node 18+ has global fetch, so this
// is a no-op sanity check. Fail loudly if absent.
if (typeof fetch === "undefined") {
  throw new Error("e2e tests require global fetch (Node 18+)");
}
