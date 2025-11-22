/**
 * Cache Module
 * Provides localStorage caching with TTL (Time To Live) support
 */

const CACHE_PREFIX = 'bakalari_cache_';

/**
 * TTL constants in milliseconds
 */
export const TTL = {
  DEFINITIONS: 7 * 24 * 60 * 60 * 1000, // 7 days
  TIMETABLE: 10 * 60 * 1000, // 10 minutes
};

/**
 * Save data to cache with TTL
 * @param {string} key - Cache key
 * @param {any} data - Data to cache
 * @param {number} ttl - Time to live in milliseconds
 */
export function setCache(key, data, ttl) {
  try {
    const cacheEntry = {
      data,
      timestamp: Date.now(),
      ttl,
    };
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(cacheEntry));
  } catch (error) {
    console.warn('Failed to save to cache:', error);
  }
}

/**
 * Get data from cache if not expired
 * @param {string} key - Cache key
 * @returns {any|null} Cached data or null if expired/not found
 */
export function getCache(key) {
  try {
    const item = localStorage.getItem(CACHE_PREFIX + key);
    if (!item) return null;

    const cacheEntry = JSON.parse(item);
    const age = Date.now() - cacheEntry.timestamp;

    if (age > cacheEntry.ttl) {
      // Expired
      return null;
    }

    return cacheEntry.data;
  } catch (error) {
    console.warn('Failed to read from cache:', error);
    return null;
  }
}

/**
 * Get data from cache even if expired (fallback for offline mode)
 * @param {string} key - Cache key
 * @returns {any|null} Cached data or null if not found
 */
export function getCacheEvenExpired(key) {
  try {
    const item = localStorage.getItem(CACHE_PREFIX + key);
    if (!item) return null;

    const cacheEntry = JSON.parse(item);
    return cacheEntry.data;
  } catch (error) {
    console.warn('Failed to read from cache:', error);
    return null;
  }
}

/**
 * Check if cache entry exists and is valid
 * @param {string} key - Cache key
 * @returns {boolean} True if cache exists and is valid
 */
export function isCacheValid(key) {
  return getCache(key) !== null;
}

/**
 * Get cache age in milliseconds
 * @param {string} key - Cache key
 * @returns {number|null} Age in ms or null if not found
 */
export function getCacheAge(key) {
  try {
    const item = localStorage.getItem(CACHE_PREFIX + key);
    if (!item) return null;

    const cacheEntry = JSON.parse(item);
    return Date.now() - cacheEntry.timestamp;
  } catch (error) {
    return null;
  }
}

/**
 * Remove specific cache entry
 * @param {string} key - Cache key
 */
export function clearCache(key) {
  try {
    localStorage.removeItem(CACHE_PREFIX + key);
  } catch (error) {
    console.warn('Failed to clear cache:', error);
  }
}

/**
 * Clear all cache entries
 */
export function clearAllCache() {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach((key) => {
      if (key.startsWith(CACHE_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.warn('Failed to clear all cache:', error);
  }
}

/**
 * Get cache statistics
 * @returns {object} Cache stats
 */
export function getCacheStats() {
  try {
    const keys = Object.keys(localStorage);
    const cacheKeys = keys.filter((key) => key.startsWith(CACHE_PREFIX));

    let totalSize = 0;
    let validCount = 0;
    let expiredCount = 0;

    cacheKeys.forEach((key) => {
      const item = localStorage.getItem(key);
      totalSize += item ? item.length : 0;

      const shortKey = key.replace(CACHE_PREFIX, '');
      if (isCacheValid(shortKey)) {
        validCount++;
      } else {
        expiredCount++;
      }
    });

    return {
      totalEntries: cacheKeys.length,
      validEntries: validCount,
      expiredEntries: expiredCount,
      totalSizeBytes: totalSize,
      totalSizeKB: (totalSize / 1024).toFixed(2),
    };
  } catch (error) {
    console.warn('Failed to get cache stats:', error);
    return null;
  }
}
