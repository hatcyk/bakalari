// API functions
import { setCache, getCache, getCacheEvenExpired, TTL } from './cache.js';

// Global state for offline mode
let isOfflineMode = false;

export function setOfflineMode(offline) {
    isOfflineMode = offline;
    // Dispatch event for UI updates
    window.dispatchEvent(new CustomEvent('offlineModeChange', { detail: { offline } }));
}

export function getOfflineMode() {
    return isOfflineMode;
}

export async function fetchDefinitions() {
    const CACHE_KEY = 'definitions';

    // Try to get fresh cache first
    const cachedData = getCache(CACHE_KEY);
    if (cachedData) {
        console.log('Using cached definitions (fresh)');
        setOfflineMode(false);
        return cachedData;
    }

    // Try to fetch from API
    try {
        const res = await fetch('/api/definitions');
        const data = await res.json();

        // Save to cache
        setCache(CACHE_KEY, data, TTL.DEFINITIONS);
        console.log('Fetched definitions from API and cached');
        setOfflineMode(false);

        return data;
    } catch (error) {
        console.warn('Failed to fetch definitions from API:', error);

        // Try to use expired cache as fallback
        const expiredCache = getCacheEvenExpired(CACHE_KEY);
        if (expiredCache) {
            console.log('Using cached definitions (expired, offline mode)');
            setOfflineMode(true);
            return expiredCache;
        }

        // No cache available at all
        setOfflineMode(false);
        throw new Error('Nepodařilo se načíst seznamy. Běží backend?');
    }
}

export async function fetchSunriseSunset(lat, lng) {
    try {
        const res = await fetch(`https://api.sunrisesunset.io/json?lat=${lat}&lng=${lng}`);
        const data = await res.json();

        if (data.status !== 'OK') {
            throw new Error('Failed to fetch sunrise/sunset data');
        }

        return {
            sunrise: data.results.sunrise,
            sunset: data.results.sunset,
            dawn: data.results.dawn,
            dusk: data.results.dusk
        };
    } catch (error) {
        console.error('Error fetching sunrise/sunset data:', error);
        return null;
    }
}

export async function fetchTimetable(type, id, scheduleType, date) {
    const CACHE_KEY = `timetable_${type}_${id}_${scheduleType}_${date || 'current'}`;

    // Try to get fresh cache first
    const cachedData = getCache(CACHE_KEY);
    if (cachedData) {
        console.log(`Using cached timetable (fresh): ${CACHE_KEY}`);
        setOfflineMode(false);
        return cachedData;
    }

    // Try to fetch from API
    try {
        let url = `/api/timetable?type=${type}&id=${id}&schedule=${scheduleType}`;
        if (date) {
            url += `&date=${date}`;
        }

        const res = await fetch(url);
        if (!res.ok) throw new Error("Chyba serveru");

        const data = await res.json();

        if (data.error) {
            throw new Error(data.error);
        }

        // Save to cache
        setCache(CACHE_KEY, data, TTL.TIMETABLE);
        console.log(`Fetched timetable from API and cached: ${CACHE_KEY}`);
        setOfflineMode(false);

        return data;
    } catch (error) {
        console.warn('Failed to fetch timetable from API:', error);

        // Try to use expired cache as fallback
        const expiredCache = getCacheEvenExpired(CACHE_KEY);
        if (expiredCache) {
            console.log(`Using cached timetable (expired, offline mode): ${CACHE_KEY}`);
            setOfflineMode(true);
            return expiredCache;
        }

        // No cache available at all
        setOfflineMode(false);
        throw error;
    }
}
