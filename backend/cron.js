/**
 * Cron Job Scheduler
 * Automatically runs prefetch every 10 minutes
 */

const cron = require('node-cron');
const { prefetchAllData } = require('./prefetch');
const { initializeFirebaseAdmin } = require('./firebase-admin-init');

let cronJob = null;
let isRunning = false;

// Track last prefetch status
let lastPrefetchStatus = {
    isHealthy: false, // Start as unhealthy until first successful prefetch
    lastRun: null,
    lastSuccess: null,
    definitionsCount: 0,
    successCount: 0,
    totalRequests: 0,
    error: 'Waiting for first prefetch'
};

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

        // Update status - healthy if we got definitions
        lastPrefetchStatus = {
            isHealthy: result.definitionsCount > 0,
            lastRun: startTime,
            lastSuccess: startTime,
            definitionsCount: result.definitionsCount || 0,
            successCount: result.successCount,
            totalRequests: result.totalRequests,
            error: result.definitionsCount === 0 ? 'No definitions fetched - API may be down or cookie expired' : null
        };

    } catch (error) {
        console.error(`❌ Prefetch failed:`, error.message);
        console.error(error.stack);

        // Update status - unhealthy
        lastPrefetchStatus = {
            isHealthy: false,
            lastRun: startTime,
            lastSuccess: lastPrefetchStatus.lastSuccess,
            definitionsCount: 0,
            successCount: 0,
            totalRequests: 0,
            error: error.message
        };

    } finally {
        isRunning = false;
        const endTime = new Date();
        console.log(`🕐 Prefetch ended at: ${endTime.toLocaleString('cs-CZ')}\n`);
    }
}

/**
 * Start cron job scheduler
 * Runs every 10 minutes (e.g., 14:00, 14:10, 14:20, ...)
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

    // Schedule cron: Every 10 minutes
    // Cron format: minute hour day month weekday
    // '*/10 * * * *' = every 10 minutes
    cronJob = cron.schedule('*/10 * * * *', () => {
        console.log('⏰ 10-minute prefetch triggered');
        runPrefetch().catch(err => console.error('Scheduled prefetch failed:', err));
    });

    console.log('✅ Cron job scheduled: Running every 10 minutes');
    console.log('   Next run will be in approximately 10 minutes\n');
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
 * Get last prefetch status (for API health check)
 */
function getLastPrefetchStatus() {
    return {
        ...lastPrefetchStatus,
        prefetchInProgress: isRunning
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
    getLastPrefetchStatus,
    triggerManualPrefetch,
};
