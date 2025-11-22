import { subjectAbbreviations, lessonTimes } from './constants.js';

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

// Function to abbreviate teacher names to initials
export function abbreviateTeacherName(fullName) {
    if (!fullName) return '';

    // Remove titles (Mgr., Ing., Bc., Ph.D., etc.)
    const withoutTitles = fullName.replace(/^(Mgr\.|Ing\.|Bc\.|Dr\.|Ph\.D\.|RNDr\.|PaedDr\.)\s*/gi, '')
                                   .replace(/,?\s*(Ph\.D\.|CSc\.)$/gi, '')
                                   .trim();

    // Split by spaces to get name parts
    const parts = withoutTitles.split(/\s+/);

    if (parts.length === 0) return '';

    // Take first letter of first name and first letter of last name
    if (parts.length === 1) {
        return parts[0].substring(0, 2).toUpperCase();
    }

    // Get first letter of first and last part
    const firstInitial = parts[0][0];
    const lastInitial = parts[parts.length - 1][0];

    return (firstInitial + lastInitial).toUpperCase();
}

// Utility funkce pro získání dnešního dne (0-4 = Po-Pá)
export function getTodayIndex() {
    const day = new Date().getDay(); // 0=Neděle, 1=Po, ..., 5=Pá
    return day === 0 || day === 6 ? -1 : day - 1; // Vrátí -1 pro víkend
}

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

// Parse group name to extract class and group number
export function parseGroupName(groupName) {
    if (!groupName) return null;

    // Match pattern: "CLASS_ID GROUP_NAME" (e.g., "4.D 1.sk", "2.A celá")
    const match = groupName.match(/^([^\s]+)\s+(.+)$/);
    if (match) {
        return {
            classId: match[1],
            groupName: match[2]
        };
    }
    return null;
}

// Get Monday of a given week offset (0 = this week, -1 = last week, +1 = next week)
export function getMondayOfWeek(offset = 0) {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
    const daysFromMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Calculate offset to Monday

    const monday = new Date(now);
    monday.setDate(now.getDate() + daysFromMonday + (offset * 7));
    monday.setHours(0, 0, 0, 0);

    return monday;
}

// Get Friday of a given week offset
export function getFridayOfWeek(offset = 0) {
    const monday = getMondayOfWeek(offset);
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);

    return friday;
}

// Format date as "DD.MM."
export function formatDate(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}.${month}.`;
}

export function showError(msg, errorDiv) {
    errorDiv.textContent = msg;
    errorDiv.classList.remove('hidden');
}

// Parse change info to make it more understandable
// Examples:
// - "Suplování: CJL, Lichtágová Denisa (ZP, VT)"
// - "Zrušeno - Nemoc učitele"
// - "Vyjmuto"
export function parseChangeInfo(changeInfoRaw) {
    if (!changeInfoRaw) return null;

    const result = {
        type: null,
        newSubject: null,
        newTeacher: null,
        originalInfo: null,
        reason: null,
        formatted: changeInfoRaw
    };

    // Check for cancellation/removal patterns: "Zrušeno - Důvod" or "Vyjmuto - Důvod"
    const cancelMatch = changeInfoRaw.match(/^(Zrušeno|Vyjmuto)(?:\s*-\s*(.+))?$/i);
    if (cancelMatch) {
        result.type = cancelMatch[1].trim();
        result.reason = cancelMatch[2] ? cancelMatch[2].trim() : null;

        const lines = [];
        const icon = result.type.toLowerCase() === 'zrušeno' ? '❌' : '🚫';

        if (result.reason) {
            lines.push(`${icon} ${result.type}: ${result.reason}`);
        } else {
            lines.push(`${icon} ${result.type}`);
        }

        result.formatted = lines.join('\n');
        return result;
    }

    // Match pattern for substitution: "Type: Subject, Teacher (Original)"
    const match = changeInfoRaw.match(/^([^:]+):\s*([^,]+),\s*([^(]+)\s*\(([^)]+)\)/);

    if (match) {
        result.type = match[1].trim(); // "Suplování"
        result.newSubject = match[2].trim(); // "CJL"
        result.newTeacher = match[3].trim(); // "Lichtágová Denisa"
        result.originalInfo = match[4].trim(); // "ZP, VT"

        // Format nicely
        const lines = [];

        if (result.type === 'Suplování') {
            lines.push(`🔄 ${result.type}`);
            lines.push(`📚 Nahrazující předmět: ${result.newSubject}`);
            lines.push(`👨‍🏫 Suplující učitel: ${result.newTeacher}`);

            // Original info could be "subject, teacher" or just "subject"
            const origParts = result.originalInfo.split(',').map(p => p.trim());
            if (origParts.length === 2) {
                lines.push(`📋 Původně: ${origParts[0]} (${origParts[1]})`);
            } else {
                lines.push(`📋 Původně: ${result.originalInfo}`);
            }
        } else {
            lines.push(`ℹ️ ${result.type}`);
            lines.push(`Nové: ${result.newSubject} - ${result.newTeacher}`);
            lines.push(`Původně: ${result.originalInfo}`);
        }

        result.formatted = lines.join('\n');
    } else {
        // Check if it's just a date (DD.MM.YYYY or similar)
        const dateMatch = changeInfoRaw.match(/^\d{1,2}\.\d{1,2}\.\d{4}$/);
        if (dateMatch) {
            // Don't show just a date, show it as "Změněno"
            result.formatted = `ℹ️ Změněno (${changeInfoRaw})`;
        } else {
            // Fallback for other formats
            result.formatted = `ℹ️ ${changeInfoRaw}`;
        }
    }

    return result;
}
