import { injectable, inject } from "tsyringe";
import { Message } from "whatsapp-web.js";
import { IBotServerPort, BOT_CLIENT_TOKEN } from "../../server/type";
import { IRole } from "../type";
import { WorkspaceService } from "../../services/workspace.service";
import { LoggerService } from "../../logger/logger.service";
import { ChatRepository } from "../../core/repositories/chat.repository";
import { ChatService } from "../../services/chat.service";
import Utils from "../../utils/utils";

@injectable()
export class ScheduleCommand {
    role = IRole.ADMIN;

    constructor(
        @inject(BOT_CLIENT_TOKEN) private readonly server: IBotServerPort,
        @inject(WorkspaceService) private readonly workspaceSvc: WorkspaceService,
        @inject(ChatService) private readonly chatSvc: ChatService,
        @inject(ChatRepository) private readonly chatRepo: ChatRepository,
        @inject(LoggerService) private readonly logger: LoggerService,
    ) { }

    async handle(message: Message) {
        const groupId = message.from;
        const [, ...rawArgs] = message.body.trim().split(/\s+/);
        const argsStr = rawArgs.join(" ");

        const { workspace, chatId } = await this.workspaceSvc.resolveWorkspaceFromMessage(message);
        if (!workspace) { await message.reply("⚠️ Este grupo não está vinculado a um workspace. Use /bind <slug>."); return; }


        if (!argsStr) {
            const chat = await this.chatSvc.findByWorkspaceAndChat(workspace._id, chatId);
            if (!chat?.schedule) {
                await this.server.sendMessage(groupId, "ℹ️ Sem schedule configurado.\nUse: /schedule weekday=2 time=20:30 price=14,00 pix=seu@pix title=\"⚽ CAMPO VIANA\"");
                return;
            }

            const s = chat.schedule;
            const price = s.priceCents != null ? Utils.formatCentsToReal(s.priceCents) : "-";
            const wd = Utils.weekdayName(s.weekday);
            await this.server.sendMessage(groupId,
                `📅 *Schedule atual*\n` +
                `• Dia: ${wd} (${s.weekday})\n` +
                `• Hora: ${s.time ?? "-"}\n` +
                `• Título: ${s.title ?? "-"}\n` +
                `• Preço: ${price}\n` +
                `• Pix: ${s.pix ?? "-"}`
            );
            return;
        }

        const kv = Utils.parseKeyValue(argsStr);
        const patch: any = {};

        if (kv.weekday != null) {
            const wd = Utils.parseWeekday(kv.weekday);
            if (wd == null) { await this.server.sendMessage(groupId, "❌ weekday inválido. Use 0..6 ou dom/seg/ter/qua/qui/sex/sab."); return; }
            patch["schedule.weekday"] = wd;
        }

        if (kv.time != null) {
            if (!/^\d{2}:\d{2}$/.test(kv.time)) { await this.server.sendMessage(groupId, "❌ time inválido. Use HH:mm (ex.: 20:30)."); return; }
            patch["schedule.time"] = kv.time;
        }

        if (kv.title != null) {
            patch["schedule.title"] = String(kv.title);
        }

        if (kv.priceCents != null) {
            const cents = Number(kv.priceCents);
            if (!Number.isInteger(cents) || cents < 0) { await this.server.sendMessage(groupId, "❌ priceCents inválido."); return; }
            patch["schedule.priceCents"] = cents;
        } else if (kv.price != null) {
            const cents = Utils.parsePriceToCents(String(kv.price));
            if (cents == null) { await this.server.sendMessage(groupId, "❌ price inválido. Exemplos: 14,00 | 14.00 | R$14 | 1400c"); return; }
            patch["schedule.priceCents"] = cents;
        }

        if (kv.pix != null) {
            patch["schedule.pix"] = String(kv.pix);
        }

        if (Object.keys(patch).length === 0) {
            await this.server.sendMessage(groupId, "Nada para atualizar. Campos: weekday, time, title, price/priceCents, pix.");
            return;
        }

        await this.chatRepo.updateSchedule(workspace._id, groupId, patch);

        const updated = await this.chatRepo.findByWorkspaceAndChat(workspace._id, groupId);
        const s = updated?.schedule ?? {};
        const price = s.priceCents != null ? Utils.formatCentsBRL(s.priceCents) : "-";
        const wd = Utils.weekdayName(s.weekday);
        await this.server.sendMessage(groupId,
            `✅ *Schedule atualizado*\n` +
            `• Dia: ${wd} (${s.weekday ?? "-"})\n` +
            `• Hora: ${s.time ?? "-"}\n` +
            `• Título: ${s.title ?? "-"}\n` +
            `• Preço: ${price}\n` +
            `• Pix: ${s.pix ?? "-"}`
        );
    }
}
