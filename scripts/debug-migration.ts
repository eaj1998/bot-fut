
import "reflect-metadata";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { UserModel } from "../src/core/models/user.model";

dotenv.config();

const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://localhost:27017/bot-fut";

async function run() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log("Connected to MongoDB at", MONGODB_URI);

        if (!mongoose.connection.db) {
            console.error("Database connection failed or not established");
            return;
        }

        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log("Collections:", collections.map(c => c.name));

        const count = await UserModel.countDocuments();
        console.log("Total Users (via model):", count);

        // Check specific collections
        const userColl = collections.find(c => c.name === 'User');
        if (userColl) {
            const c = await mongoose.connection.db.collection('User').countDocuments();
            console.log("Count in 'User' collection:", c);
        }

        const usersColl = collections.find(c => c.name === 'users');
        if (usersColl) {
            const c = await mongoose.connection.db.collection('users').countDocuments();
            console.log("Count in 'users' collection:", c);
        }

        // Check workspaceId data shape
        const sampleUser = await UserModel.findOne({ workspaceId: { $exists: true } });
        console.log("Sample User with WorkspaceId:", sampleUser);

        // Check Ledgers
        const ledgersColl = collections.find(c => c.name === 'ledgers');
        if (ledgersColl) {
            const c = await mongoose.connection.db!.collection('ledgers').countDocuments();
            console.log("Count in 'ledgers' collection:", c);
        }

    } catch (error) {
        console.error(error);
    } finally {
        await mongoose.disconnect();
    }

    // Attempt Localhost check
    try {
        console.log("\n--- Checking Localhost ---");
        const LOCAL_URI = "mongodb://localhost:27017/bot-fut";
        await mongoose.connect(LOCAL_URI);
        console.log("Connected to Local MongoDB at", LOCAL_URI);

        if (mongoose.connection.db) {
            const userCount = await mongoose.connection.db.collection('users').countDocuments();
            console.log("Total users in Localhost 'users':", userCount);

            const ledgerCount = await mongoose.connection.db.collection('ledgers').countDocuments();
            console.log("Total ledgers in Localhost 'ledgers':", ledgerCount);
        }
    } catch (e) {
        console.log("Could not connect to localhost DB:", (e as Error).message);
    } finally {
        await mongoose.disconnect();
    }
}

run();
