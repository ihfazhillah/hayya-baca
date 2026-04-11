// Jest config for e2e tests against real local Django backend.
// Use via: scripts/e2e-backend.sh (spins up isolated backend, runs this config).
module.exports = {
  preset: "jest-expo",
  rootDir: __dirname,
  testMatch: ["<rootDir>/src/__tests__/e2e-sync-backend.test.ts"],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|@tanstack/.*|fuzzball)",
  ],
  setupFilesAfterEnv: ["<rootDir>/src/__tests__/e2e.setup.ts"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx"],
  testTimeout: 30000,
};
