/**
 * Prefetch Module
 * Downloads all timetable data from Bakalari API and stores in Firebase
 */

const axios = require('axios');
const cheerio = require('cheerio');
const { getFirestore } = require('./firebase-admin-init');
const { detectTimetableChanges } = require('./change-detector');

// Configuration
const BAKALARI_BASE_URL = 'https://mot-spsd.bakalari.cz';
// Reduce concurrent requests on Vercel to avoid rate limiting/DDoS blocks
const CONCURRENT_REQUESTS = process.env.VERCEL ? 3 : 20; // Slower on Vercel to avoid blocks
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = process.env.VERCEL ? 2000 : 1000; // Longer delay on Vercel
const SCHEDULE_TYPES = ['Actual', 'Permanent', 'Next'];
const ENTITY_TYPES = ['Class', 'Teacher', 'Room'];

// Axios configuration for serverless environments
const axiosConfig = {
    timeout: 30000, // 30 second timeout
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    },
    // Disable keep-alive in serverless environments
    httpAgent: process.env.VERCEL ? new (require('http').Agent)({ keepAlive: false }) : undefined,
    httpsAgent: process.env.VERCEL ? new (require('https').Agent)({ keepAlive: false }) : undefined,
};

// Cache for session cookie (valid for the duration of prefetch run)
let cachedSessionCookie = null;

/**
 * Login to Bakalari and get fresh session cookie
 * @returns {Promise<string>} Cookie string for authenticated requests
 */
async function loginToBakalari(retries = MAX_RETRIES) {
    // Return cached cookie if available
    if (cachedSessionCookie) {
        return cachedSessionCookie;
    }

    const username = process.env.BAKALARI_USERNAME;
    const password = process.env.BAKALARI_PASSWORD;

    if (!username || !password) {
        throw new Error('BAKALARI_USERNAME and BAKALARI_PASSWORD must be set in environment');
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            console.log(`🔐 Logging in to Bakalari... (attempt ${attempt}/${retries})`);

            // Step 1: GET login page to get CSRF token and initial cookies
            const loginPageResponse = await axios.get(`${BAKALARI_BASE_URL}/login`, {
                ...axiosConfig,
                maxRedirects: 0,
                validateStatus: (status) => status < 400
            });

            // Extract cookies from login page
            const setCookieHeaders = loginPageResponse.headers['set-cookie'] || [];
            let cookies = {};
            setCookieHeaders.forEach(cookieStr => {
                const [nameValue] = cookieStr.split(';');
                const [name, value] = nameValue.split('=');
                cookies[name.trim()] = value;
            });

            // Parse HTML to get CSRF token
            const $ = cheerio.load(loginPageResponse.data);
            const csrfToken = $('input[name="__RequestVerificationToken"]').val();

            // Step 2: POST login form
            const loginData = new URLSearchParams({
                'username': username,
                'password': password,
                '__RequestVerificationToken': csrfToken || ''
            });

            const loginResponse = await axios.post(`${BAKALARI_BASE_URL}/login`, loginData, {
                ...axiosConfig,
                headers: {
                    ...axiosConfig.headers,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Cookie': Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ')
                },
                maxRedirects: 0,
                validateStatus: (status) => status < 400
            });

            // Extract all cookies from login response
            const loginSetCookies = loginResponse.headers['set-cookie'] || [];
            loginSetCookies.forEach(cookieStr => {
                const [nameValue] = cookieStr.split(';');
                const [name, value] = nameValue.split('=');
                cookies[name.trim()] = value;
            });

            // Build cookie string
            const cookieString = Object.entries(cookies)
                .map(([name, value]) => `${name}=${value}`)
                .join('; ');

            console.log('✅ Login successful');

            // Cache the cookie for this prefetch run
            cachedSessionCookie = cookieString;

            return cookieString;

        } catch (error) {
            const isLastAttempt = attempt === retries;
            const errorMsg = error.code === 'ECONNRESET' ? 'Connection reset by server' : error.message;

            console.error(`❌ Login attempt ${attempt}/${retries} failed: ${errorMsg}`);

            if (isLastAttempt) {
                throw new Error(`Bakalari login failed after ${retries} attempts: ${error.message}`);
            }

            // Wait before retry with exponential backoff
            const delay = RETRY_DELAY_MS * attempt;
            console.log(`⏳ Waiting ${delay}ms before retry...`);
            await sleep(delay);
        }
    }
}

/**
 * Helper function to abbreviate teacher name from "Surname Firstname" format
 */
