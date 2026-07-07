# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2026-07-08

### Added
- 27 edge-case tests (32 → 59 total): `has()` lazy eviction, `set()` return values, `peek()` with expired keys, `del()`/`clear()` onEvict behavior, TTL edge cases (ttl=0 override, purgeExpired with onEvict), `getOrSet` with opts/undefined factory, stats edge cases (deletes tracking, expirations vs evictions, hitRate on empty), empty cache operations, large cache stress (10k entries)
- CHANGELOG.md
- STATUS.md (exceptional checklist audit)

### Changed
- Test coverage improved: 98.43% → 100% lines, 85.88% → 95.35% branches on `src/index.mjs`

## [1.0.0] - 2026-06-22

### Added
- Initial release: zero-dependency LRU cache with TTL, eviction callbacks, and stats tracking
- `createCache()` factory with `max`, `ttl`, `onEvict`, `trackStats` options
- Methods: `get`, `peek`, `set`, `has`, `del`, `clear`, `size`, `keys`, `entries`, `getOrSet`, `purgeExpired`, `getStats`, `resetStats`
- Uses `Map` insertion-order iteration for O(1) recency management
