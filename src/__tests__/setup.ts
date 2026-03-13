// Shared test setup — mocks for native modules

// expo-sqlite
const mockDb = {
  execAsync: jest.fn(),
  runAsync: jest.fn().mockResolvedValue({ lastInsertRowId: 1, changes: 1 }),
  getFirstAsync: jest.fn().mockResolvedValue(null),
  getAllAsync: jest.fn().mockResolvedValue([]),
};

jest.mock("expo-sqlite", () => ({
  openDatabaseAsync: jest.fn().mockResolvedValue(mockDb),
}));

// expo-router
const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
};

jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: jest.fn().mockReturnValue({}),
  Stack: ({ children }: any) => children,
}));

// expo-constants
jest.mock("expo-constants", () => ({
  expoConfig: { version: "0.1.0-test" },
}));

// expo-speech-recognition
jest.mock("expo-speech-recognition", () => ({
  ExpoSpeechRecognitionModule: {
    requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
    start: jest.fn(),
    stop: jest.fn(),
  },
  useSpeechRecognitionEvent: jest.fn(),
}));

// react-native-reanimated
jest.mock("react-native-reanimated", () => {
  const View = require("react-native").View;
  return {
    __esModule: true,
    default: {
      createAnimatedComponent: (comp: any) => comp,
      View,
    },
    useSharedValue: (v: any) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withSpring: (v: any) => v,
    withDelay: (_: any, v: any) => v,
    withTiming: (v: any) => v,
  };
});

// react-native-safe-area-context
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: ({ children }: any) => children,
  useSafeAreaInsets: () => ({ top: 48, bottom: 48, left: 0, right: 0 }),
}));

// Expose mock objects for tests to use
(global as any).__mockDb = mockDb;
(global as any).__mockRouter = mockRouter;

// Suppress console.warn in tests (sync errors etc)
jest.spyOn(console, "warn").mockImplementation(() => {});
