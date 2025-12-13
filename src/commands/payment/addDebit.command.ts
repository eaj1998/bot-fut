import { inject, injectable } from "tsyringe";
import { Command, IRole } from "../type";
import { BOT_CLIENT_TOKEN, IBotServerPort } from "../../server/type";
import { WorkspaceService } from "../../services/workspace.service";
import { GameRepository } from "../../core/repositories/game.respository";
import { DebtsService, DEBTS_SERVICE_TOKEN } from "../../services/debts.service";
import { Message } from "whatsapp-web.js";
import Utils from "../../utils/utils";
import { buildUtcCalendarDay } from "../../utils/date";
import { LoggerService } from "../../logger/logger.service";
import { OrganizzeService } from "../../services/organizze.service";

@injectable()
export class AddDebitCommand implements Command {
    role = IRole.ADMIN;

    constructor(
        @inject(WorkspaceService) private readonly workspaceSvc: WorkspaceService,
        @inject(GameRepository) private readonly gameRepo: GameRepository,
        @inject(DEBTS_SERVICE_TOKEN) private readonly debtsService: DebtsService,
        @inject(LoggerService) private readonly logService: LoggerService,
        @inject(BOT_CLIENT_TOKEN) private readonly server: IBotServerPort,
        @inject(OrganizzeService) private readonly organizzeService: OrganizzeService,
    ) { }

    async handle(message: Message): Promise<void> {
        const groupId = message.from;
        const [cmd, ...tokens] = message.body.trim().split(/\s+/);

        if (!tokens.length) {
            await this.server.sendMessage(
                groupId,
                "Uso: /adicionar-debito <dd/mm> slug=<workspace> amount=<valor> [note=<texto livre>]\nEx.: /adicionar-debito 13/11 slug=arena amount=150,00 note=aluguel goleiro"
            );
            return;
        }

        const kvParts: string[] = [];
        const looseParts: string[] = [];
        for (const t of tokens) {
            if (/^\w+=/.test(t)) kvParts.push(t);
            else looseParts.push(t);
        }
        const kv = Utils.parseKeyValue(kvParts.join(" "));

        let rawDate: string | undefined = typeof kv.date === "string" ? kv.date : undefined;
        if (!rawDate) {
            const found = looseParts.find(x => /^\d{1,2}\/\d{1,2}$/.test(x));
            if (found) rawDate = found;
        }
        if (!rawDate) {
            await this.server.sendMessage(groupId, "❌ Data obrigatória. Use dd/mm. Ex.: 13/11");
            return;
        }
        const dmy = this.parseDDMM(rawDate);
        if (!dmy) {
            await this.server.sendMessage(groupId, "❌ Data inválida. Use dd/mm. Ex.: 13/11");
            return;
        }

        const slug = kv.slug ?? kv.workspace ?? kv.ws;
        if (!slug) {
            await this.server.sendMessage(groupId, "❌ Informe o workspace: slug=<workspace>");
            return;
        }

        let rawAmount: string | undefined =
            kv.amount ?? kv.value ?? kv.valor ?? undefined;

        if (!rawAmount) {
            const amountLike = looseParts.find(x =>
                /^(\d{1,3}(\.\d{3})*|\d+)(,\d{2}|\.\d{2})?$/.test(x) ||
                /^[Rr]\$\s*\d/.test(x) ||
                /^\d+\s*c$/i.test(x)
            );
            if (amountLike) rawAmount = amountLike;
        }

        const cents = this.parseAmountToCents(rawAmount ?? "");
        if (cents == null) {
            await this.server.sendMessage(groupId, "❌ Valor inválido. Exemplos: 150,00 | 150.00 | R$150 | 15000c");
            return;
        }

        let note = typeof kv.note === "string" ? kv.note : "";
        if (!note && looseParts.length) {
            const exclude = new Set<string>();
            if (rawDate) exclude.add(rawDate);
            if (rawAmount) exclude.add(rawAmount);
            note = looseParts.filter(x => !exclude.has(x)).join(" ").trim();
        }
        if (!note) note = "Pagamento ao campo";

        const ws = await this.workspaceSvc.resolveWorkspaceBySlug(slug);
        if (!ws) {
            await this.server.sendMessage(groupId, `❌ Workspace ${slug} não encontrado.`);
            return;
        }

        const now = new Date();
        const year = now.getFullYear();
        const { startZ: start, endZ: end } = buildUtcCalendarDay(year, dmy.month, dmy.day);

        const game = await this.gameRepo.findByDate(ws._id, { start, end });

        if (!game) {
            await this.server.sendMessage(groupId, `❌ Jogo não encontrado em ${rawDate} para ${ws.name}.`);
            return;
        }

        try {
            await this.debtsService.createDebt({
                playerId: "", // Débito do campo, sem jogador específico
                workspaceId: ws._id.toString(),
                gameId: game._id.toString(),
                amount: cents / 100,
                notes: `${note} do jogo ${rawDate} (${game.title ?? "Jogo"})`,
                category: "field-payment",
            });

            // Create Organizze transaction
            const organizzeResult = await this.organizzeService.createTransaction({
                description: `${note} - ${rawDate}`,
                amountCents: -cents,
                categoryId: 155927947,
                paid: true
            });

            if (organizzeResult.added) {
                await this.server.sendMessage(
                    groupId,
                    `✅ Registrado débito de ${Utils.formatCentsToReal(cents)} (${rawDate}) - ${note} no ledger e Organizze.`
                );
            } else {
                await this.server.sendMessage(
                    groupId,
                    `✅ Registrado débito de ${Utils.formatCentsToReal(cents)} (${rawDate}) - ${note} no ledger. ⚠️ Organizze: ${organizzeResult.error || "falha"}.`
                );
            }
        } catch (e) {
            this.logService.log(`Erro ao registrar débito do jogo: `, e);
            await this.server.sendMessage(groupId, `❌ Não foi possível registrar o débito, tente novamente mais tarde.`);
        }
    }


    parseDDMM(s: string): { day: number; month: number } | null {
        const m = /^(\d{1,2})\/(\d{1,2})$/.exec((s ?? "").trim());
        if (!m) return null;
        const d = Number(m[1]), mm = Number(m[2]);
        if (d >= 1 && d <= 31 && mm >= 1 && mm <= 12) return { day: d, month: mm };
        return null;
    }

    parseAmountToCents(raw?: string | number | null): number | null {
        if (raw == null) return null;
        if (typeof raw === "number") return Number.isFinite(raw) ? Math.round(raw * 100) : null;
        const s = String(raw).trim();
        if (/^\d+\s*c$/i.test(s)) {
            const n = parseInt(s.replace(/c/i, ""), 10);
            return Number.isFinite(n) ? n : null;
        }
        let t = s.replace(/[Rr]\$|\s/g, "");
        if (t.includes(",") && t.includes(".")) {
            t = t.replace(/\./g, "").replace(",", ".");
        } else if (t.includes(",")) {
            t = t.replace(",", ".");
        }
        const v = Number(t);
        if (!Number.isFinite(v)) return null;
        const cents = Math.round(v * 100);
        return cents >= 0 ? cents : null;
    }
}
