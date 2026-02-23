const admin = require('firebase-admin');
const fs = require('fs');

// Load service account from the downloaded JSON file
const serviceAccount = require('./data9.json');

// Initialize Firebase Admin
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function exportCollection(collectionName) {
    console.log(`Exporting ${collectionName}...`);
    const snapshot = await db.collection(collectionName).get();
    const data = {};

    snapshot.forEach(doc => {
        data[doc.id] = doc.data();
    });

    console.log(`  ✓ ${collectionName}: ${snapshot.size} documents`);
    return data;
}

async function exportAllData() {
    try {
        console.log('Starting Firebase export...\n');

        const backup = {
            users: await exportCollection('users'),
            flats: await exportCollection('flats'),
            readings: await exportCollection('readings'),
            settings: await exportCollection('settings')
        };

        // Save to JSON file
        const filename = `firebase-backup-${new Date().toISOString().split('T')[0]}.json`;
        fs.writeFileSync(filename, JSON.stringify(backup, null, 2));

        console.log(`\n✅ Export complete! Saved to: ${filename}`);
        console.log('\nSummary:');
        console.log(`  Users: ${Object.keys(backup.users).length} documents`);
        console.log(`  Flats: ${Object.keys(backup.flats).length} documents`);
        console.log(`  Readings: ${Object.keys(backup.readings).length} documents`);
        console.log(`  Settings: ${Object.keys(backup.settings).length} documents`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Export failed:', error);
        process.exit(1);
    }
}

exportAllData();
