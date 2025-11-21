// API module for fetching data from the backend

// Fetch definitions (classes, teachers, rooms)
export async function fetchDefinitions() {
    try {
        const res = await fetch('/api/definitions');
        const data = await res.json();
        return data;
    } catch (error) {
        throw new Error('Nepodařilo se načíst seznamy. Běží backend?');
    }
}

// Fetch timetable data
export async function fetchTimetable(type, id, scheduleType = 'actual') {
    try {
        const res = await fetch(`/api/timetable?type=${type}&id=${id}&schedule=${scheduleType}`);
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
