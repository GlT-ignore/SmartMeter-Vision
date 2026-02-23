const admin = require('firebase-admin');
const fs = require('fs');

// Load YOUR Firebase service account
// You'll need to download this from YOUR Firebase project settings
const serviceAccount = require('./my-firebase-key.json');

// Initialize Firebase Admin
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function importCollection(collectionName, data) {
    console.log(`Importing ${collectionName}...`);

    let batch = db.batch();
    let count = 0;

    for (const [docId, docData] of Object.entries(data)) {
        const ref = db.collection(collectionName).doc(docId);
        batch.set(ref, docData);
        count++;

        // Firestore batch limit is 500 operations, but we use 1 
        // to stay within the 10MB payload size limit for extremely large documents.
        if (count % 1 === 0) {
            await batch.commit();
            console.log(`  Committed ${count} documents...`);
            batch = db.batch(); // Create new batch for next documents
        }
    }

    // Commit remaining documents
    if (count % 500 !== 0) {
        await batch.commit();
    }

    console.log(`  ✓ ${collectionName}: ${count} documents imported`);
}

async function importAllData(backupFile) {
    try {
        console.log(`Reading backup from: ${backupFile}\n`);
        const backup = JSON.parse(fs.readFileSync(backupFile, 'utf8'));

        console.log('Starting Firebase import...\n');

        if (backup.settings) await importCollection('settings', backup.settings);
        if (backup.users) await importCollection('users', backup.users);
        if (backup.flats) await importCollection('flats', backup.flats);
        if (backup.readings) await importCollection('readings', backup.readings);

        console.log('\n✅ Import complete!');
        console.log('\nSummary:');
        console.log(`  Settings: ${Object.keys(backup.settings || {}).length} documents`);
        console.log(`  Users: ${Object.keys(backup.users || {}).length} documents`);
        console.log(`  Flats: ${Object.keys(backup.flats || {}).length} documents`);
        console.log(`  Readings: ${Object.keys(backup.readings || {}).length} documents`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Import failed:', error);
        if (error.stack) console.error(error.stack);
        process.exit(1);
    }
}

// Get backup filename from command line argument
const backupFile = process.argv[2];

if (!backupFile) {
    console.error('❌ Please provide a backup file as argument');
    console.error('Usage: node import-firebase.js <backup-file.json>');
    process.exit(1);
}

importAllData(backupFile);
