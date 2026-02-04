import 'reflect-metadata';
import dotenv from 'dotenv';
import { container } from 'tsyringe';
import { connectMongo } from '../src/infra/database/mongoose.connection';
import { ConfigService } from '../src/config/config.service';
import { GenerateMonthlyInvoicesJob } from '../src/jobs/generate-monthly-invoices.job';
import { LoggerService } from '../src/logger/logger.service';

// Import models
import { USER_MODEL_TOKEN, UserModel } from '../src/core/models/user.model';
import { WORKSPACE_MODEL_TOKEN, WorkspaceModel } from '../src/core/models/workspace.model';
import { CHAT_MODEL_TOKEN, ChatModel } from '../src/core/models/chat.model';
import { MEMBERSHIP_MODEL_TOKEN, MembershipModel } from '../src/core/models/membership.model';
import { TRANSACTION_MODEL_TOKEN, TransactionModel } from '../src/core/models/transaction.model';
import { WORKSPACE_MEMBER_MODEL_TOKEN, WorkspaceMemberModel } from '../src/core/models/workspace-member.model';

// Import repositories
import { UserRepository } from '../src/core/repositories/user.repository';
import { MembershipRepository, MEMBERSHIP_REPOSITORY_TOKEN } from '../src/core/repositories/membership.repository';
import { TransactionRepository, TRANSACTION_REPOSITORY_TOKEN } from '../src/core/repositories/transaction.repository';

// Import services
import { MembershipService, MEMBERSHIP_SERVICE_TOKEN } from '../src/services/membership.service';

dotenv.config();

const main = async () => {
    console.log('--- Testing Invoice Generation Job ---');

    try {
        const config = container.resolve(ConfigService);
        await connectMongo(config.database.mongoUri, config.database.mongoDb);
        console.log('Connected to Mongo.');

        // Register models
        container.register(USER_MODEL_TOKEN, { useValue: UserModel });
        container.register(WORKSPACE_MODEL_TOKEN, { useValue: WorkspaceModel });
        container.register(CHAT_MODEL_TOKEN, { useValue: ChatModel });
        container.register(MEMBERSHIP_MODEL_TOKEN, { useValue: MembershipModel });
        container.register(TRANSACTION_MODEL_TOKEN, { useValue: TransactionModel });
        container.register(WORKSPACE_MEMBER_MODEL_TOKEN, { useValue: WorkspaceMemberModel });

        // Register repositories
        container.register('USER_REPOSITORY_TOKEN', { useClass: UserRepository });
        container.register(MEMBERSHIP_REPOSITORY_TOKEN, { useClass: MembershipRepository });
        container.register(TRANSACTION_REPOSITORY_TOKEN, { useClass: TransactionRepository });

        // Register services
        container.register(MEMBERSHIP_SERVICE_TOKEN, { useClass: MembershipService });

        const job = container.resolve(GenerateMonthlyInvoicesJob);

        console.log('Running job...');
        await job.run();

        console.log('Job finished successfully.');
    } catch (error) {
        console.error('Job failed:', error);
    }

    process.exit(0);
};

main();
