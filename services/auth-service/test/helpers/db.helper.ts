import * as mongoose from 'mongoose';

export async function clearDatabase() {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}

export async function clearCollection(name: string) {
  const collection = mongoose.connection.collections[name];
  if (collection) await collection.deleteMany({});
}
