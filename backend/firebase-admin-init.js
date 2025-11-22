/**
 * Firebase Admin SDK Initialization
 * Initializes Firebase Admin for server-side operations (Firestore writes, auth)
 */

const admin = require('firebase-admin');
const path = require('path');

let firebaseApp = null;
let db = null;

/**
 * Initialize Firebase Admin SDK
 * Requires FIREBASE_SERVICE_ACCOUNT_PATH in .env
 */
function initializeFirebaseAdmin() {
    if (firebaseApp) {
        console.log('Firebase Admin already initialized');
        return { app: firebaseApp, db };
    }

    try {
        const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

        if (!serviceAccountPath) {
            throw new Error(
                'FIREBASE_SERVICE_ACCOUNT_PATH not found in .env\n' +
                'Please add: FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json'
            );
        }

        // Load service account
        const serviceAccount = require(path.resolve(serviceAccountPath));

        // Initialize Firebase Admin
        firebaseApp = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });

        // Get Firestore instance
        db = admin.firestore();

        console.log('✅ Firebase Admin initialized successfully');
        console.log(`   Project: ${serviceAccount.project_id}`);

        return { app: firebaseApp, db };
    } catch (error) {
        console.error('❌ Failed to initialize Firebase Admin:', error.message);
        throw error;
    }
}

/**
 * Get Firestore database instance
 * @returns {FirebaseFirestore.Firestore}
 */
function getFirestore() {
    if (!db) {
        const result = initializeFirebaseAdmin();
        return result.db;
    }
    return db;
}

/**
 * Get Firebase Admin app instance
 * @returns {admin.app.App}
 */
function getFirebaseApp() {
    if (!firebaseApp) {
        const result = initializeFirebaseAdmin();
        return result.app;
    }
    return firebaseApp;
}

/**
 * Create custom auth token for client
 * @param {string} uid - User ID
 * @param {object} claims - Optional custom claims
 * @returns {Promise<string>} Custom token
 */
async function createCustomToken(uid, claims = {}) {
    try {
        const app = getFirebaseApp();
        const token = await app.auth().createCustomToken(uid, claims);
        return token;
    } catch (error) {
        console.error('Failed to create custom token:', error);
        throw error;
    }
}

module.exports = {
    initializeFirebaseAdmin,
    getFirestore,
    getFirebaseApp,
    createCustomToken,
};
