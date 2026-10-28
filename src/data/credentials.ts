import { Capacitor, registerPlugin } from "@capacitor/core";
const Credentials = registerPlugin<{
  save(options: { token: string }): Promise<void>;
  load(): Promise<{ token: string }>;
  clear(): Promise<void>;
}>("BackupCredentials");
export const secureTokenStorage = () => Capacitor.isNativePlatform();
export const loadBackupToken = async () =>
  secureTokenStorage() ? (await Credentials.load()).token : "";
export const storeBackupToken = async (token: string) => {
  if (secureTokenStorage()) await Credentials.save({ token });
};
export const clearBackupToken = async () => {
  if (secureTokenStorage()) await Credentials.clear();
};
