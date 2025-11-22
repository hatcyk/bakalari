/**
 * Cron Job Scheduler
 * Automatically runs prefetch every hour
 */

const cron = require('node-cron');
const { prefetchAllData } = require('./prefetch');
const { initializeFirebaseAdmin } = require('./firebase-admin-init');

let cronJob = null;
let isRunning = false;

/**
 * Run prefetch with error handling and status tracking
 */
async function runPrefetch() {
    if (isRunning) {
        console.log('⏭️  Prefetch already running, skipping this run');
        return;
    }

    isRunning = true;
    const startTime = new Date();

    console.log(`\n${'='.repeat(60)}`);
    console.log(`🕐 Prefetch started at: ${startTime.toLocaleString('cs-CZ')}`);
    console.log(`${'='.repeat(60)}`);

    try {
        const result = await prefetchAllData();

        console.log(`✅ Prefetch successful`);
        console.log(`   Duration: ${(result.duration / 1000 / 60).toFixed(2)} minutes`);
        console.log(`   Success: ${result.successCount}/${result.totalRequests}`);

    } catch (error) {
        console.error(`❌ Prefetch failed:`, error.message);
        console.error(error.stack);

    } finally {
        isRunning = false;
        const endTime = new Date();
        console.log(`🕐 Prefetch ended at: ${endTime.toLocaleString('cs-CZ')}\n`);
    }
}

/**
 * Start cron job scheduler
 * Runs every hour at minute 0 (e.g., 14:00, 15:00, 16:00)
 */
function startCronJob() {
    if (cronJob) {
        console.log('⚠️  Cron job already running');
        return;
    }

    // Initialize Firebase first
    try {
        initializeFirebaseAdmin();
    } catch (error) {
        console.error('Failed to initialize Firebase, cron job not started');
        return;
    }

    // Run immediately on startup
    console.log('🚀 Running initial prefetch on startup...');
    runPrefetch().catch(err => console.error('Initial prefetch failed:', err));

    // Schedule cron: Every hour at minute 0
    // Cron format: minute hour day month weekday
    // '0 * * * *' = every hour at minute 0
    cronJob = cron.schedule('0 * * * *', () => {
        console.log('⏰ Hourly prefetch triggered');
        runPrefetch().catch(err => console.error('Scheduled prefetch failed:', err));
    });

    console.log('✅ Cron job scheduled: Running every hour at minute 0');
    console.log('   Next run will be at the top of the next hour\n');
}

/**
 * Stop cron job
 */
function stopCronJob() {
    if (cronJob) {
        cronJob.stop();
        cronJob = null;
        console.log('🛑 Cron job stopped');
    }
}

/**
 * Get cron job status
 */
function getCronStatus() {
    return {
        running: cronJob !== null,
        prefetchInProgress: isRunning,
    };
}

/**
 * Manually trigger prefetch (for testing or manual refresh)
 */
async function triggerManualPrefetch() {
    console.log('🔧 Manual prefetch triggered');
    return runPrefetch();
}

module.exports = {
    startCronJob,
    stopCronJob,
    getCronStatus,
    triggerManualPrefetch,
};
