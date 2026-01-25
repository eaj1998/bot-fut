
import "reflect-metadata";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { LedgerModel } from "../src/core/models/ledger.model";
import { TransactionModel, TransactionStatus, TransactionType, TransactionCategory } from "../src/core/models/transaction.model";
import { WorkspaceModel } from "../src/core/models/workspace.model";

dotenv.config();

// Hardcode or ensure DB name exists. The env var lacks it.
const MONGODB_URI = process.env.MONGO_URI?.includes('botFutHml') && !process.env.MONGO_URI.includes('.net/botFutHml')
    ? process.env.MONGO_URI.replace('.net/?', '.net/botFutHml?')
    : (process.env.MONGO_URI || "mongodb://localhost:27017/bot-fut");

async function connectDB() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log("Connected to MongoDB");
    } catch (error) {
        console.error("Error connecting to MongoDB", error);
        process.exit(1);
    }
}

function mapStatus(ledgerStatus: string): TransactionStatus {
    switch (ledgerStatus) {
        case "confirmado": return TransactionStatus.COMPLETED;
        case "estornado": return TransactionStatus.CANCELLED;
        case "pendente": default: return TransactionStatus.PENDING;
    }
}

function mapType(ledgerType: string): TransactionType {
    return ledgerType === "credit" ? TransactionType.INCOME : TransactionType.EXPENSE;
}

function mapCategory(ledgerCategory: string, ledgerType: string): TransactionCategory {
    switch (ledgerCategory) {
        case "field-payment": return TransactionCategory.FIELD_RENTAL;
        case "player-payment": return TransactionCategory.GAME_FEE;
        case "player-debt": return TransactionCategory.GAME_FEE;
        case "equipment": return TransactionCategory.EQUIPMENT;
        case "rental-goalkeeper": return TransactionCategory.OTHER; // Or maybe REFEREE? Assuming Other for now
        case "churrasco": return TransactionCategory.OTHER;
        default: return TransactionCategory.OTHER;
    }
}

async function migrateLedgers() {
    console.log("Starting Ledger migration...");

    const ledgers = await LedgerModel.find({});
    console.log(`Found ${ledgers.length} ledgers to migrate.`);

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const ledger of ledgers) {
        try {
            // Check for existing transaction (Idempotency)
            const existing = await TransactionModel.findOne({ legacyLedgerId: ledger._id });
            if (existing) {
                // console.log(`Skipping Ledger ${ledger._id}, already migrated as Transaction ${existing._id}`);
                skippedCount++;
                continue;
            }

            // Description logic
            let description = ledger.note || "";
            if (ledger.category === "churrasco") description = `[CHURRASCO] ${description}`;
            if (ledger.category === "rental-goalkeeper") description = `[GOLEIRO] ${description}`;
            if (!description) description = `Migrado de Ledger (${ledger.category})`;

            // Create Transaction
            const transaction = new TransactionModel({
                workspaceId: ledger.workspaceId,
                legacyLedgerId: ledger._id, // Store linkage

                userId: ledger.userId,
                gameId: ledger.gameId,
                membershipId: undefined, // Ledger didn't have memberships usually

                type: mapType(ledger.type),
                category: mapCategory(ledger.category, ledger.type),
                status: mapStatus(ledger.status),

                amount: ledger.amountCents, // Transaction uses cents too

                dueDate: ledger.createdAt, // Default due date to creation
                paidAt: ledger.confirmedAt,

                description: description.trim(),
                method: ledger.method,
                organizzeId: ledger.organizzeId,

                createdAt: ledger.createdAt,
                updatedAt: ledger.updatedAt
            });

            await transaction.save();
            migratedCount++;

            if (migratedCount % 100 === 0) {
                console.log(`Migrated ${migratedCount} ledgers...`);
            }

        } catch (error) {
            console.error(`Error migrating ledger ${ledger._id}:`, error);
            errorCount++;
        }
    }

    console.log(`Migration finished.`);
    console.log(`Total: ${ledgers.length}`);
    console.log(`Migrated: ${migratedCount}`);
    console.log(`Skipped: ${skippedCount}`);
    console.log(`Errors: ${errorCount}`);
}

import { UserModel } from "../src/core/models/user.model";
import { WorkspaceMemberModel } from "../src/core/models/workspace-member.model";

// ... existing imports

async function migrateWorkspaceMembers() {
    console.log("Starting Workspace Member migration...");

    // Find users with legacy workspaceId
    const users = await UserModel.find();
    console.log(`Found ${users.length} users with legacy workspaceId.`);

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const user of users) {
        try {
            if (!user.workspaceId) continue;

            // Check if member exists
            const existing = await WorkspaceMemberModel.findOne({
                userId: user._id,
                workspaceId: user.workspaceId
            });

            if (existing) {
                skippedCount++;
                continue;
            }

            // Create Member
            const member = new WorkspaceMemberModel({
                userId: user._id,
                workspaceId: user.workspaceId,
                roles: user.role ? [user.role] : ['user'],
                status: 'ACTIVE',
                joinedAt: user.createdAt || new Date()
            });

            await member.save();
            migratedCount++;
        } catch (error) {
            console.error(`Error migrating user ${user._id}:`, error);
            errorCount++;
        }
    }

    console.log(`Workspace Member Migration finished.`);
    console.log(`Migrated: ${migratedCount}`);
    console.log(`Skipped: ${skippedCount}`);
    console.log(`Errors: ${errorCount}`);
}

async function run() {
    await connectDB();
    await migrateWorkspaceMembers();
    await migrateLedgers();
    await mongoose.disconnect();
}

run();