function abbreviateTeacherName(fullName) {
    if (!fullName) return '';

    // Remove titles
    let cleaned = fullName.replace(/^(?:Mgr\.|Ing\.|Bc\.|Dr\.|Ph\.D\.|RNDr\.|PaedDr\.|MBA)\s+/gi, '');
    let prevCleaned = '';
    while (prevCleaned !== cleaned) {
        prevCleaned = cleaned;
        cleaned = cleaned.replace(/^(?:Mgr\.|Ing\.|Bc\.|Dr\.|Ph\.D\.|RNDr\.|PaedDr\.|MBA)\s+/gi, '');
    }
    cleaned = cleaned.replace(/,?\s*(?:Ph\.D\.|CSc\.|MBA)$/gi, '');
    cleaned = cleaned.trim();

    const parts = cleaned.split(/\s+/).filter(p => p.length > 0);
    if (parts.length === 0) return '';
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();

    // Detect if in "Surname Firstname" format (reversed)
    const firstPart = parts[0].toLowerCase();
    const surnameSuffixes = ['ová', 'ný', 'ná', 'ský', 'ská', 'ík', 'ek', 'ák', 'vič', 'ovič'];
    const isReversed = surnameSuffixes.some(suffix => firstPart.endsWith(suffix));

    let firstName, lastName;
    if (isReversed) {
        // "Kozakovič Radko" → firstName="Radko", lastName="Kozakovič"
        lastName = parts[0];
        firstName = parts[parts.length - 1];
    } else {
        // "Radko Kozakovič" → firstName="Radko", lastName="Kozakovič"
        firstName = parts[0];
        lastName = parts[parts.length - 1];
    }

    // Return "R. Kozakovič"
    return `${firstName[0]}. ${lastName}`;
}

/**
 * Sleep utility for throttling
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetch with retry logic
 */
async function fetchWithRetry(url, options, retries = MAX_RETRIES) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await axios.get(url, options);
            return response.data;
        } catch (error) {
            console.warn(`Retry ${i + 1}/${retries} for ${url}:`, error.message);
            if (i === retries - 1) throw error;
            await sleep(RETRY_DELAY_MS * (i + 1)); // Exponential backoff
        }
    }
}

/**
 * Fetch definitions (classes, teachers, rooms) from Bakalari
 * Same logic as current /api/definitions endpoint
 */
async function fetchDefinitions() {
    try {
        // Get fresh login cookie
        const cookie = await loginToBakalari();

        const url = `${BAKALARI_BASE_URL}/Timetable/Public/Actual/Class/ZL`;
        const response = await axios.get(url, {
            ...axiosConfig,
            headers: {
                ...axiosConfig.headers,
                Cookie: cookie
            },
        });

        const $ = cheerio.load(response.data);

        // Extract classes
        const classes = [];
        $('#selectedClass option').each((i, el) => {
            const value = $(el).attr('value');
            const text = $(el).text().trim();
            if (value && text) {
                classes.push({ id: value, name: text });
            }
        });

        // Extract teachers
        const teachers = [];
        $('#selectedTeacher option').each((i, el) => {
            let value = $(el).attr('value');
            const text = $(el).text().trim();
            // If ID is empty but name exists, use name as ID (same as /api/definitions)
            if ((!value || value.trim() === '') && text) {
                value = text;
            }
            if (value && text) {
                teachers.push({ id: value, name: text });
            }
        });

        // Extract rooms
        const rooms = [];
        $('#selectedRoom option').each((i, el) => {
            const value = $(el).attr('value');
            const text = $(el).text().trim();
            if (value && text) {
                rooms.push({ id: value, name: text });
            }
        });

        return { classes, teachers, rooms };
    } catch (error) {
        console.error('Failed to fetch definitions:', error.message);
        throw error;
    }
}

/**
 * Fetch single timetable from Bakalari API
 */
