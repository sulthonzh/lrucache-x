# lrucache-x

Zero-dependency LRU cache for Node.js. TTL support, eviction callbacks, stats tracking, and a clean API.

## Why

Every project needs an LRU cache eventually. Most implementations are either over-engineered (with a separate doubly-linked list class) or under-featured (no TTL, no stats). This one hits the sweet spot: **all the features you actually use, zero dependencies, ~150 lines of code.**

The trick: we use `Map`'s insertion-order iteration as our recency list. No custom linked list needed. `get()` deletes and re-inserts to move to MRU position. Clean and fast.

## Install

```bash
npm install lrucache-x
```

## Quick start

```javascript
import { createCache } from 'lrucache-x';

const cache = createCache({ max: 100, ttl: 60000 });

cache.set('user:1', { name: 'Ada', age: 36 });
cache.set('user:2', { name: 'Grace', age: 85 });

cache.get('user:1'); // { name: 'Ada', age: 36 }
cache.has('user:3'); // false

// After 60 seconds, entries expire automatically (lazy eviction on access)
```

## API

### `createCache(opts?)`

Create a new cache instance.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `max` | `number` | `1000` | Maximum entries before LRU eviction |
| `ttl` | `number` | `0` | Default TTL in ms (0 = no expiration) |
| `onEvict` | `function` | `null` | Called as `fn(key, value, reason)` on eviction |
| `trackStats` | `boolean` | `false` | Track hit/miss/eviction counters |

Returns a cache object with these methods:

### `get(key)` → `value | undefined`
Get a value and mark it as recently used. Returns `undefined` for missing or expired keys.

### `peek(key)` → `value | undefined`
Get a value **without** updating recency. Useful for inspection without affecting eviction order.

### `set(key, value, opts?)` → `boolean`
Store a value. `opts.ttl` overrides the default TTL for this entry. Returns `true` if a new entry was created.

### `has(key)` → `boolean`
Check existence without updating recency. Lazily evicts expired keys.

### `del(key)` → `boolean`
Delete a key. Returns `true` if it existed.

### `clear()` → `number`
Remove all entries. Returns the count removed.

### `size()` → `number`
Current entry count.

### `keys()` → `array`
All keys in MRU order (most recent first).

### `entries()` → `array`
All `[key, value]` pairs in MRU order.

### `getOrSet(key, factory, opts?)` → `value`
Get existing value, or compute via `factory(key)`, store, and return.

### `purgeExpired()` → `number`
Remove all expired entries. Returns count purged.

### `getStats()` → `object | null`
Returns `{ hits, misses, sets, gets, deletes, evictions, expirations, hitRate, size, maxSize }` or `null` if tracking disabled.

### `resetStats()`
Zero all counters (size stays).

## Examples

### Cache with TTL and eviction callback

```javascript
const cache = createCache({
  max: 500,
  ttl: 30000,
  onEvict: (key, value, reason) => {
    console.log(`${reason}: ${key}`);
  },
});

// Each eviction logs: "evicted: oldKey" or "expired: timedOutKey"
```

### Per-entry TTL

```javascript
const cache = createCache();

cache.set('quick', 'data', { ttl: 5000 });   // expires in 5s
cache.set('slow', 'data', { ttl: 300000 });   // expires in 5min
cache.set('permanent', 'data');                // never expires
```

### Stats for cache tuning

```javascript
const cache = createCache({ max: 100, trackStats: true });

// ... use cache ...

const stats = cache.getStats();
console.log(`Hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);
console.log(`Evictions: ${stats.evictions}`);

if (stats.hitRate < 0.5) {
  console.log('Cache is cold — maybe increase max size?');
}
```

### Memoization with getOrSet

```javascript
const cache = createCache({ ttl: 60000 });

function getUser(id) {
  return cache.getOrSet(`user:${id}`, async (key) => {
    const res = await fetch(`/api/users/${id}`);
    return res.json();
  });
}
```

## How it works

Uses `Map`'s guaranteed insertion-order iteration as the recency list:

- **New entries** are added to the end (MRU position)
- **Accessed entries** are deleted and re-inserted (moves to end)
- **Eviction** takes from the beginning (LRU position)

No custom doubly-linked list. No pointer juggling. Just `Map.delete()` + `Map.set()`.

TTL is lazy: expired entries are cleaned up on access (`get`, `has`, `peek`). Use `purgeExpired()` for eager cleanup.

## License

MIT
