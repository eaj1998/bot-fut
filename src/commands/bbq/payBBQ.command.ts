import { inject, injectable } from 'tsyringe';
import { Command, IRole } from '../type';
import { BOT_CLIENT_TOKEN, IBotServerPort } from '../../server/type';
import { Message } from 'whatsapp-web.js';
import { WorkspaceService } from '../../services/workspace.service';
import { UserRepository } from '../../core/repositories/user.repository';

import { TransactionRepository, TRANSACTION_REPOSITORY_TOKEN } from '../../core/repositories/transaction.repository';
import { TransactionStatus, TransactionCategory, TransactionType } from '../../core/models/transaction.model';
import { WorkspaceRepository } from '../../core/repositories/workspace.repository';
import { LoggerService } from '../../logger/logger.service';
import Utils from '../../utils/utils';
import { tryParseDDMM } from '../../utils/date';
import axios from 'axios';

@injectable()
export class PayBBQCommand implements Command {
    role = IRole.ADMIN;

    constructor(
        @inject(BOT_CLIENT_TOKEN) private readonly server: IBotServerPort,
        @inject(WorkspaceService) private readonly workspaceSvc: WorkspaceService,
        @inject(UserRepository) private readonly userRepo: UserRepository,
        @inject(TRANSACTION_REPOSITORY_TOKEN) private readonly transactionRepo: TransactionRepository,
        @inject(WorkspaceRepository) private readonly workspaceRepo: WorkspaceRepository,
        @inject(LoggerService) private readonly loggerService: LoggerService,
        @inject(Utils) private util: Utils
    ) { }

    async handle(message: Message): Promise<void> {
        const args = message.body.trim().split(/\s+/).slice(1);
        const { workspace } = await this.workspaceSvc.resolveWorkspaceFromMessage(message);

        if (!workspace) {
            await message.reply("🔗 Este grupo ainda não está vinculado a um workspace. Use /bind <slug>");
            return;
        }

        const mentions = await message.getMentions();

        let phone: string;
        let dateArg: string;

        if (mentions && mentions.length > 0) {
            if (args.length < 1) {
                await message.reply("Uso: /pagar-churras @usuário <dd/mm> ou /pagar-churras <telefone> <dd/mm>");
                return;
            }
            phone = this.util.normalizePhone(mentions[0].id._serialized);
            dateArg = args[args.length - 1];
        } else {
            if (args.length < 2) {
                await message.reply("Uso: /pagar-churras @usuário <dd/mm> ou /pagar-churras <telefone> <dd/mm>");
                return;
            }
            phone = this.util.normalizePhone(args[0]);
            dateArg = args[1];
        }

        const user = await this.userRepo.findByPhoneE164(phone);

        if (!user) {
            await message.reply("❌ Usuário não encontrado");
            return;
        }

        const dateResult = tryParseDDMM(dateArg);
        if (!dateResult) {
            await message.reply("❌ Data inválida. Use dd/mm");
            return;
        }
        const date = dateResult.start;

        // 1. Try to find debt in Transactions (Primary System)
        // We need a method to find by user and date/category
        const startOfDay = new Date(date); startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date); endOfDay.setHours(23, 59, 59, 999);

        const transactions = await this.transactionRepo['model'].find({
            workspaceId: workspace._id,
            userId: user._id,
            type: TransactionType.INCOME,
            category: TransactionCategory.BBQ_REVENUE,
            status: TransactionStatus.PENDING,
            dueDate: { $gte: startOfDay, $lte: endOfDay }
        });

        if (transactions.length > 0) {
            const tx = transactions[0];
            await this.transactionRepo.markAsPaid(tx._id.toString(), new Date(), 'pix');
            await message.reply(`✅ Pagamento confirmado para ${user.name} (Transaction ID: ${tx._id})`);
            return;
        }

        await message.reply("❌ Nenhum débito de churrasco pendente encontrado para este usuário nesta data");
    }
}
