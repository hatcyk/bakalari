/**
 * Lesson Reminder Module
 * Sends notifications to users 5 minutes before their lessons start
 */

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
    'Telekomunikace a Sítě': 'TKS',
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
 * Get lesson slot that starts in exactly 5 minutes from now
 * @returns {Object|null} { hour, startTime: [h, m] } or null if no match
 */
function getLessonStartingIn5Minutes() {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Calculate time in 5 minutes
    const futureTime = new Date(now.getTime() + 5 * 60 * 1000);
    const futureHour = futureTime.getHours();
    const futureMinute = futureTime.getMinutes();

    // Check if future time matches any lesson start time
    for (const lesson of lessonTimes) {
        const [startH, startM] = lesson.start;
        if (futureHour === startH && futureMinute === startM) {
            return {
                hour: lesson.hour,
                startTime: lesson.start,
                label: lesson.label
            };
        }
    }

    return null;
}

/**
 * Get today's day index (0=Monday, 4=Friday)
 * @returns {Number} Day index or -1 if weekend
 */
function getTodayIndex() {
    const day = new Date().getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
    return day === 0 || day === 6 ? -1 : day - 1;
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

            // Check if user has lesson reminders enabled
            const hasLessonReminders = preferences?.notificationTypes?.lessonReminders === true;

            if (hasLessonReminders && userData.tokens && userData.tokens.length > 0) {
                usersWithReminders.push({
                    userId: userDoc.id,
                    tokens: userData.tokens,
                    watchedTimetables: preferences.watchedTimetables || []
                });
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
 * @returns {Promise<Array>} Array of lessons for today
 */
async function getTodaysTimetableForUser(watchedTimetable, todayIndex) {
    try {
        const db = getFirestore();

        // Document key: Type_Id_ScheduleType (use Actual for current schedule)
        const docKey = `${watchedTimetable.type}_${watchedTimetable.id}_Actual`;

        const timetableDoc = await db.collection('timetables').doc(docKey).get();

        if (!timetableDoc.exists) {
            return [];
        }

        const timetableData = timetableDoc.data();
        const allLessons = timetableData.data || [];

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
 * Format lesson notification
 * @param {Object} lesson - Lesson data
 * @param {String} startTime - Start time label (e.g., "8:00")
 * @returns {Object} { title, body, data }
 */
function formatLessonNotification(lesson, startTime) {
    const subjectAbbr = abbreviateSubject(lesson.subject);
    const room = lesson.room || '?';
    const teacher = lesson.teacher || '?';

    // Title: "Za 5 minut: MAT"
    const title = `Za 5 minut: ${subjectAbbr}`;

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

        // 2. Get lesson slot starting in 5 minutes
        const upcomingLesson = getLessonStartingIn5Minutes();
        if (!upcomingLesson) {
            // No lesson starting in 5 minutes
            return { sent: 0, reason: 'no_upcoming_lesson' };
        }

        console.log(`\n📚 Lesson ${upcomingLesson.hour} starts in 5 minutes (${upcomingLesson.label})`);

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

        for (const user of users) {
            try {
                if (user.watchedTimetables.length === 0) {
                    continue;
                }

                let userHasLesson = false;
                const userLessons = [];

                // Check each watched timetable
                for (const watchedTimetable of user.watchedTimetables) {
                    const todaysLessons = await getTodaysTimetableForUser(watchedTimetable, todayIndex);
                    const lessonsInSlot = findLessonInSlot(todaysLessons, upcomingLesson.hour);

                    // Filter out removed/cancelled lessons
                    const validLessons = lessonsInSlot.filter(lesson =>
                        lesson.type !== 'removed' && lesson.subject && lesson.subject.trim() !== ''
                    );

                    if (validLessons.length > 0) {
                        userHasLesson = true;
                        userLessons.push(...validLessons);
                    }
                }

                if (userHasLesson && userLessons.length > 0) {
                    // Send notification for first lesson (if multiple, they're usually the same subject)
                    const lesson = userLessons[0];
                    const notification = formatLessonNotification(lesson, upcomingLesson.label);

                    const result = await sendNotificationToTokens(user.tokens, notification);
                    totalSent += result.successCount;
                    totalUsers++;

                    console.log(`✅ Sent reminder to user ${user.userId}: ${notification.body}`);
                }

            } catch (error) {
                console.error(`Failed to send reminder to user ${user.userId}:`, error.message);
            }
        }

        console.log(`\n✅ Sent ${totalSent} lesson reminders to ${totalUsers} users`);

        return { sent: totalSent, users: totalUsers, lesson: upcomingLesson.hour };

    } catch (error) {
        console.error('❌ Failed to send lesson reminders:', error.message);
        throw error;
    }
}

module.exports = {
    sendLessonReminders,
    getLessonStartingIn5Minutes,
    getTodayIndex
};
