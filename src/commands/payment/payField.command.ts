import { inject, injectable } from "tsyringe";
import { Command, IRole } from "../type";
import { BOT_CLIENT_TOKEN, IBotServerPort } from "../../server/type";
import { WorkspaceService } from "../../services/workspace.service";
import { GameRepository } from "../../core/repositories/game.respository";
import { LedgerRepository } from "../../core/repositories/ledger.repository";
import { Message } from "whatsapp-web.js";
import Utils from "../../utils/utils";
import { buildUtcCalendarDay } from "../../utils/date";
import { LoggerService } from "../../logger/logger.service";

function parseDDMM(s: string): { day: number; month: number } | null {
    const m = /^(\d{1,2})\/(\d{1,2})$/.exec((s ?? "").trim());
    if (!m) return null;
    const d = Number(m[1]), mm = Number(m[2]);
    if (d >= 1 && d <= 31 && mm >= 1 && mm <= 12) return { day: d, month: mm };
    return null;
}

@injectable()
export class PayFieldCommand implements Command {
    role = IRole.ADMIN;

    constructor(
        @inject(WorkspaceService) private readonly workspaceSvc: WorkspaceService,
        @inject(GameRepository) private readonly gameRepo: GameRepository,
        @inject(LedgerRepository) private readonly ledgerRepo: LedgerRepository,
        @inject(LoggerService) private readonly logService: LoggerService,
    ) { }

    async handle(message: Message): Promise<void> {
        const [, ...args] = message.body.trim().split(/\s+/);
        const slug = (args[0] || "").toLowerCase();
        const rawDate = args[1];
        const rawValue = args[2];

        if (!slug || !rawDate || !rawValue) {
            await message.reply("Use: */pagar-campo <workspace> <dd/mm> <valor>*\nEx.: /pagar-campo viana 13/11 150,00");
            return;
        }

        const ws = await this.workspaceSvc.resolveWorkspaceBySlug(slug);
        if (!ws) {
            await message.reply(`Workspace *${slug}* não encontrado.`);
            return;
        }

        const dmy = parseDDMM(rawDate);
        if (!dmy) {
            await message.reply("Data inválida. Use dd/mm. Ex.: 13/11");
            return;
        }

        const year = new Date().getFullYear();
        const { startZ: start, endZ: end } = buildUtcCalendarDay(year, dmy.month, dmy.day);

        const game = await this.gameRepo.findByWorkspaceAndDate(ws._id, { start: start, end: end });

        if (!game) {
            await message.reply(`Jogo não encontrado em ${rawDate} para ${ws.name}.`);
            return;
        }

        const cents = Utils.parsePriceToCents(rawValue);
        if (cents == null) {
            await message.reply("Valor inválido. Ex.: 150,00 ou R$ 150,00");
            return;
        }
        
        try {
            await this.ledgerRepo.addDebit({
                workspaceId: ws._id.toString(), userId: "",
                amountCents: cents,
                gameId: game._id.toString(),
                note: `Pagamento ao campo do jogo ${rawDate} (${game.title ?? "Jogo"})`,
                category: "field-payment",

            });
            await message.reply(`Ok! Registrado pagamento ao campo de ${Utils.formatCentsToReal(cents)} (${rawDate}).`);

        } catch (e) {
            this.logService.log(`Ocorreu um erro ao registrar debito do jogo: `, e);
            await message.reply(`Não foi possível registrar o debito, tente novamente mais tarde`);
        }



    }
}
