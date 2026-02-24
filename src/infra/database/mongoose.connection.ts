import mongoose from "mongoose";

export async function connectMongo(uri: string, db: string) {
  if (!uri) throw new Error("MONGO_URI não definido");
  await mongoose.connect(uri, { dbName: db });

  try {
    const collection = mongoose.connection.db?.collection('playerratings');
    if (collection) {
      const indexes = await collection.indexes();
      const hasOldIndex = indexes.some(i => i.name === 'raterId_1_ratedId_1');
      if (hasOldIndex) {
        console.log("Dropping old index raterId_1_ratedId_1...");
        await collection.dropIndex('raterId_1_ratedId_1');
        console.log("Old index dropped.");
      }
    }
  } catch (e) {
    console.error("Failed to drop old index", e);
  }
}


