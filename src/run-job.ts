import 'reflect-metadata';
import dotenv from 'dotenv';
import { container } from 'tsyringe';
import { connectMongo } from './infra/database/mongoose.connection';
import { ConfigService } from './config/config.service';
import { LoggerService } from './logger/logger.service';

// Import jobs
import { SuspendOverdueMembershipsJob } from './jobs/suspend-overdue-memberships.job';
import { GenerateMonthlyInvoicesJob } from './jobs/generate-monthly-invoices.job';

// Import models
import { USER_MODEL_TOKEN, UserModel } from './core/models/user.model';
import { WORKSPACE_MODEL_TOKEN, WorkspaceModel } from './core/models/workspace.model';
import { CHAT_MODEL_TOKEN, ChatModel } from './core/models/chat.model';
import { MEMBERSHIP_MODEL_TOKEN, MembershipModel } from './core/models/membership.model';
import { TRANSACTION_MODEL_TOKEN, TransactionModel } from './core/models/transaction.model';
import { WORKSPACE_MEMBER_MODEL_TOKEN, WorkspaceMemberModel } from './core/models/workspace-member.model';

// Import repositories
import { UserRepository } from './core/repositories/user.repository';
import { MembershipRepository, MEMBERSHIP_REPOSITORY_TOKEN } from './core/repositories/membership.repository';
import { TransactionRepository, TRANSACTION_REPOSITORY_TOKEN } from './core/repositories/transaction.repository';

// Import services
import { MembershipService, MEMBERSHIP_SERVICE_TOKEN } from './services/membership.service';

dotenv.config();

const logger = new LoggerService();
logger.setName('JobRunner');

async function bootstrap() {
    const jobName = process.argv[2];

    if (!jobName) {
        logger.error('No job name provided. Usage: node dist/run-job.js <JobName>');
        process.exit(1);
    }

    try {
        logger.info(`Initializing Database for job: ${jobName}...`);

        const config = container.resolve(ConfigService);
        await connectMongo(config.database.mongoUri, config.database.mongoDb);
        logger.info('Database connected.');

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

        // Resolve and run job
        if (jobName === 'SuspendOverdueMembershipsJob') {
            const job = container.resolve(SuspendOverdueMembershipsJob);
            await job.run();
        } else if (jobName === 'GenerateMonthlyInvoicesJob') {
            const job = container.resolve(GenerateMonthlyInvoicesJob);
            await job.run();
        } else {
            logger.error(`Unknown job name: ${jobName}`);
            process.exit(1);
        }

        logger.info(`Job ${jobName} completed successfully.`);
        process.exit(0);

    } catch (error) {
        logger.error(`Failed to run job ${jobName}:`, error);
        process.exit(1);
    }
}

bootstrap();
