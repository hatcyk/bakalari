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
