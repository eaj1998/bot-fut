
import 'reflect-metadata';
import mongoose from 'mongoose';
import { container } from 'tsyringe';
import { PlayersService } from '../src/services/players.service';
import { UserModel } from '../src/core/models/user.model';
import { TransactionModel } from '../src/core/models/transaction.model';
import { GameModel } from '../src/core/models/game.model';
import { MembershipModel } from '../src/core/models/membership.model';
import { WorkspaceMemberModel } from '../src/core/models/workspace-member.model';
import { UserRepository } from '../src/core/repositories/user.repository';
import { TransactionRepository } from '../src/core/repositories/transaction.repository';
import { GameRepository } from '../src/core/repositories/game.respository';
import { MembershipRepository } from '../src/core/repositories/membership.repository';
import { LoggerService } from '../src/logger/logger.service';

// Mock dependencies
container.register('USER_REPOSITORY_TOKEN', { useClass: UserRepository });
container.register('TRANSACTION_REPOSITORY_TOKEN', { useClass: TransactionRepository });
container.register('GAME_REPOSITORY_TOKEN', { useClass: GameRepository });
container.register('MEMBERSHIP_REPOSITORY_TOKEN', { useClass: MembershipRepository });
container.register('WORKSPACE_MEMBER_MODEL_TOKEN', { useValue: WorkspaceMemberModel });
container.register(LoggerService, { useValue: { info: () => { }, error: () => { }, warn: () => { } } } as any);

// Register models for Repositories
container.registerInstance('UserModel', UserModel);
container.registerInstance('TransactionModel', TransactionModel);
container.registerInstance('GameModel', GameModel);
container.registerInstance('MembershipModel', MembershipModel);

import dotenv from 'dotenv';
dotenv.config();

// ... imports

async function main() {
    // Connect to MongoDB
    const MONGODB_URI = process.env.MONGO_URI || 'mongodb+srv://edipo1998_db_user:l6p6nhOOQToXD6DD@botfuthml.6gsjmrq.mongodb.net/?appName=botFutHml';
    const DB_NAME = process.env.MONGO_DB || 'botFutHml';

    await mongoose.connect(MONGODB_URI, {
        dbName: DB_NAME
    });
    console.log(`Connected to MongoDB: ${DB_NAME}`);

    const playersService = container.resolve(PlayersService);

    // 1. Create a test user
    const timestamp = Date.now();
    const phone = `551199999${timestamp.toString().slice(-4)}`;
    const createDto = {
        name: `Test Player ${timestamp}`,
        phoneE164: phone,
        type: 'AVULSO' as const,
        workspaceId: new mongoose.Types.ObjectId().toString(), // Dummy workspace ID
        position: 'MIDFIELDER' as const
    };

    console.log(`Creating user: ${createDto.name}`);
    // Manually create to avoid validation issues in service if any
    const user = await UserModel.create({
        name: createDto.name,
        phoneE164: createDto.phoneE164,
        playerType: createDto.type,
        workspaceId: createDto.workspaceId,
        position: 'MIDFIELDER',
        isGoalie: false,
        profile: {
            mainPosition: 'MEI',
            rating: 3
        }
    });
    const userId = user._id.toString();
    console.log(`User created: ${userId}`);

    try {
        // 2. Update with Profile - Case 1: Change to GOL
        console.log('--- Test Case 1: Update to GOL ---');
        const updateDto1 = {
            profile: {
                mainPosition: 'GOL' as const,
                rating: 4.5,
                dominantFoot: 'LEFT' as const
            }
        };

        const updated1 = await playersService.updatePlayer(userId, updateDto1);
        console.log('Updated 1 Result:', JSON.stringify(updated1.profile, null, 2));

        // Use standard mongoose findById to check raw doc
        const doc1 = await UserModel.findById(userId);
        if (doc1?.isGoalie === true && doc1?.position === 'GOALKEEPER') {
            console.log('SUCCESS: isGoalie=true, position=GOALKEEPER');
        } else {
            console.error('FAILURE: Legacy fields not synced correctly for GOL');
            console.log('Actual:', { isGoalie: doc1?.isGoalie, position: doc1?.position });
        }


        // 3. Update with Profile - Case 2: Change to ATA
        console.log('--- Test Case 2: Update to ATA ---');
        const updateDto2 = {
            profile: {
                mainPosition: 'ATA' as const
            }
        };

        const updated2 = await playersService.updatePlayer(userId, updateDto2);
        console.log('Updated 2 Result:', JSON.stringify(updated2.profile, null, 2));
        const doc2 = await UserModel.findById(userId);

        if (doc2?.position === 'STRIKER') {
            console.log('SUCCESS: position=STRIKER');
        } else {
            console.error('FAILURE: Legacy fields not synced for ATA');
            console.log('Actual:', { position: doc2?.position });
        }

        // 4. Verify Profile Persistence
        if (doc2?.profile?.dominantFoot === 'LEFT' && doc2?.profile?.rating === 4.5) {
            console.log('SUCCESS: Other profile fields persisted (dominantFoot, rating)');
        } else {
            console.error('FAILURE: Other profile fields lost');
            console.log('Actual:', doc2?.profile);
        }

    } catch (err) {
        console.error('Error during verification:', err);
    } finally {
        // Cleanup
        console.log('Cleaning up...');
        await UserModel.deleteOne({ _id: userId });
        await mongoose.disconnect();
    }
}

main().catch(console.error);