async function fetchTimetable(type, id, scheduleType, date = null) {
    try {
        // Get fresh login cookie (cached during prefetch run)
        const cookie = await loginToBakalari();

        let url = `${BAKALARI_BASE_URL}/Timetable/Public/${scheduleType}/${type}/${id}`;
        if (date) {
            url += `?date=${date}`;
        }

        const response = await axios.get(url, {
            ...axiosConfig,
            headers: {
                ...axiosConfig.headers,
                Cookie: cookie
            },
        });

        const $ = cheerio.load(response.data);
        const lessons = [];

        // Parse timetable (same logic as /api/timetable endpoint)
        $('.bk-timetable-row').each((rowIndex, row) => {
            const dayName = $(row).find('.bk-day-day').text().trim();
            const dayIndex = ['po', 'út', 'st', 'čt', 'pá'].indexOf(dayName.toLowerCase());

            $(row).find('.bk-timetable-cell').each((cellIndex, cell) => {
                const items = $(cell).find('.day-item-hover');
                items.each((_, item) => {
                    const detailRaw = $(item).attr('data-detail');
                    if (detailRaw) {
                        try {
                            const data = JSON.parse(detailRaw);

                            // Parse change info if exists
                            let changeInfo = null;
                            if (data.changeinfo) {
                                changeInfo = {
                                    raw: data.changeinfo,
                                    description: data.changeinfo
                                };
                            }

                            // Parse subject - handle removed/absent lessons specially
                            let subject = "";
                            let teacher = data.teacher || "";
                            let finalChangeInfo = changeInfo;

                            if (data.type === "removed" && data.removedinfo) {
                                // Parse removedinfo: "Vyjmuto z rozvrhu (PŘEDMĚT, UČITEL)"
                                const match = data.removedinfo.match(/\(([^,]+),\s*([^)]+)\)/);
                                if (match) {
                                    subject = match[1].trim();
                                    // Teacher name from removedinfo - abbreviate it (e.g., "Kozakovič Radko" → "R. Kozakovič")
                                    const fullTeacherName = match[2].trim();
                                    teacher = abbreviateTeacherName(fullTeacherName);
                                } else {
                                    subject = data.subjecttext ? data.subjecttext.split('|')[0].trim() : "";
                                }
                                finalChangeInfo = {
                                    raw: data.removedinfo,
                                    description: data.removedinfo
                                };
                            } else if (data.type === "absent" && data.InfoAbsentName) {
                                subject = data.InfoAbsentName;
                                if (subject && subject.length > 0) {
                                    subject = subject.charAt(0).toUpperCase() + subject.slice(1);
                                }
                                finalChangeInfo = {
                                    raw: data.absentinfo || "Absence",
                                    description: data.absentinfo ? `${data.InfoAbsentName} (${data.absentinfo})` : data.InfoAbsentName
                                };
                            } else {
                                subject = data.subjecttext ? data.subjecttext.split('|')[0].trim() : "";
                            }

                            lessons.push({
                                day: dayIndex,
                                dayName: dayName,
                                hour: cellIndex,
                                subject: subject || "",
                                teacher: teacher || "",
                                room: data.room || null,
                                group: data.group || null,
                                theme: data.theme || null,
                                type: data.type || "normal",
                                changed: !!(finalChangeInfo),
                                changeInfo: finalChangeInfo || null
                            });
                        } catch (e) {
                            // Skip invalid JSON
                        }
                    }
                });
            });
        });

        return lessons;
    } catch (error) {
        console.error(`Failed to fetch timetable ${type}/${id}/${scheduleType}:`, error.message);
        throw error;
    }
}

/**
 * Main prefetch function - downloads all data and stores in Firebase
 */
