export function createId(prefix: string): string {
  const maybeCrypto = globalThis as {
    crypto?: {
      randomUUID?: () => string;
    };
  };

  const suffix =
    maybeCrypto.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

  return `${prefix}_${suffix.replace(/-/g, "")}`;
}
