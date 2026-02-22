import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function fixIndex() {
    try {
        console.log("URI present:", !!process.env.MONGO_URI);
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/bot-fut');
        const db = mongoose.connection.db;
        if (!db) throw new Error("No db connection");

        console.log("Connected to MongoDB.");
        const collection = db.collection('playerratings');

        const indexes = await collection.indexes();
        console.log("Current indexes:", indexes.map(i => i.name));

        const oldIndexName = 'raterId_1_ratedId_1';
        const hasOldIndex = indexes.some(i => i.name === oldIndexName);

        if (hasOldIndex) {
            console.log(`Dropping old index ${oldIndexName}...`);
            await collection.dropIndex(oldIndexName);
            console.log("Old index dropped.");
        } else {
            console.log("Old index not found.");
        }
    } catch (err) {
        console.error("Error:", err);
    } finally {
        await mongoose.disconnect();
    }
}

fixIndex();
