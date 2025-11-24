/**
 * Firebase Cloud Messaging Module
 * Handles push notifications to users
 */

const { getFirestore, getMessaging } = require('./firebase-admin-init');
const { createChangeSummary } = require('./change-detector');

/**
 * Send notification to a single FCM token
 * @param {String} token - FCM device token
 * @param {Object} notification - Notification payload
 * @returns {Promise<String>} Message ID
 */
async function sendNotificationToToken(token, notification) {
    try {
        const messaging = getMessaging();

        const message = {
            data: {
                title: notification.title,
                body: notification.body,
                icon: notification.icon || '/icon-192.png',
                ...(notification.data || {})
            },
            token: token,
            webpush: {
                notification: {
                    icon: notification.icon || '/icon-192.png',
                    badge: '/icon-192.png'
                }
            }
        };

        const response = await messaging.send(message);
        console.log(`✅ Notification sent to token ${token.substring(0, 20)}...`);
        return response;

    } catch (error) {
        console.error(`❌ Failed to send notification to token ${token.substring(0, 20)}...:`, error.message);
        throw error;
    }
}

/**
 * Send notification to multiple FCM tokens
 * @param {Array<String>} tokens - Array of FCM device tokens
 * @param {Object} notification - Notification payload
 * @returns {Promise<Object>} Result with success/failure counts
 */
async function sendNotificationToTokens(tokens, notification) {
    if (!tokens || tokens.length === 0) {
        console.log('⚠️  No tokens to send notification to');
        return { successCount: 0, failureCount: 0 };
    }

    try {
        const messaging = getMessaging();

        const message = {
            data: {
                title: notification.title,
                body: notification.body,
                icon: notification.icon || '/icon-192.png',
                ...(notification.data || {})
            },
            tokens: tokens,
            webpush: {
                notification: {
                    icon: notification.icon || '/icon-192.png',
                    badge: '/icon-192.png'
                }
            }
        };

        const response = await messaging.sendEachForMulticast(message);

        console.log(`✅ Sent notification to ${response.successCount}/${tokens.length} devices`);

        if (response.failureCount > 0) {
            console.warn(`⚠️  Failed to send to ${response.failureCount} devices`);
        }

        return {
            successCount: response.successCount,
            failureCount: response.failureCount,
            responses: response.responses
        };

    } catch (error) {
        console.error(`❌ Failed to send multicast notification:`, error.message);
        throw error;
    }
}

/**
 * Get all users watching a specific timetable
 * @param {Object} timetable - Timetable metadata (type, id, scheduleType)
 * @returns {Promise<Array>} Array of user IDs and their tokens
 */
async function getUsersWatchingTimetable(timetable) {
    try {
        const db = getFirestore();

        // Query all users
        const usersSnapshot = await db.collection('users').get();

        const watchingUsers = [];

        usersSnapshot.forEach(userDoc => {
            const userData = userDoc.data();
            const preferences = userData.preferences;

            if (!preferences || !preferences.watchedTimetables) {
                return;
            }

            // Check if user is watching this timetable
            const isWatching = preferences.watchedTimetables.some(watched =>
                watched.type === timetable.type &&
                watched.id === timetable.id &&
                watched.scheduleType === timetable.scheduleType
            );

            if (isWatching && userData.tokens && userData.tokens.length > 0) {
                watchingUsers.push({
                    userId: userDoc.id,
                    tokens: userData.tokens
                });
            }
        });

        return watchingUsers;

    } catch (error) {
        console.error('Failed to get users watching timetable:', error.message);
        throw error;
    }
}

/**
 * Process pending changes and send notifications
 * This should be called periodically or triggered after prefetch
 */
async function processPendingChanges() {
    console.log('\n🔔 Processing pending notification changes...');

    try {
        const db = getFirestore();

        // Get all pending changes
        const changesSnapshot = await db.collection('changes')
            .where('sent', '==', false)
            .get();

        if (changesSnapshot.empty) {
            console.log('✅ No pending changes to process');
            return { processedCount: 0, sentCount: 0 };
        }

        console.log(`📊 Found ${changesSnapshot.size} pending change documents`);

        let processedCount = 0;
        let sentCount = 0;

        for (const changeDoc of changesSnapshot.docs) {
            const changeData = changeDoc.data();
            const timetable = changeData.timetable;
            const changes = changeData.changes;

            // Get users watching this timetable
            const watchingUsers = await getUsersWatchingTimetable(timetable);

            if (watchingUsers.length === 0) {
                console.log(`⏭️  Skipping ${timetable.name} - no users watching`);

                // Mark as sent even though no users are watching
                await changeDoc.ref.update({ sent: true, sentAt: new Date().toISOString() });
                processedCount++;
                continue;
            }

            // Create notification payload
            const summary = createChangeSummary(changes);
            const notification = {
                title: `Změny v rozvrhu: ${timetable.name}`,
                body: summary,
                data: {
                    type: 'timetable_change',
                    timetableType: timetable.type,
                    timetableId: timetable.id,
                    scheduleType: timetable.scheduleType,
                    changeCount: changes.length.toString(),
                    timestamp: new Date().toISOString()
                },
                icon: '/icon-192.png'
            };

            // Send to all watching users
            let totalSent = 0;

            for (const user of watchingUsers) {
                try {
                    const result = await sendNotificationToTokens(user.tokens, notification);
                    totalSent += result.successCount;
                } catch (error) {
                    console.error(`Failed to send to user ${user.userId}:`, error.message);
                }
            }

            // Mark as sent
            await changeDoc.ref.update({
                sent: true,
                sentAt: new Date().toISOString(),
                sentToUsers: watchingUsers.length,
                sentToDevices: totalSent
            });

            console.log(`✅ Sent notifications for ${timetable.name} to ${totalSent} devices`);

            processedCount++;
            sentCount += totalSent;
        }

        console.log(`\n✅ Processed ${processedCount} change documents, sent ${sentCount} notifications`);

        return { processedCount, sentCount };

    } catch (error) {
        console.error('❌ Failed to process pending changes:', error.message);
        throw error;
    }
}

/**
 * Send API outage notification to all users with notifications enabled
 */
async function sendApiOutageNotification() {
    console.log('\n⚠️  Sending API outage notification...');

    try {
        const db = getFirestore();

        // Get all users with tokens
        const usersSnapshot = await db.collection('users').get();

        const allTokens = [];

        usersSnapshot.forEach(userDoc => {
            const userData = userDoc.data();
            if (userData.tokens && userData.tokens.length > 0) {
                allTokens.push(...userData.tokens);
            }
        });

        if (allTokens.length === 0) {
            console.log('⚠️  No users to notify about API outage');
            return;
        }

        const notification = {
            title: 'Bakalari API není dostupné',
            body: 'Rozvrhy se momentálně nemohou aktualizovat. Zkusíme to znovu za chvíli.',
            data: {
                type: 'api_outage',
                timestamp: new Date().toISOString()
            },
            icon: '/icon-192.png'
        };

        const result = await sendNotificationToTokens(allTokens, notification);

        console.log(`✅ Sent API outage notification to ${result.successCount} devices`);

        return result;

    } catch (error) {
        console.error('❌ Failed to send API outage notification:', error.message);
        throw error;
    }
}

module.exports = {
    sendNotificationToToken,
    sendNotificationToTokens,
    getUsersWatchingTimetable,
    processPendingChanges,
    sendApiOutageNotification,
};
