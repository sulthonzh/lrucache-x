import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createCache } from '../src/index.mjs';

describe('Basic operations', () => {
  it('set and get', () => {
    const c = createCache();
    c.set('a', 1);
    assert.equal(c.get('a'), 1);
  });

  it('returns undefined for missing keys', () => {
    const c = createCache();
    assert.equal(c.get('nope'), undefined);
  });

  it('has() checks existence without recency update', () => {
    const c = createCache({ max: 2 });
    c.set('a', 1);
    c.set('b', 2);
    assert.equal(c.has('a'), true);
    assert.equal(c.has('c'), false);
  });

  it('del removes entries', () => {
    const c = createCache();
    c.set('a', 1);
    assert.equal(c.del('a'), true);
    assert.equal(c.get('a'), undefined);
    assert.equal(c.del('a'), false);
  });

  it('clear removes all entries', () => {
    const c = createCache();
    c.set('a', 1);
    c.set('b', 2);
    assert.equal(c.clear(), 2);
    assert.equal(c.size(), 0);
  });
});

describe('LRU eviction', () => {
  it('evicts least recently used when over max', () => {
    const evicted = [];
    const c = createCache({ max: 3, onEvict: (k, v, reason) => evicted.push({ k, v, reason }) });
    c.set('a', 1);
    c.set('b', 2);
    c.set('c', 3);
    c.set('d', 4); // should evict 'a'

    assert.equal(c.has('a'), false);
    assert.equal(c.has('b'), true);
    assert.equal(c.has('c'), true);
    assert.equal(c.has('d'), true);
    assert.deepEqual(evicted, [{ k: 'a', v: 1, reason: 'evicted' }]);
  });

  it('get updates recency', () => {
    const c = createCache({ max: 3 });
    c.set('a', 1);
    c.set('b', 2);
    c.set('c', 3);
    c.get('a'); // 'a' is now MRU
    c.set('d', 4); // should evict 'b' not 'a'

    assert.equal(c.has('a'), true);
    assert.equal(c.has('b'), false);
  });

  it('set on existing key updates recency', () => {
    const c = createCache({ max: 3 });
    c.set('a', 1);
    c.set('b', 2);
    c.set('c', 3);
    c.set('a', 99); // 'a' is now MRU
    c.set('d', 4); // evict 'b'

    assert.equal(c.get('a'), 99);
    assert.equal(c.has('b'), false);
  });
});

describe('TTL', () => {
  it('per-entry TTL expires keys', async () => {
    const c = createCache();
    c.set('a', 1, { ttl: 50 });
    assert.equal(c.get('a'), 1);
    await new Promise(r => setTimeout(r, 60));
    assert.equal(c.get('a'), undefined);
  });

  it('default TTL applies to all entries', async () => {
    const c = createCache({ ttl: 50 });
    c.set('a', 1);
    assert.equal(c.get('a'), 1);
    await new Promise(r => setTimeout(r, 60));
    assert.equal(c.get('a'), undefined);
  });

  it('ttl=0 means no expiration', () => {
    const c = createCache({ ttl: 0 });
    c.set('a', 1);
    assert.equal(c.has('a'), true);
  });

  it('per-entry ttl overrides default', async () => {
    const c = createCache({ ttl: 1000 });
    c.set('a', 1, { ttl: 30 });
    c.set('b', 2); // uses default 1000
    await new Promise(r => setTimeout(r, 40));
    assert.equal(c.get('a'), undefined);
    assert.equal(c.get('b'), 2);
  });

  it('purgeExpired removes expired entries', async () => {
    const c = createCache();
    c.set('a', 1, { ttl: 30 });
    c.set('b', 2, { ttl: 30 });
    c.set('c', 3); // no ttl
    await new Promise(r => setTimeout(r, 40));
    const purged = c.purgeExpired();
    assert.equal(purged, 2);
    assert.equal(c.size(), 1);
    assert.equal(c.get('c'), 3);
  });

  it('expired keys fire onEvict with "expired" reason', async () => {
    const evicted = [];
    const c = createCache({ onEvict: (k, v, reason) => evicted.push({ k, v, reason }) });
    c.set('a', 1, { ttl: 30 });
    await new Promise(r => setTimeout(r, 40));
    c.get('a'); // triggers lazy eviction
    assert.deepEqual(evicted, [{ k: 'a', v: 1, reason: 'expired' }]);
  });
});

