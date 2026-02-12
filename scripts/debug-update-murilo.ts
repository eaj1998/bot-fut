
import 'reflect-metadata';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { UserModal, IUser } from '../src/core/models/user.model';

dotenv.config();

async function main() {
    const MONGODB_URI = process.env.MONGO_URI || 'mongodb+srv://edipo1998_db_user:l6p6nhOOQToXD6DD@botfuthml.6gsjmrq.mongodb.net/?appName=botFutHml';
    const DB_NAME = process.env.MONGO_DB || 'botFutHml';

    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, {
        dbName: DB_NAME
    });
    console.log('Connected');

    const targetId = '6988e9ce56a73c4a5261d87a'; // Murilo

    // 1. Check current state
    const userBefore = await mongoose.model('User').findById(targetId);
    console.log('User Before:', userBefore ? userBefore.toObject() : 'Not Found');

    if (!userBefore) {
        console.error('User not found, aborting');
        process.exit(1);
    }

    // 2. Attempt raw update via Mongoose
    console.log('Attempting update via mongoose directly...');
    const updateData = {
        profile: {
            mainPosition: 'GOL',
            rating: 4.0,
            ratingCount: 0,
            dominantFoot: 'RIGHT',
            secondaryPositions: []
        }
    };

    // Using simple set to avoid complications first
    const updated = await mongoose.model('User').findByIdAndUpdate(targetId, {
        $set: { profile: updateData.profile }
    }, { new: true });

    console.log('Update Result:', updated ? updated.toObject().profile : 'Update returned null');

    // 3. Verify persistence
    const userAfter = await mongoose.model('User').findById(targetId);
    console.log('User After Refetch:', userAfter ? userAfter.toObject().profile : 'Not Found');

    await mongoose.disconnect();
}

main().catch(console.error);
