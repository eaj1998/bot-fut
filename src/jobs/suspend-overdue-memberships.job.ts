import { injectable, inject } from 'tsyringe';
import { MembershipRepository } from '../core/repositories/membership.repository';
import { TransactionRepository } from '../core/repositories/transaction.repository';
import { WorkspaceModel, WORKSPACE_MODEL_TOKEN } from '../core/models/workspace.model';
import { LoggerService } from '../logger/logger.service';
import { MembershipService } from '../services/membership.service';
import { TransactionType, TransactionCategory, TransactionStatus } from '../core/models/transaction.model';
import { MembershipStatus } from '../core/models/membership.model';
import { Model } from 'mongoose';

@injectable()
export class SuspendOverdueMembershipsJob {
    constructor(
        @inject(MembershipService) private membershipService: MembershipService,
        @inject(MembershipRepository) private membershipRepo: MembershipRepository,
        @inject(TransactionRepository) private transactionRepo: TransactionRepository,
        @inject(WORKSPACE_MODEL_TOKEN) private workspaceModel: Model<any>,
        @inject(LoggerService) private logger: LoggerService
    ) {
        this.logger.setName('SuspendOverdueMembershipsJob');
    }

    async run() {
        this.logger.info('Starting SuspendOverdueMembershipsJob...');
        const startTime = Date.now();
        let totalSuspended = 0;
        let totalErrors = 0;

        try {
            // 1. Fetch all active workspaces
            const workspaces = await this.workspaceModel.find({ active: { $ne: false } });

            this.logger.info(`Found ${workspaces.length} workspaces to process.`);

            for (const workspace of workspaces) {
                await this.processWorkspace(workspace._id.toString());
            }

        } catch (error) {
            this.logger.error('Critical error in SuspendOverdueMembershipsJob:', error);
        }

        const duration = (Date.now() - startTime) / 1000;
        this.logger.info(`Job finished in ${duration}s. Suspended: ${totalSuspended}. Errors: ${totalErrors}.`);
    }

    private async processWorkspace(workspaceId: string) {
        this.logger.info(`Processing workspace: ${workspaceId}`);

        try {
            const { memberships } = await this.membershipRepo.findByWorkspace(workspaceId, undefined, undefined, 1, 1000); // Pagination risk if > 1000

            const candidates = memberships.filter(m =>
                m.status !== MembershipStatus.INACTIVE &&
                m.status !== MembershipStatus.SUSPENDED
            );

            this.logger.debug(`Workspace ${workspaceId}: ${candidates.length} candidates for suspension check.`);

            for (const membership of candidates) {
                await this.checkAndCancel(workspaceId, membership);
            }

        } catch (error) {
            this.logger.error(`Error processing workspace ${workspaceId}:`, error);
        }
    }

    private async checkAndCancel(workspaceId: string, membership: any) {
        try {
            const pendingTransactions = await this.transactionRepo.findPendingTransactions(workspaceId, {
                category: TransactionCategory.MEMBERSHIP,
                type: TransactionType.INCOME
            });
            const now = new Date();
            const overdueTransaction = pendingTransactions.find(t =>
                t.membershipId?.toString() === membership._id.toString() &&
                new Date(t.dueDate) < now
            );

            if (overdueTransaction) {
                this.logger.info(`Marking user ${membership.user.name} (${membership._id}) as OVERDUE due to overdue transaction ${overdueTransaction._id} (Due: ${overdueTransaction.dueDate})`);

                // Mark transaction as overdue
                await this.transactionRepo.updateStatus(overdueTransaction._id, TransactionStatus.OVERDUE);

                await this.membershipService.markAsOverdue(
                    membership._id.toString()
                );
            }

        } catch (error) {
            this.logger.error(`Error checking membership ${membership._id}:`, error);
        }
    }
}
