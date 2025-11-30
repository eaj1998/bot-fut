import 'reflect-metadata';
import { config } from 'dotenv';
import { container } from 'tsyringe';
import { connect } from 'mongoose';
import { ConfigService } from '../src/config/config.service';
import { WorkspaceRepository } from '../src/core/repositories/workspace.repository';
import { WORKSPACE_MODEL_TOKEN, WorkspaceModel } from '../src/core/models/workspace.model';
import { CHAT_MODEL_TOKEN, ChatModel } from '../src/core/models/chat.model';
import { EncryptionUtil } from '../src/utils/encryption.util';

// Load environment variables
config();


/**
 * Migration script to populate existing workspaces with Organizze configuration
 * from environment variables
 * 
 * Usage: npm run migrate:organizze
 */

async function migrateOrganizzeConfig() {
    console.log('🚀 Starting Organizze configuration migration...\n');

    try {
        // Connect to database
        const config = container.resolve(ConfigService);
        await connect(config.database.mongoUri, {
            dbName: config.database.mongoDb,
        });
        console.log('✅ Connected to database\n');

        // Register dependencies
        container.register(WORKSPACE_MODEL_TOKEN, { useValue: WorkspaceModel });
        container.register(CHAT_MODEL_TOKEN, { useValue: ChatModel });

        const workspaceRepo = container.resolve(WorkspaceRepository);

        // Get Organizze config from environment
        const { email, apiKey, accountId, categoryId } = config.organizze;

        if (!email || !apiKey) {
            console.error('❌ ORGANIZE_EMAIL and ORGANIZE_API_KEY must be set in .env');
            process.exit(1);
        }

        console.log('📋 Environment Organizze Configuration:');
        console.log(`   Email: ${email}`);
        console.log(`   Account ID: ${accountId}`);
        console.log(`   Category ID (default): ${categoryId}\n`);

        // Fetch all workspaces
        const workspaces = await WorkspaceModel.find({}).lean();
        console.log(`📊 Found ${workspaces.length} workspace(s)\n`);

        if (workspaces.length === 0) {
            console.log('⚠️  No workspaces found. Nothing to migrate.');
            process.exit(0);
        }

        // Prepare Organizze config
        // Using the same category for all transaction types initially
        // Users can customize later via the UI
        const organizzeConfig = {
            email,
            apiKey,
            accountId,
            categories: {
                fieldPayment: 152985744,    // Default category for field payments
                playerPayment: 152977750,   // Default category for player payments
                playerDebt: 152977750,      // Default category for player debts
                general: 155927947,         // Default category for general transactions
            },
        };

        console.log('📝 Category Mapping (using default category for all):');
        console.log(`   Field Payment: ${categoryId}`);
        console.log(`   Player Payment: ${categoryId}`);
        console.log(`   Player Debt: ${categoryId}`);
        console.log(`   General: ${categoryId}\n`);

        // Update each workspace
        let successCount = 0;
        let errorCount = 0;

        for (const workspace of workspaces) {
            try {
                console.log(`⏳ Updating workspace: ${workspace.name} (${workspace._id})`);

                // Check if already has Organizze config
                if (workspace.organizzeConfig?.email) {
                    console.log(`   ⚠️  Already has Organizze config, skipping...\n`);
                    continue;
                }

                await workspaceRepo.updateOrganizzeConfig(
                    workspace._id.toString(),
                    organizzeConfig
                );

                console.log(`   ✅ Successfully updated\n`);
                successCount++;
            } catch (error: any) {
                console.error(`   ❌ Error: ${error.message}\n`);
                errorCount++;
            }
        }

        // Summary
        console.log('═══════════════════════════════════════');
        console.log('📊 Migration Summary:');
        console.log(`   Total workspaces: ${workspaces.length}`);
        console.log(`   Successfully updated: ${successCount}`);
        console.log(`   Errors: ${errorCount}`);
        console.log(`   Skipped (already configured): ${workspaces.length - successCount - errorCount}`);
        console.log('═══════════════════════════════════════\n');

        if (successCount > 0) {
            console.log('✅ Migration completed successfully!');
            console.log('\n💡 Next steps:');
            console.log('   1. Users can now customize category mappings via the UI');
            console.log('   2. Each workspace can have different Organizze credentials');
            console.log('   3. Update game.service.ts and debts.service.ts to use workspace config\n');
        }

        process.exit(0);
    } catch (error: any) {
        console.error('\n❌ Migration failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run migration
migrateOrganizzeConfig();
