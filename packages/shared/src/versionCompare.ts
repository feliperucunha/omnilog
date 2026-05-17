export function parseAppVersion(version: string): [number, number, number] | null {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(version.trim());
  if (!m) return null;
  return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
}

export function isAppVersionOlder(clientVersion: string, requiredVersion: string): boolean {
  const client = parseAppVersion(clientVersion);
  const required = parseAppVersion(requiredVersion);
  if (client == null || required == null) {
    return clientVersion.trim() !== requiredVersion.trim();
  }
  if (client[0] !== required[0]) return client[0] < required[0];
  if (client[1] !== required[1]) return client[1] < required[1];
  if (client[2] !== required[2]) return client[2] < required[2];
  return false;
}
