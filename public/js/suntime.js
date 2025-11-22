import { fetchSunriseSunset } from './api.js';

// Prague coordinates (default)
const PRAGUE_LAT = 50.0755;
const PRAGUE_LNG = 14.4378;

let sunData = null;

// Parse time string (e.g., "6:30 AM") to Date object for today
function parseTimeToDate(timeStr) {
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return null;

    let hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const period = match[3].toUpperCase();

    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;

    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
}

// Initialize sun data
export async function initSunData() {
    try {
        // Try to get user's location
        if (navigator.geolocation) {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    timeout: 5000
                });
            });

            sunData = await fetchSunriseSunset(
                position.coords.latitude,
                position.coords.longitude
            );
        } else {
            // Fallback to Prague
            sunData = await fetchSunriseSunset(PRAGUE_LAT, PRAGUE_LNG);
        }

        console.log('Sun data loaded:', sunData);
    } catch (error) {
        // Fallback to Prague if geolocation fails
        console.log('Using Prague as fallback location');
        sunData = await fetchSunriseSunset(PRAGUE_LAT, PRAGUE_LNG);
    }
}

// Check if it's currently nighttime
export function isNightTime() {
    if (!sunData) return false;

    const now = new Date();
    const sunrise = parseTimeToDate(sunData.sunrise);
    const sunset = parseTimeToDate(sunData.sunset);

    if (!sunrise || !sunset) return false;

    // It's night if current time is before sunrise OR after sunset
    return now < sunrise || now > sunset;
}

// Get sun data
export function getSunData() {
    return sunData;
}