async function prefetchAllData() {
    console.log('\n🚀 Starting prefetch of all timetable data...');
    const startTime = Date.now();

    // Reset cookie cache for fresh login
    cachedSessionCookie = null;

    const db = getFirestore();
    let totalRequests = 0;
    let successCount = 0;
    let errorCount = 0;

    try {
        // Step 1: Fetch and store definitions
        console.log('\n📋 Fetching definitions...');
        const definitions = await fetchDefinitions();

        // Only save definitions if we got valid data (not empty)
        const totalEntitiesFetched = definitions.classes.length + definitions.teachers.length + definitions.rooms.length;
        if (totalEntitiesFetched === 0) {
            console.log('⚠️  WARNING: Fetched 0 definitions - cookie may be expired or API failed');
            console.log('⚠️  Keeping existing definitions in Firebase to prevent data loss');
            console.log('⚠️  Skipping prefetch to avoid overwriting valid data\n');
            return {
                success: false,
                totalRequests: 0,
                successCount: 0,
                errorCount: 0,
                duration: Date.now() - startTime,
                definitionsCount: 0,
                error: 'No definitions fetched - check cookie validity'
            };
        }

        await db.collection('definitions').doc('current').set({
            ...definitions,
            lastUpdate: new Date().toISOString(),
        });

        console.log(`✅ Definitions saved: ${definitions.classes.length} classes, ${definitions.teachers.length} teachers, ${definitions.rooms.length} rooms`);

        // Step 2: Calculate total requests
        const totalEntities = definitions.classes.length + definitions.teachers.length + definitions.rooms.length;
        const totalExpectedRequests = totalEntities * SCHEDULE_TYPES.length;
        console.log(`\n📊 Total entities: ${totalEntities}`);
        console.log(`📊 Total requests to make: ${totalExpectedRequests} (${SCHEDULE_TYPES.length} schedule types per entity)`);
        console.log(`📊 Parallel requests: ${CONCURRENT_REQUESTS}`);
        console.log(`⏱️  Estimated time: ~${Math.ceil(totalExpectedRequests / CONCURRENT_REQUESTS * 0.5 / 60)} minutes\n`);

        // Step 3: Fetch all timetables in parallel batches
        const entityGroups = [
            { type: 'Class', entities: definitions.classes },
            { type: 'Teacher', entities: definitions.teachers },
            { type: 'Room', entities: definitions.rooms },
        ];

        // Build task queue
        const tasks = [];
        for (const group of entityGroups) {
            for (const entity of group.entities) {
                for (const scheduleType of SCHEDULE_TYPES) {
                    tasks.push({
                        type: group.type,
                        entity: entity,
                        scheduleType: scheduleType
                    });
                }
            }
        }

        console.log(`\n📚 Processing ${tasks.length} timetables with ${CONCURRENT_REQUESTS} parallel requests...\n`);

        // Process tasks in parallel batches
        const processBatch = async (batch) => {
            return Promise.all(batch.map(async (task) => {
                totalRequests++;
                const progress = `[${totalRequests}/${totalExpectedRequests}]`;

                try {
                    // Fetch timetable
                    const timetableData = await fetchTimetable(task.type, task.entity.id, task.scheduleType);

                    const docKey = `${task.type}_${task.entity.id}_${task.scheduleType}`;

                    // Get previous snapshot for change detection
                    const previousDoc = await db.collection('timetables').doc(docKey).get();
                    const previousData = previousDoc.exists ? previousDoc.data().data : null;

                    // Detect changes if previous snapshot exists
                    let hasChanges = false;
                    if (previousData && previousData.length > 0) {
                        const metadata = {
                            type: task.type,
                            id: task.entity.id,
                            name: task.entity.name,
                            scheduleType: task.scheduleType
                        };

                        const changes = detectTimetableChanges(previousData, timetableData, metadata);

                        // Store detected changes
                        if (changes.length > 0) {
                            hasChanges = true;
                            const changeId = `${docKey}_${Date.now()}`;
                            await db.collection('changes').doc(changeId).set({
                                timetable: metadata,
                                changes: changes,
                                timestamp: new Date().toISOString(),
                                sent: false
                            });

                            console.log(`${progress} 🔔 ${changes.length} changes detected for ${task.entity.name}`);
                        }
                    }

                    // Check if data is identical to avoid unnecessary writes
                    // We write if:
                    // 1. It's a new document (!previousData)
                    // 2. We detected semantic changes (hasChanges)
                    // 3. The raw data is different (JSON comparison) - covers cases detectTimetableChanges might miss
                    const isDataIdentical = previousData && JSON.stringify(previousData) === JSON.stringify(timetableData);

                    if (!isDataIdentical) {
                        // Store new timetable in Firestore
                        await db.collection('timetables').doc(docKey).set({
                            type: task.type,
                            id: task.entity.id,
                            name: task.entity.name,
                            scheduleType: task.scheduleType,
                            data: timetableData,
                            lastUpdate: new Date().toISOString(),
                        });
                        successCount++;
                        console.log(`${progress} ✅ ${task.type}/${task.entity.name}/${task.scheduleType} (Updated)`);
                    } else {
                        // Skip write, but count as success
                        successCount++;
                        // Update lastUpdate timestamp only occasionally or not at all? 
                        // Let's NOT update it to save writes. The data hasn't changed.
                        console.log(`${progress} ⏭️  ${task.type}/${task.entity.name}/${task.scheduleType} (No changes, skipped write)`);
                    }

                } catch (error) {
                    errorCount++;
                    console.error(`${progress} ❌ ${task.type}/${task.entity.name}/${task.scheduleType}: ${error.message}`);
                }
            }));
        };

        // Process in batches
        for (let i = 0; i < tasks.length; i += CONCURRENT_REQUESTS) {
            const batch = tasks.slice(i, i + CONCURRENT_REQUESTS);
            await processBatch(batch);
        }

        // Step 4: Update metadata
        await db.collection('metadata').doc('lastPrefetch').set({
            timestamp: new Date().toISOString(),
            totalRequests,
            successCount,
            errorCount,
            duration: Date.now() - startTime,
        });

        // Summary
        const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
        console.log(`\n${'='.repeat(60)}`);
        console.log(`✅ Prefetch completed in ${duration} minutes`);
        console.log(`📊 Success: ${successCount}/${totalRequests}`);
        console.log(`❌ Errors: ${errorCount}/${totalRequests}`);
        console.log(`${'='.repeat(60)}\n`);

        return {
            success: true,
            totalRequests,
            successCount,
            errorCount,
            duration: Date.now() - startTime,
            definitionsCount: totalEntitiesFetched,
        };

    } catch (error) {
        console.error('\n❌ Prefetch failed:', error.message);
        throw error;
    }
}

module.exports = {
    prefetchAllData,
    fetchDefinitions,
    fetchTimetable,
};
