import { inject, injectable } from "tsyringe";
import { Command, IRole } from "../type";
import { BOT_CLIENT_TOKEN, IBotServerPort } from "../../server/type";
import { WorkspaceService } from "../../services/workspace.service";
import { Message } from "whatsapp-web.js";
import { UserRepository } from "../../core/repositories/user.repository";
import { DebtsService, DEBTS_SERVICE_TOKEN } from "../../services/debts.service";
import { LoggerService } from "../../logger/logger.service";
import Utils from "../../utils/utils";

@injectable()
export class AddCreditCommand implements Command {
    role = IRole.ADMIN;

    constructor(
        @inject(BOT_CLIENT_TOKEN) private readonly server: IBotServerPort,
        @inject(LoggerService) private readonly loggerService: LoggerService,
        @inject(WorkspaceService) private readonly workspaceSvc: WorkspaceService,
        @inject(UserRepository) private readonly userRepo: UserRepository,
        @inject(DEBTS_SERVICE_TOKEN) private readonly debtsService: DebtsService,
    ) { }


    async handle(message: Message): Promise<void> {
        // if (!message.from.endsWith("@c.us")) {
        //     return;
        // }

        const parts = message.body.trim().split(/\s+/);
        const [, slug, amount] = parts;

        const contact = await message.getContact();
        const user = await this.userRepo.findByPhoneE164(contact.id._serialized);
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
                    // Cria um débito negativo (crédito) usando o DebtsService
                    await this.debtsService.createDebt({
                        playerId: user._id.toString(),
                        workspaceId: workspace._id.toString(),
                        amount: -(amountCents / 100), // Negativo para crédito
                        notes: "Crédito adicionado via grupo",
                        category: "general"
                    });

                    message.reply(`Crédito adicionado com sucesso!`);

                } catch (e: any) {
                    this.loggerService.log(`[ADD-CREDIT] Falha ao adicionar crédito: ${e}`);
                    message.reply(`Erro ao adicionar crédito: ${e.message}`);
                }
            }

        }
    }
}