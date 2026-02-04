import { injectable, inject } from 'tsyringe';
import { Model } from 'mongoose';
import { LoggerService } from '../logger/logger.service';
import { MembershipService } from '../services/membership.service';
import { WORKSPACE_MODEL_TOKEN } from '../core/models/workspace.model';

@injectable()
export class GenerateMonthlyInvoicesJob {
    constructor(
        @inject(MembershipService) private membershipService: MembershipService,
        @inject(WORKSPACE_MODEL_TOKEN) private workspaceModel: Model<any>,
        @inject(LoggerService) private logger: LoggerService
    ) {
        this.logger.setName('GenerateMonthlyInvoicesJob');
    }

    async run() {
        this.logger.info('Starting GenerateMonthlyInvoicesJob...');
        const startTime = Date.now();
        let totalProcessed = 0;
        let totalCreated = 0;
        let totalErrors = 0;

        try {
            // 1. Fetch all workspaces that are not explicitly inactive
            const workspaces = await this.workspaceModel.find({ active: { $ne: false } });

            this.logger.info(`Found ${workspaces.length} workspaces to process.`);

            for (const workspace of workspaces) {
                const workspaceId = workspace._id.toString();
                this.logger.info(`Processing invoice generation for workspace: ${workspaceId} (${workspace.name || 'Unnamed'})...`);

                try {
                    const result = await this.membershipService.processMonthlyBilling(workspaceId);

                    this.logger.info(`Workspace ${workspaceId}: Processed ${result.processed}, Created ${result.created}, Errors ${result.errors}`);

                    totalProcessed += result.processed;
                    totalCreated += result.created;
                    totalErrors += result.errors;

                } catch (error: any) {
                    this.logger.error(`Error processing workspace ${workspaceId}:`, error);
                    totalErrors++;
                }
            }

        } catch (error) {
            this.logger.error('Critical error in GenerateMonthlyInvoicesJob:', error);
        }

        const duration = (Date.now() - startTime) / 1000;
        this.logger.info(`Job finished in ${duration}s. Processed: ${totalProcessed}. Created: ${totalCreated}. Errors: ${totalErrors}.`);
    }
}
