/**
 * lrucache-x — Zero-dep LRU cache with TTL, max size, eviction callbacks, and stats.
 *
 * Uses Map insertion order for O(1) get/set/eviction.
 */

export function createCache(opts = {}) {
  const max = opts.max ?? 1000;
  const defaultTtl = opts.ttl ?? 0;
  const onEvict = opts.onEvict ?? null;
  const trackStats = opts.trackStats ?? false;

  if (max < 1) throw new RangeError('max must be >= 1');
  if (defaultTtl < 0) throw new RangeError('ttl must be >= 0');

  const store = new Map();
  let expirations = defaultTtl > 0 ? new Map() : null;

  const stats = trackStats
    ? { hits: 0, misses: 0, evictions: 0, sets: 0, gets: 0, deletes: 0, expirations: 0 }
    : null;

  function _isExpired(key) {
    if (!expirations) return false;
    const exp = expirations.get(key);
    if (exp === undefined) return false;
    return Date.now() >= exp;
  }

  function _evictExpired(key) {
    if (!_isExpired(key)) return false;
    const val = store.get(key);
    store.delete(key);
    if (expirations) expirations.delete(key);
    if (onEvict) onEvict(key, val, 'expired');
    if (stats) { stats.expirations++; stats.evictions++; }
    return true;
  }

  function _ensureExpirations() {
    if (!expirations) expirations = new Map();
  }

  function get(key) {
    if (stats) stats.gets++;

    if (!store.has(key)) {
      if (stats) stats.misses++;
      return undefined;
    }

    if (_evictExpired(key)) {
      if (stats) stats.misses++;
      return undefined;
    }

    const val = store.get(key);
    store.delete(key);
    store.set(key, val);

    if (stats) stats.hits++;
    return val;
  }

  function peek(key) {
    if (!store.has(key)) return undefined;
    if (_evictExpired(key)) return undefined;
    return store.get(key);
  }

  function set(key, value, o = {}) {
    const isNew = !store.has(key);
    const ttl = o.ttl ?? defaultTtl;

    store.delete(key);
    store.set(key, value);

    if (ttl > 0) {
      _ensureExpirations();
      expirations.set(key, Date.now() + ttl);
    } else if (expirations) {
      expirations.delete(key);
    }

    if (stats) stats.sets++;

    while (store.size > max) {
      const oldestKey = store.keys().next().value;
      const oldestVal = store.get(oldestKey);
      store.delete(oldestKey);
      if (expirations) expirations.delete(oldestKey);
      if (onEvict) onEvict(oldestKey, oldestVal, 'evicted');
      if (stats) stats.evictions++;
    }

    return isNew;
  }

  function has(key) {
    if (!store.has(key)) return false;
    if (_isExpired(key)) {
      _evictExpired(key);
      return false;
    }
    return true;
  }

  function del(key) {
    if (!store.has(key)) return false;
    store.delete(key);
    if (expirations) expirations.delete(key);
    if (stats) stats.deletes++;
    return true;
  }

  function clear() {
    const count = store.size;
    store.clear();
    if (expirations) expirations.clear();
    return count;
  }

  function size() {
    return store.size;
  }

  function purgeExpired() {
    if (!expirations) return 0;
    let count = 0;
    const now = Date.now();
    for (const [key, exp] of expirations) {
      if (now >= exp) {
        const val = store.get(key);
        store.delete(key);
        expirations.delete(key);
        if (onEvict) onEvict(key, val, 'expired');
        if (stats) { stats.expirations++; stats.evictions++; }
        count++;
      }
    }
    return count;
  }

  function keys() {
    return [...store.keys()].reverse();
  }

  function entries() {
    return [...store.entries()].reverse();
  }

  function getOrSet(key, factory, opts) {
    const existing = get(key);
    if (existing !== undefined) return existing;
    const val = factory(key);
    set(key, val, opts);
    return val;
  }

  function getStats() {
    if (!stats) return null;
    const total = stats.hits + stats.misses;
    return {
      ...stats,
      hitRate: total > 0 ? stats.hits / total : 0,
      size: store.size,
      maxSize: max,
    };
  }

  function resetStats() {
    if (!stats) return;
    stats.hits = 0;
    stats.misses = 0;
    stats.evictions = 0;
    stats.sets = 0;
    stats.gets = 0;
    stats.deletes = 0;
    stats.expirations = 0;
  }

  return {
    get, peek, set, has, del, clear, size,
    purgeExpired, keys, entries, getOrSet,
    getStats, resetStats,
    get max() { return max; },
    get ttl() { return defaultTtl; },
  };
}

export default { createCache };
