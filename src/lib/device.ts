import * as Device from "expo-device";
import * as Crypto from "expo-crypto";
import { getSetting, setSetting } from "./database";

let cachedDeviceId: string | null = null;

export async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;

  const stored = await getSetting("device_id");
  if (stored) {
    cachedDeviceId = stored;
    return stored;
  }

  const id = Crypto.randomUUID();
  await setSetting("device_id", id);
  cachedDeviceId = id;
  return id;
}

export function getDeviceName(): string {
  return Device.modelName ?? "Unknown";
}
