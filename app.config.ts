import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Hayya Baca",
  slug: "hayya-baca",
  version: "1.0.8",
  orientation: "default",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  scheme: "hayya-baca",
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    package: "com.ihfazh.hayyabaca",
    permissions: ["android.permission.REQUEST_INSTALL_PACKAGES"],
  },
  plugins: [
    "expo-router",
    "expo-font",
    "expo-sqlite",
    [
      "expo-speech-recognition",
      {
        microphonePermission:
          "Hayya Baca membutuhkan mikrofon untuk mendengarkan bacaan anak.",
        speechRecognitionPermission:
          "Hayya Baca membutuhkan speech recognition untuk mencocokkan bacaan.",
      },
    ],
  ],
  extra: {
    apiBaseUrl: process.env.API_BASE_URL || "",
  },
});
