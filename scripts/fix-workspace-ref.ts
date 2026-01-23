import 'reflect-metadata';
import dotenv from 'dotenv';
import { container } from 'tsyringe';
import { connectMongo } from '../src/infra/database/mongoose.connection';
import { ConfigService } from '../src/config/config.service';
import { WorkspaceModel } from '../src/core/models/workspace.model';
import { WorkspaceMemberModel } from '../src/core/models/workspace-member.model';

dotenv.config();

const fix = async () => {
    console.log('🔧 Fixing workspace issue...');

    const config = container.resolve(ConfigService);
    await connectMongo(config.database.mongoUri, config.database.mongoDb);

    // Check all workspaces
    const allWorkspaces = await WorkspaceModel.find().exec();
    console.log(`\n📋 Found ${allWorkspaces.length} workspaces in database:`);
    allWorkspaces.forEach(w => {
        console.log(`  - ${w._id}: ${w.name} (${w.slug})`);
    });

    if (allWorkspaces.length === 0) {
        console.log('\n❌ No workspaces found! You need to create one first.');
        process.exit(1);
    }

    // Fix the WorkspaceMember to point to the first available workspace
    const userId = '6911005857106b9d427d135a';
    const targetWorkspace = allWorkspaces[0];

    console.log(`\n🔄 Updating WorkspaceMember to use workspace: ${targetWorkspace.name}`);

    const result = await WorkspaceMemberModel.updateOne(
        { userId },
        { $set: { workspaceId: targetWorkspace._id } }
    );

    console.log(`✅ Updated ${result.modifiedCount} WorkspaceMember record(s)`);

    // Verify
    const updated = await WorkspaceMemberModel.findOne({ userId })
        .populate('workspaceId', 'name')
        .exec();

    if (updated && updated.workspaceId) {
        const w = updated.workspaceId as any;
        console.log(`\n✅ Verification successful!`);
        console.log(`   User is now member of: ${w.name}`);
    } else {
        console.log(`\n❌ Verification failed - populate still not working`);
    }

    process.exit(0);
};

fix().catch(console.error);
