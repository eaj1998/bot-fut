import 'reflect-metadata';
import dotenv from 'dotenv';
import { container } from 'tsyringe';
import { connectMongo } from '../src/infra/database/mongoose.connection';
import { ConfigService } from '../src/config/config.service';
import { WorkspaceMemberModel } from '../src/core/models/workspace-member.model';
import { WorkspaceModel } from '../src/core/models/workspace.model';

dotenv.config();

const debug = async () => {
    console.log('🔍 Debugging workspace population...');

    const config = container.resolve(ConfigService);
    await connectMongo(config.database.mongoUri, config.database.mongoDb);

    const userId = '6911005857106b9d427d135a';

    // Check WorkspaceMember
    const members = await WorkspaceMemberModel.find({ userId }).exec();
    console.log(`\n📋 Found ${members.length} WorkspaceMember records:`);
    members.forEach(m => {
        console.log(`  - ID: ${m._id}`);
        console.log(`    WorkspaceId: ${m.workspaceId}`);
        console.log(`    Status: ${m.status}`);
        console.log(`    Roles: ${m.roles}`);
    });

    // Check if workspace exists
    if (members.length > 0) {
        const workspaceId = members[0].workspaceId;
        const workspace = await WorkspaceModel.findById(workspaceId).exec();
        console.log(`\n🏢 Workspace ${workspaceId}:`);
        if (workspace) {
            console.log(`  ✅ EXISTS`);
            console.log(`  Name: ${workspace.name}`);
            console.log(`  Slug: ${workspace.slug}`);
        } else {
            console.log(`  ❌ NOT FOUND - This is the problem!`);
        }
    }

    // Test populate
    console.log(`\n🔗 Testing populate...`);
    const populated = await WorkspaceMemberModel.find({ userId, status: 'ACTIVE' })
        .populate('workspaceId', 'name')
        .exec();

    console.log(`Found ${populated.length} active members`);
    populated.forEach(m => {
        console.log(`  - Member ID: ${m._id}`);
        console.log(`    WorkspaceId populated: ${m.workspaceId ? 'YES' : 'NO'}`);
        if (m.workspaceId) {
            const w = m.workspaceId as any;
            console.log(`    Workspace name: ${w.name || 'N/A'}`);
            console.log(`    Workspace _id: ${w._id || 'N/A'}`);
        }
    });

    process.exit(0);
};

debug().catch(console.error);
