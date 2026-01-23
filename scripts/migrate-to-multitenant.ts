
import 'reflect-metadata';
import dotenv from 'dotenv';
import { container } from 'tsyringe';
import { connectMongo } from '../src/infra/database/mongoose.connection';
import { ConfigService } from '../src/config/config.service';
import { UserModel } from '../src/core/models/user.model';
import { WorkspaceMemberModel } from '../src/core/models/workspace-member.model';
import mongoose from 'mongoose';

dotenv.config();

const migrate = async () => {
    console.log('🚀 Starting migration to multi-tenant...');

    // Connect to DB
    const config = container.resolve(ConfigService);
    await connectMongo(config.database.mongoUri, config.database.mongoDb);

    const users = await UserModel.find({ workspaceId: { $exists: true, $ne: null } });
    console.log(`Found ${users.length} users with legacy workspaceId`);

    let createdCount = 0;
    let errorsCount = 0;

    for (const user of users) {
        try {
            // Check if member already exists
            const exists = await WorkspaceMemberModel.exists({
                userId: user._id,
                workspaceId: user.workspaceId
            });

            if (!exists && user.workspaceId) {
                // Map legacy role to new roles array
                // If user.role is 'admin', add 'ADMIN', else 'PLAYER' matches logic from prompt?
                // Prompt: "Defina o role como 'ADMIN' se ele era dono, ou 'PLAYER' caso contrário."
                // User model has role 'admin' | 'user'. So 'admin' -> ['ADMIN'], 'user' -> ['PLAYER']

                const roles = user.role === 'admin' ? ['ADMIN'] : ['PLAYER'];

                await WorkspaceMemberModel.create({
                    userId: user._id,
                    workspaceId: user.workspaceId,
                    roles: roles,
                    status: 'ACTIVE',
                    nickname: user.nick || user.name
                });

                createdCount++;
            }

            // Update lastAccessedWorkspaceId if not set
            if (!user.lastAccessedWorkspaceId && user.workspaceId) {
                user.lastAccessedWorkspaceId = user.workspaceId;
                await user.save();
            }

        } catch (err) {
            console.error(`Error migrating user ${user._id}:`, err);
            errorsCount++;
        }
    }

    console.log(`✅ Migration finished.`);
    console.log(`Created Members: ${createdCount}`);
    console.log(`Errors: ${errorsCount}`);

    await mongoose.disconnect();
    process.exit(0);
};

migrate().catch(console.error);
