import { injectable, inject } from "tsyringe";
import { Message } from "whatsapp-web.js";
import { IBotServerPort, BOT_CLIENT_TOKEN } from "../../server/type";
import { WorkspaceRepository } from "../../core/repositories/workspace.repository";
import { ChatModel } from "../../core/models/chat.model";
import { IRole } from "../type";

@injectable()
export class BindCommand {
  role = IRole.ADMIN;

  constructor(
    @inject(BOT_CLIENT_TOKEN) private server: IBotServerPort,
    @inject(WorkspaceRepository) private readonly workspaceRepo: WorkspaceRepository
  ) { }

  async handle(message: Message) {
    const parts = message.body.trim().split(/\s+/);
    // Ex: ["/bind", "campo-do-viana", "2", "20:30"]
    const [, slug, weekdayRaw, timeRaw] = parts;

    if (!slug) {
      await this.server.sendMessage(message.from, "Uso: /bind <slug> [diaSemana] [horário]");
      return;
    }

    const chat = await message.getChat();
    const chatId = chat.id._serialized;

    const ws = await this.workspaceRepo.ensureWorkspaceBySlug(slug);

    let weekday: number | undefined;
    if (weekdayRaw && !isNaN(Number(weekdayRaw))) {
      weekday = Number(weekdayRaw);
      if (weekday < 0 || weekday > 6) {
        await this.server.sendMessage(message.from, "⚠️ O dia da semana deve estar entre 0 (Dom) e 6 (Sáb).");
        return;
      }
    }

    let time = timeRaw || "20:30";
    if (!/^\d{1,2}:\d{2}$/.test(time)) {
      await this.server.sendMessage(message.from, "⚠️ O horário deve estar no formato HH:mm, ex: 20:30.");
      return;
    }

    const chatDoc = await ChatModel.findOneAndUpdate(
      { chatId },
      {
        $set: {
          chatId,
          workspaceId: ws._id,
          label: chat.name || "Grupo",
          schedule: {
            weekday: weekday ?? 2,
            time,
            title: ws.name ?? slug,
            priceCents: ws.settings?.pricePerGameCents ?? 1400,
            pix: ws.settings?.pix ?? "fcjogasimples@gmail.com",
          },
        },
      },
      { upsert: true, new: true }
    );

    const dias = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    const diaTxt = dias[chatDoc.schedule?.weekday ?? 2];
    await this.server.sendMessage(
      message.from,
      `✅ Grupo vinculado!\n` +
      `Workspace: ${ws.name}\n` +
      `Dia: ${diaTxt}\n` +
      `Horário: ${time}\n` +
      `Pix: ${chatDoc.schedule?.pix}\n` +
      `Valor: R$ ${(ws.settings?.pricePerGameCents ?? 1400) / 100}`
    );
  }
}
