// Utility functions for the timetable application

// Subject name abbreviations
export const subjectAbbreviations = {
    'Informační a komunikační technologie': 'IKT',
    'Elektrická měření': 'Elektr. měření',
    'Programové vybavení': 'Prog. vybavení',
    'Ekonomika': 'Ekonomika',
    'Tělesná výchova': 'TV',
    'Matematika': 'Matematika',
    'Anglický jazyk': 'Angličtina',
    'Český jazyk a literatura': 'Čeština',
    'Databázové systémy': 'Databáze',
    'CAD systémy': 'CAD',
    'Programování': 'Programování',
    'Hardware': 'Hardware',
    'Grafická tvorba': 'Grafika',
    'Kybernetická bezpečnost': 'Kyberbezpečnost',
    'Datové sítě': 'Datové sítě',
    'Praxe': 'Praxe'
};

// Function to abbreviate subject names
export function abbreviateSubject(subjectName) {
    if (!subjectName) return '';

    // Check if there's a direct mapping
    if (subjectAbbreviations[subjectName]) {
        return subjectAbbreviations[subjectName];
    }

    // If subject name is longer than 20 characters, try to shorten it
    if (subjectName.length > 20) {
        // Try to extract acronym from capital letters
        const capitals = subjectName.match(/[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/g);
        if (capitals && capitals.length > 1) {
            return capitals.join('');
        }
        // Otherwise truncate with ellipsis
        return subjectName.substring(0, 18) + '...';
    }

    return subjectName;
}

// Function to standardize group names
export function standardizeGroupName(groupName) {
    if (!groupName) return '';

    // Convert to lowercase for easier matching
    const lower = groupName.toLowerCase().trim();

    // If it contains "celá", keep as "celá"
    if (lower.includes('celá') || lower === 'cela') {
        return 'celá';
    }

    // Match patterns like "1. skupina", "1.skupina", "1 skupina", "skupina 1", etc.
    const groupMatch = lower.match(/(\d+)[\.\s]*(?:skupina|sk)?|(?:skupina|sk)[\.\s]*(\d+)/);
    if (groupMatch) {
        const groupNum = groupMatch[1] || groupMatch[2];
        return `${groupNum}.sk`;
    }

    // If the group name already contains ".sk", extract just the number part
    if (lower.includes('.sk')) {
        const numMatch = lower.match(/(\d+)\.sk/);
        if (numMatch) {
            return `${numMatch[1]}.sk`;
        }
    }

    // Return as-is if no pattern matches
    return groupName;
}

// Utility funkce pro získání dnešního dne (0-4 = Po-Pá)
export function getTodayIndex() {
    const day = new Date().getDay(); // 0=Neděle, 1=Po, ..., 5=Pá
    return day === 0 || day === 6 ? -1 : day - 1; // Vrátí -1 pro víkend
}

// Časová rozmezí hodin
export const lessonTimes = [
    { hour: 0, start: [7, 10], end: [7, 55], label: '7:10-7:55' },
    { hour: 1, start: [8, 0], end: [8, 45], label: '8:00-8:45' },
    { hour: 2, start: [8, 50], end: [9, 35], label: '8:50-9:35' },
    { hour: 3, start: [9, 45], end: [10, 30], label: '9:45-10:30' },
    { hour: 4, start: [10, 50], end: [11, 35], label: '10:50-11:35' },
    { hour: 5, start: [11, 40], end: [12, 25], label: '11:40-12:25' },
    { hour: 6, start: [12, 35], end: [13, 20], label: '12:35-13:20' },
    { hour: 7, start: [13, 25], end: [14, 10], label: '13:25-14:10' },
    { hour: 8, start: [14, 20], end: [15, 5], label: '14:20-15:05' },
    { hour: 9, start: [15, 10], end: [15, 55], label: '15:10-15:55' },
    { hour: 10, start: [16, 0], end: [16, 45], label: '16:00-16:45' },
    { hour: 11, start: [16, 50], end: [17, 35], label: '16:50-17:35' },
    { hour: 12, start: [17, 40], end: [18, 25], label: '17:40-18:25' }
];

// Utility funkce pro získání aktuální hodiny (0-12)
export function getCurrentHour() {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();

    for (const lesson of lessonTimes) {
        const [startH, startM] = lesson.start;
        const [endH, endM] = lesson.end;
        if ((hour > startH || (hour === startH && minute >= startM)) &&
            (hour < endH || (hour === endH && minute <= endM))) {
            return lesson.hour;
        }
    }
    return -1; // Mimo vyučování
}
