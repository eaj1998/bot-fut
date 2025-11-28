import { inject, injectable } from "tsyringe";
import { Command, IRole } from "../type";
import { BOT_CLIENT_TOKEN, IBotServerPort } from "../../server/type";
import { WorkspaceService } from "../../services/workspace.service";
import { LineUpService } from "../../services/lineup.service";
import { Message } from "whatsapp-web.js";
import { UserRepository } from "../../core/repositories/user.repository";
import { LedgerRepository } from "../../core/repositories/ledger.repository";
import { LoggerService } from "../../logger/logger.service";
import Utils from "../../utils/utils";

@injectable()
export class AddCreditCommand implements Command {
    role = IRole.ADMIN;

    constructor(
        @inject(BOT_CLIENT_TOKEN) private readonly server: IBotServerPort,
        @inject(LineUpService) private readonly lineupSvc: LineUpService,
        @inject(LoggerService) private readonly loggerService: LoggerService,
        @inject(WorkspaceService) private readonly workspaceSvc: WorkspaceService,
        @inject(UserRepository) private readonly userRepo: UserRepository,
        @inject(LedgerRepository) private readonly ledgerRepo: LedgerRepository,
    ) { }


    async handle(message: Message): Promise<void> {
        // if (!message.from.endsWith("@c.us")) {
        //     return;
        // }

        const parts = message.body.trim().split(/\s+/);
        const [, slug, amount] = parts;

        const user = await this.userRepo.findByPhoneE164(message.from);
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
                console.log(`amount`, amountCents);
                try {
                    await this.ledgerRepo.addCredit({
                        workspaceId: workspace._id.toString(),
                        userId: user._id.toString(),
                        amountCents: amountCents ?? 0,
                        note: "Credito adicionado via grupo",
                        method: "pix",
                        category: "general"
                    });

                    message.reply(`Credito adicionado com sucesso!`);

                } catch (e: any) {
                    this.loggerService.log(`[GUEST-PAID] Falha ao creditar convidador: ${e}`);
                }
            }

        }
    }
}