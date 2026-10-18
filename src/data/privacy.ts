import { Capacitor, registerPlugin } from "@capacitor/core";

export type SavingsProtection = "auto" | "required" | "hidden";
export interface SavingsPrivacyStatus {
  native: boolean;
  available: boolean;
}
const Privacy = registerPlugin<{
  status(): Promise<{ available: boolean }>;
  authenticate(): Promise<{ authenticated: boolean }>;
  setPrivateScreen(options: { enabled: boolean }): Promise<void>;
}>("SavingsPrivacy");

export async function savingsPrivacyStatus(): Promise<SavingsPrivacyStatus> {
  if (!Capacitor.isNativePlatform()) return { native: false, available: false };
  const status = await Privacy.status();
  return { native: true, available: status.available };
}
export async function unlockSavings(
  protection: SavingsProtection,
): Promise<void> {
  if (protection === "hidden" || !Capacitor.isNativePlatform()) return;
  const status = await savingsPrivacyStatus();
  if (!status.available) {
    if (protection === "required")
      throw new Error("Set up your Android screen lock to unlock Savings.");
    return;
  }
  const result = await Privacy.authenticate();
  if (!result.authenticated) throw new Error("Savings remains locked.");
}
export async function privateSavingsScreen(enabled: boolean): Promise<void> {
  if (Capacitor.isNativePlatform()) await Privacy.setPrivateScreen({ enabled });
}
