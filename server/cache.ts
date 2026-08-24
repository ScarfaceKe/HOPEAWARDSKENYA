class TtlCache {
  private store = new Map<string, { value: any; expires: number }>();

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expires) { this.store.delete(key); return undefined; }
    return entry.value as T;
  }

  set(key: string, value: any, ttlMs: number): void {
    this.store.set(key, { value, expires: Date.now() + ttlMs });
  }

  del(key: string): void { this.store.delete(key); }

  clear(): void { this.store.clear(); }
}

export const apiCache = new TtlCache();
export const imgCache = new TtlCache();

export const TTL_API = 30_000;      // 30 seconds for API list/capacity responses
export const TTL_IMG = 86_400_000;  // 24 hours for uploaded images
