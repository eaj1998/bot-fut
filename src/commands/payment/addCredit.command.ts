import { inject, injectable } from "tsyringe";
import { Command, IRole } from "../type";
import { BOT_CLIENT_TOKEN, IBotServerPort } from "../../server/type";
import { WorkspaceService } from "../../services/workspace.service";
import { Message } from "whatsapp-web.js";
import { UserRepository } from "../../core/repositories/user.repository";
import { TransactionRepository, TRANSACTION_REPOSITORY_TOKEN } from "../../core/repositories/transaction.repository";
import { TransactionType, TransactionCategory, TransactionStatus } from "../../core/models/transaction.model";
import { LoggerService } from "../../logger/logger.service";
import Utils from "../../utils/utils";
import { OrganizzeService } from "../../services/organizze.service";

@injectable()
export class AddCreditCommand implements Command {
    role = IRole.ADMIN;

    constructor(
        @inject(BOT_CLIENT_TOKEN) private readonly server: IBotServerPort,
        @inject(LoggerService) private readonly loggerService: LoggerService,
        @inject(WorkspaceService) private readonly workspaceSvc: WorkspaceService,
        @inject(UserRepository) private readonly userRepo: UserRepository,
        @inject(TRANSACTION_REPOSITORY_TOKEN) private readonly transactionRepo: TransactionRepository,
        @inject(OrganizzeService) private readonly organizzeService: OrganizzeService,
    ) { }


    async handle(message: Message): Promise<void> {
        // if (!message.from.endsWith("@c.us")) {
        //     return;
        // }

        const parts = message.body.trim().split(/\s+/);
        const [, slug, amount] = parts;

        const user = await this.userRepo.findByPhoneE164(message.author ?? message.from);
        if (!user) {
            await message.reply("Seu número não está cadastrado. Peça a um admin para cadastrar.");
            return;
        }

        if (slug) {
            const workspace = await this.workspaceSvc.resolveWorkspaceBySlug(slug);
            if (!workspace) {
                await message.reply(`Workspace *${slug}* não encontrado.`);
                return;
            }

            const amountCents = Utils.parsePriceToCents(amount);

            if (amountCents != null && amountCents > 0) {
                try {
                    await this.transactionRepo.createTransaction({
                        workspaceId: workspace._id.toString(),
                        userId: user._id.toString(),
                        type: TransactionType.INCOME,
                        category: TransactionCategory.OTHER,
                        status: TransactionStatus.COMPLETED,
                        amount: amountCents,
                        description: "Crédito adicionado via grupo",
                        dueDate: new Date(),
                        paidAt: new Date(),
                        method: "pix" // Default or could be inferred
                    });

                    const organizzeResult = await this.organizzeService.createTransaction({
                        description: `Crédito adicionado - ${user.name} - ${workspace.name}`,
                        amountCents: amountCents,
                        categoryId: 155929474,
                        paid: true
                    });

                    if (organizzeResult.added) {
                        message.reply(`Credito de ${Utils.formatCentsToReal(amountCents)} adicionado com sucesso em Transações e Organizze!`);
                    } else {
                        message.reply(`Credito de ${Utils.formatCentsToReal(amountCents)} adicionado em Transações. ⚠️ Organizze: ${organizzeResult.error || "falha"}.`);
                    }

                } catch (e: any) {
                    message.reply(`Erro ao adicionar crédito: ${e.message}`);
                }
            }

        }
    }
}