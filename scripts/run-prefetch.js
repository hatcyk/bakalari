#!/usr/bin/env node

/**
 * Standalone Prefetch Script for GitHub Actions
 * Runs prefetch directly without Vercel serverless function limitations
 */

require('dotenv').config();
const { initializeFirebaseAdmin } = require('../backend/firebase-admin-init');
const { prefetchAllData } = require('../backend/prefetch');

async function main() {
    console.log('🚀 Starting prefetch from GitHub Actions...\n');

    try {
        // Initialize Firebase Admin
        console.log('🔥 Initializing Firebase Admin...');
        initializeFirebaseAdmin();
        console.log('✅ Firebase Admin initialized\n');

        // Run prefetch
        const result = await prefetchAllData();

        // Log results
        console.log('\n' + '='.repeat(60));
        console.log('✅ PREFETCH COMPLETED SUCCESSFULLY');
        console.log('='.repeat(60));
        console.log(`📊 Total requests: ${result.totalRequests}`);
        console.log(`✅ Successful: ${result.successCount}`);
        console.log(`❌ Errors: ${result.errorCount}`);
        console.log(`📚 Definitions: ${result.definitionsCount}`);
        console.log(`⏱️  Duration: ${(result.duration / 1000 / 60).toFixed(2)} minutes`);
        console.log('='.repeat(60) + '\n');

        // Exit with success
        process.exit(0);

    } catch (error) {
        console.error('\n' + '='.repeat(60));
        console.error('❌ PREFETCH FAILED');
        console.error('='.repeat(60));
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        console.error('='.repeat(60) + '\n');

        // Exit with error
        process.exit(1);
    }
}

// Run main function
main();
