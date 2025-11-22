// API functions

export async function fetchDefinitions() {
    try {
        const res = await fetch('/api/definitions');
        const data = await res.json();
        return data;
    } catch (error) {
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

        return data;
    } catch (error) {
        throw error;
    }
}