describe('peek', () => {
  it('does not update recency', () => {
    const c = createCache({ max: 3 });
    c.set('a', 1);
    c.set('b', 2);
    c.set('c', 3);
    c.peek('a'); // peek does NOT update recency
    c.set('d', 4); // should evict 'a' since it wasn't accessed

    assert.equal(c.has('a'), false);
  });

  it('returns undefined for missing keys', () => {
    const c = createCache();
    assert.equal(c.peek('nope'), undefined);
  });
});

describe('getOrSet', () => {
  it('returns existing value without calling factory', () => {
    const c = createCache();
    c.set('a', 1);
    let called = false;
    const result = c.getOrSet('a', () => { called = true; return 2; });
    assert.equal(result, 1);
    assert.equal(called, false);
  });

  it('computes and stores new value', () => {
    const c = createCache();
    const result = c.getOrSet('a', (k) => `computed-${k}`);
    assert.equal(result, 'computed-a');
    assert.equal(c.get('a'), 'computed-a');
  });
});

describe('keys and entries', () => {
  it('keys returns in MRU order', () => {
    const c = createCache();
    c.set('a', 1);
    c.set('b', 2);
    c.set('c', 3);
    c.get('a'); // a is now MRU
    assert.deepEqual(c.keys(), ['a', 'c', 'b']);
  });

  it('entries returns in MRU order', () => {
    const c = createCache();
    c.set('a', 1);
    c.set('b', 2);
    assert.deepEqual(c.entries(), [['b', 2], ['a', 1]]);
  });
});

describe('Stats', () => {
  it('tracks hits and misses', () => {
    const c = createCache({ trackStats: true });
    c.set('a', 1);
    c.get('a'); // hit
    c.get('b'); // miss
    const s = c.getStats();
    assert.equal(s.hits, 1);
    assert.equal(s.misses, 1);
    assert.equal(s.sets, 1);
    assert.equal(s.gets, 2);
    assert.equal(s.hitRate, 0.5);
  });

  it('tracks evictions', () => {
    const c = createCache({ max: 2, trackStats: true });
    c.set('a', 1);
    c.set('b', 2);
    c.set('c', 3); // evict a
    const s = c.getStats();
    assert.equal(s.evictions, 1);
  });

  it('resetStats zeros counters', () => {
    const c = createCache({ trackStats: true });
    c.set('a', 1);
    c.get('a');
    c.resetStats();
    const s = c.getStats();
    assert.equal(s.hits, 0);
    assert.equal(s.misses, 0);
    assert.equal(s.sets, 0);
    assert.equal(s.size, 1); // size is not a counter, stays
  });

  it('returns null when tracking disabled', () => {
    const c = createCache();
    assert.equal(c.getStats(), null);
  });
});

describe('Edge cases', () => {
  it('max=1 evicts immediately', () => {
    const c = createCache({ max: 1 });
    c.set('a', 1);
    c.set('b', 2);
    assert.equal(c.has('a'), false);
    assert.equal(c.get('b'), 2);
  });

  it('throws for max < 1', () => {
    assert.throws(() => createCache({ max: 0 }), RangeError);
  });

  it('throws for negative ttl', () => {
    assert.throws(() => createCache({ ttl: -1 }), RangeError);
  });

  it('supports object keys via string coercion', () => {
    const c = createCache();
    c.set('complex', { nested: { data: [1, 2, 3] } });
    assert.deepEqual(c.get('complex'), { nested: { data: [1, 2, 3] } });
  });

  it('clear returns count of cleared entries', () => {
    const c = createCache();
    c.set('a', 1);
    c.set('b', 2);
    c.set('c', 3);
    assert.equal(c.clear(), 3);
  });

  it('size reflects current entries', () => {
    const c = createCache();
    assert.equal(c.size(), 0);
    c.set('a', 1);
    assert.equal(c.size(), 1);
    c.del('a');
    assert.equal(c.size(), 0);
  });

  it('max and ttl getters work', () => {
    const c = createCache({ max: 50, ttl: 100 });
    assert.equal(c.max, 50);
    assert.equal(c.ttl, 100);
  });
});

describe('Multiple evictions', () => {
  it('evicts in LRU order', () => {
    const c = createCache({ max: 3 });
    c.set('a', 1);
    c.set('b', 2);
    c.set('c', 3);
    // order: a(oldest) -> b -> c(newest)
    c.get('a'); // a -> b -> c -> a... no, a is now MRU
    // order now: b(oldest) -> c -> a(newest)
    c.set('d', 4); // evict b
    c.set('e', 5); // evict c
    assert.equal(c.has('a'), true);
    assert.equal(c.has('b'), false);
    assert.equal(c.has('c'), false);
    assert.equal(c.has('d'), true);
    assert.equal(c.has('e'), true);
  });
});
