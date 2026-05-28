import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error('MONGODB_URI is required. Add it to .env.local');
}

const globalForMongo = globalThis as unknown as {
  mongoClient: MongoClient | undefined;
};

export const mongoClient =
  globalForMongo.mongoClient ??
  new MongoClient(uri, {
    appName: 'CollegeShortlist',
  });

if (!globalForMongo.mongoClient) {
  globalForMongo.mongoClient = mongoClient;
}

export async function getDb() {
  const client = await mongoClient.connect();
  return client.db('shortlist');
}
