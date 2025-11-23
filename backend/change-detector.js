/**
 * Change Detector Module
 * Compares timetable snapshots and detects changes for notifications
 */

/**
 * Create a unique key for a lesson
 * Used to match lessons between old and new snapshots
 */
function createLessonKey(lesson) {
    return `${lesson.day}-${lesson.hour}-${lesson.subject}-${lesson.teacher}`;
}

/**
 * Compare two lesson objects and detect what changed
 */
function detectLessonChanges(oldLesson, newLesson) {
    const changes = [];

    if (oldLesson.teacher !== newLesson.teacher) {
        changes.push({
            field: 'teacher',
            oldValue: oldLesson.teacher,
            newValue: newLesson.teacher,
            type: 'substitution'
        });
    }

    if (oldLesson.room !== newLesson.room) {
        changes.push({
            field: 'room',
            oldValue: oldLesson.room,
            newValue: newLesson.room,
            type: 'room_change'
        });
    }

    if (oldLesson.subject !== newLesson.subject) {
        changes.push({
            field: 'subject',
            oldValue: oldLesson.subject,
            newValue: newLesson.subject,
            type: 'subject_change'
        });
    }

    if (oldLesson.type !== newLesson.type) {
        changes.push({
            field: 'type',
            oldValue: oldLesson.type,
            newValue: newLesson.type,
            type: 'type_change'
        });
    }

    return changes;
}

/**
 * Compare two timetable snapshots and detect all changes
 * @param {Array} oldData - Previous snapshot of lessons
 * @param {Array} newData - Current snapshot of lessons
 * @param {Object} metadata - Timetable metadata (type, id, name)
 * @returns {Array} List of detected changes
 */
function detectTimetableChanges(oldData, newData, metadata) {
    const changes = [];

    // Create maps for efficient lookup
    const oldLessons = new Map();
    const newLessons = new Map();

    // Index old lessons
    oldData.forEach(lesson => {
        const key = createLessonKey(lesson);
        if (!oldLessons.has(key)) {
            oldLessons.set(key, []);
        }
        oldLessons.get(key).push(lesson);
    });

    // Index new lessons
    newData.forEach(lesson => {
        const key = createLessonKey(lesson);
        if (!newLessons.has(key)) {
            newLessons.set(key, []);
        }
        newLessons.get(key).push(lesson);
    });

    // Detect removed lessons
    oldLessons.forEach((lessons, key) => {
        if (!newLessons.has(key)) {
            lessons.forEach(lesson => {
                // Skip if lesson was already marked as removed in old data
                if (lesson.type === 'removed') return;

                changes.push({
                    type: 'lesson_removed',
                    timetable: metadata,
                    lesson: lesson,
                    day: lesson.day,
                    dayName: lesson.dayName,
                    hour: lesson.hour,
                    description: `Odpadla hodina: ${lesson.subject} (${lesson.teacher})`,
                    timestamp: new Date().toISOString()
                });
            });
        }
    });

    // Detect added lessons
    newLessons.forEach((lessons, key) => {
        if (!oldLessons.has(key)) {
            lessons.forEach(lesson => {
                // Skip if it's a removed lesson (shouldn't notify about cancellations as new)
                if (lesson.type === 'removed') return;

                changes.push({
                    type: 'lesson_added',
                    timetable: metadata,
                    lesson: lesson,
                    day: lesson.day,
                    dayName: lesson.dayName,
                    hour: lesson.hour,
                    description: `Přidána hodina: ${lesson.subject} (${lesson.teacher})`,
                    timestamp: new Date().toISOString()
                });
            });
        }
    });

    // Detect modified lessons
    oldLessons.forEach((oldLessonsList, key) => {
        if (newLessons.has(key)) {
            const newLessonsList = newLessons.get(key);

            // Compare first lessons in each group (most common case)
            if (oldLessonsList.length > 0 && newLessonsList.length > 0) {
                const oldLesson = oldLessonsList[0];
                const newLesson = newLessonsList[0];

                const lessonChanges = detectLessonChanges(oldLesson, newLesson);

                if (lessonChanges.length > 0) {
                    lessonChanges.forEach(change => {
                        let description = '';

                        if (change.type === 'substitution') {
                            description = `Suplování: ${newLesson.subject} - ${oldLesson.teacher} → ${newLesson.teacher}`;
                        } else if (change.type === 'room_change') {
                            description = `Změna místnosti: ${newLesson.subject} - ${oldLesson.room || 'žádná'} → ${newLesson.room || 'žádná'}`;
                        } else if (change.type === 'subject_change') {
                            description = `Změna předmětu: ${oldLesson.subject} → ${newLesson.subject}`;
                        } else if (change.type === 'type_change') {
                            if (newLesson.type === 'removed') {
                                description = `Odpadla hodina: ${newLesson.subject} (${newLesson.teacher})`;
                            } else if (newLesson.type === 'absent') {
                                description = `Absence: ${newLesson.subject} (${newLesson.teacher})`;
                            }
                        }

                        changes.push({
                            type: change.type,
                            timetable: metadata,
                            lesson: newLesson,
                            day: newLesson.day,
                            dayName: newLesson.dayName,
                            hour: newLesson.hour,
                            change: change,
                            description: description,
                            timestamp: new Date().toISOString()
                        });
                    });
                }
            }
        }
    });

    return changes;
}

/**
 * Group changes by timetable for efficient notification batching
 * @param {Array} changes - List of all detected changes
 * @returns {Map} Changes grouped by timetable key
 */
function groupChangesByTimetable(changes) {
    const grouped = new Map();

    changes.forEach(change => {
        const key = `${change.timetable.type}_${change.timetable.id}_${change.timetable.scheduleType}`;

        if (!grouped.has(key)) {
            grouped.set(key, {
                timetable: change.timetable,
                changes: []
            });
        }

        grouped.get(key).changes.push(change);
    });

    return grouped;
}

/**
 * Create human-readable summary of changes for notification
 * @param {Array} changes - List of changes for a timetable
 * @returns {String} Summary text
 */
function createChangeSummary(changes) {
    const counts = {
        lesson_added: 0,
        lesson_removed: 0,
        substitution: 0,
        room_change: 0,
        subject_change: 0
    };

    changes.forEach(change => {
        if (counts[change.type] !== undefined) {
            counts[change.type]++;
        }
    });

    const parts = [];

    if (counts.lesson_removed > 0) {
        parts.push(`${counts.lesson_removed}× odpadlé hodiny`);
    }
    if (counts.substitution > 0) {
        parts.push(`${counts.substitution}× suplování`);
    }
    if (counts.room_change > 0) {
        parts.push(`${counts.room_change}× změna místnosti`);
    }
    if (counts.lesson_added > 0) {
        parts.push(`${counts.lesson_added}× nové hodiny`);
    }
    if (counts.subject_change > 0) {
        parts.push(`${counts.subject_change}× změna předmětu`);
    }

    return parts.join(', ');
}

module.exports = {
    detectTimetableChanges,
    groupChangesByTimetable,
    createChangeSummary,
};
