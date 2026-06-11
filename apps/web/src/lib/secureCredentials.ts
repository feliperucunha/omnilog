import { isNativePlatform } from "@/lib/storage";

const CREDENTIALS_SERVER = "app.geeklogs.com";

type BiometricPromptCopy = {
  reason: string;
  title: string;
  subtitle?: string;
  description?: string;
  negativeButtonText?: string;
};

async function loadNativeBiometric() {
  const { NativeBiometric } = await import("@capgo/capacitor-native-biometric");
  return NativeBiometric;
}

export async function isSecureCredentialStorageAvailable(): Promise<boolean> {
  if (!isNativePlatform()) return false;
  try {
    const NativeBiometric = await loadNativeBiometric();
    const result = await NativeBiometric.isAvailable({ useFallback: true });
    return result.isAvailable;
  } catch {
    return false;
  }
}

export async function hasSecureCredentials(): Promise<boolean> {
  if (!isNativePlatform()) return false;
  try {
    const NativeBiometric = await loadNativeBiometric();
    const { isSaved } = await NativeBiometric.isCredentialsSaved({
      server: CREDENTIALS_SERVER,
    });
    return isSaved;
  } catch {
    return false;
  }
}

export async function saveSecureCredentials(
  username: string,
  password: string
): Promise<void> {
  const NativeBiometric = await loadNativeBiometric();
  await NativeBiometric.setCredentials({
    username,
    password,
    server: CREDENTIALS_SERVER,
  });
}

export async function loadSecureCredentials(
  prompt: BiometricPromptCopy
): Promise<{ username: string; password: string } | null> {
  try {
    const NativeBiometric = await loadNativeBiometric();
    await NativeBiometric.verifyIdentity({
      reason: prompt.reason,
      title: prompt.title,
      subtitle: prompt.subtitle,
      description: prompt.description,
      negativeButtonText: prompt.negativeButtonText,
      useFallback: true,
    });
    return await NativeBiometric.getCredentials({ server: CREDENTIALS_SERVER });
  } catch {
    return null;
  }
}

export async function clearSecureCredentials(): Promise<void> {
  if (!isNativePlatform()) return;
  try {
    const NativeBiometric = await loadNativeBiometric();
    await NativeBiometric.deleteCredentials({ server: CREDENTIALS_SERVER });
  } catch {
    // ignore
  }
}
