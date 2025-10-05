const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
const ENV_DB = process.env.MONGO_DB;

let client;
let db;

async function connectDB() {
  try {
    client = new MongoClient(MONGO_URI);
    await client.connect();
    // Pick DB name: prefer MONGO_DB, else parse from URI path, else fallback
    let dbName = ENV_DB;
    if (!dbName) {
      try {
        const withoutParams = MONGO_URI.split('?')[0];
        const parts = withoutParams.split('/');
        const last = parts[parts.length - 1];
        if (last && last.includes('mongodb')) {
          // URI without path
        } else if (last) {
          dbName = last;
        }
      } catch (e) {}
    }
    dbName = dbName || 'resumerag';
    db = client.db(dbName);

    // Indexes
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    await db.collection('resumes').createIndex({ text: 'text', skills: 'text' });
    await db.collection('resumes').createIndex({ skills: 1 });
    await db.collection('idempotencyKeys').createIndex({ key: 1, user: 1 }, { unique: true });

    console.log('MongoDB connected (native driver)');
  } catch (err) {
    console.error('MongoDB connection error', err.message);
    process.exit(1);
  }
}

function getDb() {
  if (!db) throw new Error('DB not initialized');
  return db;
}

function Users() { return getDb().collection('users'); }
function Resumes() { return getDb().collection('resumes'); }
function Jobs() { return getDb().collection('jobs'); }
function IdempotencyKeys() { return getDb().collection('idempotencyKeys'); }

module.exports = { connectDB, getDb, Users, Resumes, Jobs, IdempotencyKeys, ObjectId };
