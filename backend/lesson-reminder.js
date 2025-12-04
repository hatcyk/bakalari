/**
 * Lesson Reminder Module
 * Sends notifications to users 5 minutes before their lessons start
 */

const { DateTime } = require('luxon');
const { getFirestore } = require('./firebase-admin-init');
const { sendNotificationToTokens } = require('./fcm');

// Lesson times (copied from /public/js/constants.js)
const lessonTimes = [
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

// Subject abbreviations (from /public/js/constants.js - key ones)
const subjectAbbreviations = {
    'Informační a komunikační technologie': 'IKT',
    'Programové vybavení': 'PV',
    'Databázové systémy': 'DBS',
    'Programování': 'PRG',
    'Hardware': 'HW',
    'Operační systémy': 'OS',
    'Kybernetická bezpečnost': 'KBS',
    'Datové sítě': 'DTS',
    'Počítačové sítě a síťová zařízení': 'PSZ',
    'Grafická tvorba': 'GTV',
    'CAD systémy': 'CAD',
    'Webové aplikace': 'WA',
    'Mobilní aplikace': 'MA',
    'Telekomunikace a sítě': 'TKS',
    'Elektrická měření': 'EM',
    'Elektronika': 'ELN',
    'Elektrotechnika': 'ELT',
    'Základy elektrotechniky': 'ZEL',
    'Automatizace': 'AUT',
    'Mikroprocesorová technika': 'MPT',
    'Digitální technika': 'DT',
    'Číslicová technika': 'ČT',
    'Tělesná výchova': 'TV',
    'Matematika': 'MAT',
    'Anglický jazyk': 'AJ',
    'Německý jazyk': 'NJ',
    'Český jazyk a literatura': 'ČJ',
    'Občanská nauka': 'OBN',
    'Základy práva': 'ZP',
    'Dějepis': 'DEJ',
    'Fyzika': 'FYZ',
    'Chemie': 'CHE',
    'Biologie': 'BIO',
    'Biologie, ekologie a chemie': 'BECH',
    'Ekologie a chemie': 'ECH',
    'Ekologie': 'EKOL',
    'Zeměpis': 'ZEM',
    'Virtualizace': 'VIR',
    'Webdesign': 'WD',
    'Třídnická hodina': 'TH',
    'Ekonomika': 'EKO',
    'Ekonomika a finance': 'EF',
    'Ekonomika dopravy': 'ED',
    'Účetnictví': 'ÚČE',
    'Účetnictví na počítači': 'ÚNP',
    'Daně': 'DAN',
    'Obchodní psychologie': 'OP',
    'Praxe': 'PRX',
    'Učební praxe': 'UP',
    'Technické kreslení': 'TK',
    'Technická dokumentace': 'TD',
    'Technologie': 'TCH',
    'Strojnictví': 'STR',
    'Konstruování': 'KON',
    'Logistika': 'LOG',
    'Logistika a zasilatelství': 'LZ',
    'Doprava a přeprava': 'DP',
    'Dopravní zeměpis': 'DZ',
    'Dopravní telematika': 'DTel',
    'Dějiny dopravy': 'DD',
    'Moderní trendy v dopravě': 'MTD',
    'Městská a regionální hromadná doprava': 'MRHD',
    'Zabezpečovací systémy': 'ZS',
    'Úvod do automatizace': 'ÚA',
    'Bezpečnost v digitálním prostředí': 'BDP',
    'Konverzace v anglickém jazyce': 'Konv. AJ',
    'Seminář z matematiky': 'Sem. MAT',
    'Seminář z fyziky': 'Sem. FYZ',
    'Seminář k profilové maturitě': 'Sem. PM',
    'Seminář k maturitní zkoušce': 'Sem. MZ',
    'Projektování': 'PRJ',
    'Maturitní projekt': 'MP',
    'Sociální a profesní komunikace': 'SPK'
};

/**
 * Abbreviate subject name
 * @param {String} subjectName - Full subject name
 * @returns {String} Abbreviated name
 */
function abbreviateSubject(subjectName) {
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

/**
 * Get next lesson reminder time
 * Logic:
 * - If currently in a lesson: notify 5 minutes before current lesson ends (about next lesson)
 * - If not in a lesson yet today: notify 10 minutes before first lesson starts
 * @returns {Object|null} { hour, startTime: [h, m], label, type: 'next'|'first' } or null if no match
 */
function getNextLessonReminder() {
    // Use Europe/Prague timezone for accurate local time
    const now = DateTime.now().setZone('Europe/Prague');
    const currentHour = now.hour;
    const currentMinute = now.minute;
    const currentTimeInMinutes = currentHour * 60 + currentMinute;

    console.log(`\n⏰ [TIMING] Current time (Europe/Prague): ${currentHour}:${currentMinute.toString().padStart(2, '0')} (${currentTimeInMinutes} minutes)`);

    // Find if we're currently in any lesson
    let currentLesson = null;
    for (const lesson of lessonTimes) {
        const [startH, startM] = lesson.start;
        const [endH, endM] = lesson.end;
        const startInMinutes = startH * 60 + startM;
        const endInMinutes = endH * 60 + endM;

        if (currentTimeInMinutes >= startInMinutes && currentTimeInMinutes < endInMinutes) {
            currentLesson = lesson;
            console.log(`   Currently IN lesson: Hour ${lesson.hour} (${lesson.label})`);
            break;
        }
    }

    if (!currentLesson) {
        console.log(`   NOT in any lesson currently (between lessons or outside school hours)`);
    }

    // Case 1: We're in a lesson - check if we're 5 minutes before it ends
    if (currentLesson) {
        const [endH, endM] = currentLesson.end;
        const endTimeInMinutes = endH * 60 + endM;
        const minutesUntilEnd = endTimeInMinutes - currentTimeInMinutes;

        console.log(`   Minutes until current lesson ends: ${minutesUntilEnd} (trigger window: 4-6 minutes)`);

        // If exactly 5 minutes before end (or within 1 minute window for cron tolerance)
        if (minutesUntilEnd >= 4 && minutesUntilEnd <= 6) {
            // Find next lesson slot
            const nextLessonSlot = lessonTimes.find(l => l.hour === currentLesson.hour + 1);
            if (nextLessonSlot) {
                console.log(`   ✅ TRIGGER: Sending "next lesson" reminder for hour ${nextLessonSlot.hour} (${nextLessonSlot.label})`);
                return {
                    hour: nextLessonSlot.hour,
                    startTime: nextLessonSlot.start,
                    label: nextLessonSlot.label,
                    type: 'next'
                };
            } else {
                console.log(`   ⚠️ No next lesson slot found after hour ${currentLesson.hour}`);
            }
        } else {
            console.log(`   ❌ Not in trigger window (need 4-6 minutes before end)`);
        }
    }

    // Case 2: Not in a lesson - check if we're 10 minutes before first lesson
    const firstLesson = lessonTimes[0];
    const [firstStartH, firstStartM] = firstLesson.start;
    const firstStartInMinutes = firstStartH * 60 + firstStartM;
    const minutesUntilFirstLesson = firstStartInMinutes - currentTimeInMinutes;

    console.log(`   Minutes until first lesson (${firstLesson.label}): ${minutesUntilFirstLesson} (trigger window: 9-11 minutes)`);

    // If exactly 10 minutes before first lesson (or within 1 minute window)
    if (minutesUntilFirstLesson >= 9 && minutesUntilFirstLesson <= 11) {
        console.log(`   ✅ TRIGGER: Sending "first lesson" reminder for hour ${firstLesson.hour} (${firstLesson.label})`);
        return {
            hour: firstLesson.hour,
            startTime: firstLesson.start,
            label: firstLesson.label,
            type: 'first'
        };
    }

    console.log(`   ❌ No notification to send at this time`);
    return null;
}

/**
 * Get today's day index (0=Monday, 4=Friday)
 * @returns {Number} Day index or -1 if weekend
 */
function getTodayIndex() {
    // Use Europe/Prague timezone for accurate local date
    const now = DateTime.now().setZone('Europe/Prague');
    const day = now.weekday; // Luxon: 1=Monday, 7=Sunday
    return day === 6 || day === 7 ? -1 : day - 1;
}

/**
 * Get all users who have lesson reminders enabled
 * @returns {Promise<Array>} Array of { userId, tokens, watchedTimetables }
 */
async function getUsersWithLessonReminders() {
    try {
        const db = getFirestore();
        const usersSnapshot = await db.collection('users').get();

        const usersWithReminders = [];

        usersSnapshot.forEach(userDoc => {
            const userData = userDoc.data();
            const preferences = userData.preferences;
            const userId = userDoc.id;

            // Debug logging for specific user
            const DEBUG_USER = 'anonymous-1764059732165';
            const isDebugUser = userId === DEBUG_USER;

            if (isDebugUser) {
                console.log(`\n🔍 DEBUG USER: ${userId}`);
                console.log(`   Has tokens: ${userData.tokens ? userData.tokens.length : 0}`);
                console.log(`   Tokens:`, userData.tokens);
                console.log(`   Preferences:`, JSON.stringify(preferences, null, 2));
            }

            // Check if user has any lesson reminders enabled in any watched timetable
            const watchedTimetables = preferences?.watchedTimetables || [];
            const hasAnyReminders = watchedTimetables.some(timetable => {
                const reminders = timetable.notificationTypes?.reminders || {};
                const hasReminder = reminders.next_lesson_room || reminders.next_lesson_teacher || reminders.next_lesson_subject;

                if (isDebugUser) {
                    console.log(`   Timetable: ${timetable.name} (${timetable.type}/${timetable.id})`);
                    console.log(`     Reminders:`, reminders);
                    console.log(`     Has any reminder: ${hasReminder}`);
                }

                return hasReminder;
            });

            if (isDebugUser) {
                console.log(`   ✅ Has ANY reminders enabled: ${hasAnyReminders}`);
            }

            if (hasAnyReminders && userData.tokens && userData.tokens.length > 0) {
                usersWithReminders.push({
                    userId: userDoc.id,
                    tokens: userData.tokens,
                    watchedTimetables: watchedTimetables
                });

                if (isDebugUser) {
                    console.log(`   ✅ User ADDED to reminder list\n`);
                }
            } else if (isDebugUser) {
                console.log(`   ❌ User NOT added to reminder list`);
                console.log(`      Reason: hasReminders=${hasAnyReminders}, hasTokens=${userData.tokens && userData.tokens.length > 0}\n`);
            }
        });

        return usersWithReminders;

    } catch (error) {
        console.error('Failed to get users with lesson reminders:', error.message);
        throw error;
    }
}

/**
 * Get today's timetable data for a watched timetable
 * @param {Object} watchedTimetable - { type, id, scheduleType }
 * @param {Number} todayIndex - Day index (0-4)
 * @param {Map} cache - Cache for timetable data
 * @returns {Promise<Array>} Array of lessons for today
 */
async function getTodaysTimetableForUser(watchedTimetable, todayIndex, cache = null) {
    try {
        // Document key: Type_Id_ScheduleType (use Actual for current schedule)
        const docKey = `${watchedTimetable.type}_${watchedTimetable.id}_Actual`;

        // Check cache first
        if (cache && cache.has(docKey)) {
            const cachedData = cache.get(docKey);
            // Filter for today's lessons
            return cachedData.filter(lesson => lesson.day === todayIndex);
        }

        const db = getFirestore();
        const timetableDoc = await db.collection('timetables').doc(docKey).get();

        if (!timetableDoc.exists) {
            if (cache) cache.set(docKey, []);
            return [];
        }

        const timetableData = timetableDoc.data();
        const allLessons = timetableData.data || [];

        // Store in cache
        if (cache) {
            cache.set(docKey, allLessons);
        }

        // Filter for today's lessons
        const todaysLessons = allLessons.filter(lesson => lesson.day === todayIndex);

        return todaysLessons;

    } catch (error) {
        console.error(`Failed to get timetable for ${watchedTimetable.type}/${watchedTimetable.id}:`, error.message);
        return [];
    }
}

/**
 * Find lesson(s) in specific hour slot
 * @param {Array} lessons - Array of lessons
 * @param {Number} hourSlot - Hour slot number (0-12)
 * @returns {Array} Lessons in this slot (may be multiple for group divisions)
 */
function findLessonInSlot(lessons, hourSlot) {
    return lessons.filter(lesson => lesson.hour === hourSlot);
}

/**
 * Standardize group name to normalized format
 * @param {String} groupName - Raw group name from Bakalari
 * @returns {String} Standardized name (e.g., "1.sk", "2.sk", "celá")
 */
function standardizeGroupName(groupName) {
    if (!groupName) return '';

    const lower = groupName.toLowerCase().trim();

    // "celá třída"
    if (lower.includes('celá') || lower === 'cela') {
        return 'celá';
    }

    // Extrahuj číslo: "1. sk", "skupina 1", "1.skupina" → "1.sk"
    const groupMatch = lower.match(/(\d+)[\.\s]*(?:skupina|sk)?|(?:skupina|sk)[\.\s]*(\d+)/);
    if (groupMatch) {
        const groupNum = groupMatch[1] || groupMatch[2];
        return `${groupNum}.sk`;
    }

    return groupName;
}

/**
 * Format lesson notification
 * @param {Object} lesson - Next lesson data
 * @param {Object} currentLesson - Current lesson data (optional, for 'next' type)
 * @param {String} startTime - Start time label (e.g., "8:00")
 * @param {String} reminderType - 'next' or 'first'
 * @returns {Object|null} { title, body, data } or null to skip notification
 */
function formatLessonNotification(lesson, currentLesson, startTime, reminderType = 'next') {
    const subjectAbbr = abbreviateSubject(lesson.subject);
    const room = lesson.room || '?';
    const teacher = lesson.teacher || '?';

    // Title depends on reminder type
    let title;
    if (reminderType === 'first') {
        title = `Za 10 minut: ${subjectAbbr}`;
    } else {
        // Pro "next" typ - porovnej s aktuální hodinou
        if (currentLesson) {
            const isSameSubject = currentLesson.subject === lesson.subject;

            if (isSameSubject) {
                // Stejný předmět - zkontroluj, zda se změnila místnost nebo učitel
                const roomChanged = currentLesson.room !== lesson.room;
                const teacherChanged = currentLesson.teacher !== lesson.teacher;

                if (roomChanged || teacherChanged) {
                    // Změna místnosti nebo učitele - upozorni
                    title = `Další ${subjectAbbr}: ${room}`;
                    console.log(`ℹ️  Same subject but different room/teacher - sending notification`);
                } else {
                    // Úplně stejná hodina pokračuje - skipni notifikaci
                    console.log(`⏭️  Same lesson continues (${lesson.subject}) - skipping notification`);
                    return null;
                }
            } else {
                // Jiný předmět
                title = `Příští hodina: ${subjectAbbr}`;
            }
        } else {
            // Nemáme info o aktuální hodině - použij výchozí text
            title = `Příští hodina: ${subjectAbbr}`;
        }
    }

    // Body: "202 • MAT • M. Velingerová"
    const body = `${room} • ${subjectAbbr} • ${teacher}`;

    return {
        title,
        body,
        data: {
            type: 'lesson_reminder',
            subject: lesson.subject,
            teacher: lesson.teacher,
            room: room,
            startTime: startTime,
            reminderType: reminderType,
            timestamp: new Date().toISOString()
        }
    };
}

/**
 * Main function: Check for upcoming lessons and send reminders
 */
async function sendLessonReminders() {
    try {
        // 1. Check if today is weekend
        const todayIndex = getTodayIndex();
        if (todayIndex === -1) {
            // Weekend - no lessons
            return { sent: 0, reason: 'weekend' };
        }

        // 2. Get next lesson reminder (either 5 min before current lesson ends, or 10 min before first lesson)
        const upcomingLesson = getNextLessonReminder();
        if (!upcomingLesson) {
            // No reminder to send at this time
            return { sent: 0, reason: 'no_upcoming_lesson' };
        }

        const reminderTypeText = upcomingLesson.type === 'first'
            ? 'First lesson starts in 10 minutes'
            : 'Next lesson reminder (5 min before current lesson ends)';

        console.log(`\n📚 ${reminderTypeText}: Lesson ${upcomingLesson.hour} (${upcomingLesson.label})`);

        // 3. Get all users with lesson reminders enabled
        const users = await getUsersWithLessonReminders();

        if (users.length === 0) {
            console.log('⏭️  No users with lesson reminders enabled');
            return { sent: 0, reason: 'no_users' };
        }

        console.log(`📋 Found ${users.length} users with lesson reminders enabled`);

        // 4. For each user, check their timetables and send notifications
        let totalSent = 0;
        let totalUsers = 0;

        // Cache for timetable data to avoid redundant Firestore reads
        // Map<docKey, allLessons>
        const timetableCache = new Map();
        let cacheHits = 0;
        let cacheMisses = 0;

        const startTime = Date.now();

        for (const user of users) {
            try {
                if (user.watchedTimetables.length === 0) {
                    continue;
                }

                let userHasLesson = false;
                const userLessons = [];

                // Check each watched timetable
                for (const watchedTimetable of user.watchedTimetables) {
                    // Track cache usage for debug
                    const docKey = `${watchedTimetable.type}_${watchedTimetable.id}_Actual`;
                    if (timetableCache.has(docKey)) cacheHits++; else cacheMisses++;

                    const todaysLessons = await getTodaysTimetableForUser(watchedTimetable, todayIndex, timetableCache);
                    const lessonsInSlot = findLessonInSlot(todaysLessons, upcomingLesson.hour);

                    // Filter out removed/cancelled lessons
                    const validLessons = lessonsInSlot.filter(lesson =>
                        lesson.type !== 'removed' && lesson.subject && lesson.subject.trim() !== ''
                    );

                    // Filter by group preferences (supports multiple groups)
                    // Backwards compatibility: migrate groupFilter to groupFilters
                    let groupFilters = watchedTimetable.groupFilters;
                    if (!groupFilters && watchedTimetable.groupFilter) {
                        groupFilters = [watchedTimetable.groupFilter];
                    } else if (!groupFilters) {
                        groupFilters = [];
                    }

                    const groupFilteredLessons = validLessons.filter(lesson => {
                        // Debug logging pro diagnostiku
                        const debugInfo = {
                            subject: lesson.subject,
                            group: lesson.group,
                            groupType: typeof lesson.group,
                            groupFilters: groupFilters
                        };

                        // Empty array or "all" - zobraz vše
                        if (groupFilters.length === 0 || groupFilters.includes('all')) {
                            console.log(`[FILTER] ✅ PASS (all groups): ${lesson.subject}`, debugInfo);
                            return true;
                        }

                        // Hodina bez skupiny - zobraz vždy (je pro celou třídu)
                        // Robustní kontrola pro různé případy: null, undefined, prázdný string
                        const hasNoGroup = !lesson.group ||
                                          (typeof lesson.group === 'string' && lesson.group.trim() === '');

                        if (hasNoGroup) {
                            console.log(`[FILTER] ✅ PASS (no group - whole class): ${lesson.subject}`, debugInfo);
                            return true;
                        }

                        // Porovnej standardizované skupiny
                        const standardizedLessonGroup = standardizeGroupName(lesson.group);
                        const passes = groupFilters.includes(standardizedLessonGroup);

                        console.log(`[FILTER] ${passes ? '✅ PASS' : '❌ FAIL'} (group match): ${lesson.subject}, standardized: "${standardizedLessonGroup}"`, debugInfo);
                        return passes;
                    });

                    // Filter out "Dívčí tělocvik" lessons
                    const filteredLessons = groupFilteredLessons.filter(lesson =>
                        !lesson.subject || !lesson.subject.toLowerCase().includes('dívčí tělocvik')
                    );

                    if (filteredLessons.length > 0) {
                        userHasLesson = true;
                        userLessons.push(...filteredLessons);
                    }
                }

                if (userHasLesson && userLessons.length > 0) {
                    // Send notification for first lesson (if multiple, they're usually the same subject)
                    const lesson = userLessons[0];

                    // Pokud je to "next" reminder (5 min před koncem hodiny), získej aktuální hodinu
                    let currentLessonData = null;
                    if (upcomingLesson.type === 'next' && upcomingLesson.hour > 0) {
                        // Aktuální hodina je o 1 menší než upcoming
                        const currentHour = upcomingLesson.hour - 1;
                        const currentLessonsInSlot = await getTodaysTimetableForUser(
                            user.watchedTimetables[0], // Používáme první watched timetable
                            todayIndex,
                            timetableCache
                        );
                        const currentLessons = findLessonInSlot(currentLessonsInSlot, currentHour);
                        if (currentLessons.length > 0) {
                            currentLessonData = currentLessons[0];
                        }
                    }

                    const notification = formatLessonNotification(
                        lesson,
                        currentLessonData,
                        upcomingLesson.label,
                        upcomingLesson.type
                    );

                    // Skip pokud notification je null (stejná hodina pokračuje)
                    if (!notification) {
                        console.log(`⏭️  Skipped notification for user ${user.userId} - same lesson continues`);
                        continue;
                    }

                    const result = await sendNotificationToTokens(user.tokens, notification);
                    totalSent += result.successCount;
                    totalUsers++;

                    console.log(`✅ Sent reminder to user ${user.userId}: ${notification.title} - ${notification.body}`);
                }

            } catch (error) {
                console.error(`Failed to send reminder to user ${user.userId}:`, error.message);
            }
        }

        const duration = Date.now() - startTime;
        console.log(`⏱️  Processing time: ${duration}ms`);
        console.log(`📊 Cache stats: ${cacheHits} hits, ${cacheMisses} misses (Efficiency: ${Math.round(cacheHits / (cacheHits + cacheMisses) * 100)}%)`);

        console.log(`\n✅ Sent ${totalSent} lesson reminders to ${totalUsers} users`);

        return { sent: totalSent, users: totalUsers, lesson: upcomingLesson.hour, type: upcomingLesson.type };

    } catch (error) {
        console.error('❌ Failed to send lesson reminders:', error.message);
        throw error;
    }
}

module.exports = {
    sendLessonReminders,
    getNextLessonReminder,
    getTodayIndex
};
