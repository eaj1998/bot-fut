import { injectable, inject } from "tsyringe";
import { Message } from "whatsapp-web.js";
import { Types, Model } from "mongoose";
import { IBotServerPort, BOT_CLIENT_TOKEN } from "../../server/type";
import { WorkspaceRepository } from "../../core/repositories/workspace.repository";
import { ChatModel } from "../../core/models/chat.model";
import { IRole } from "../type";
import { WorkspaceService, WORKSPACES_SERVICE_TOKEN } from "../../services/workspace.service";
import { UserService, USER_SERVICE_TOKEN } from "../../services/user.service";
import { WORKSPACE_MEMBER_MODEL_TOKEN, IWorkspaceMember } from "../../core/models/workspace-member.model";

@injectable()
export class BindCommand {
  role = IRole.USER;

  constructor(
    @inject(BOT_CLIENT_TOKEN) private server: IBotServerPort,
    @inject(WorkspaceRepository) private readonly workspaceRepo: WorkspaceRepository,
    @inject(WORKSPACES_SERVICE_TOKEN) private readonly workspaceService: WorkspaceService,
    @inject(USER_SERVICE_TOKEN) private readonly userService: UserService,
    @inject(WORKSPACE_MEMBER_MODEL_TOKEN) private readonly workspaceMemberModel: Model<IWorkspaceMember>
  ) { }

  async handle(message: Message) {
    const parts = message.body.trim().split(/\s+/);
    const [, param1, weekdayRaw, timeRaw] = parts;

    if (!param1) {
      await this.server.sendMessage(message.from, "Uso: /bind <workspaceId_ou_slug> [diaSemana] [horário]");
      return;
    }

    const chat = await message.getChat();
    const chatId = chat.id._serialized;


    const existingChat = await ChatModel.findOne({ chatId });
    if (existingChat && existingChat.workspaceId) {
      const existingWorkspace = await this.workspaceRepo.findById(existingChat.workspaceId.toString());
      if (existingWorkspace) {
        await this.server.sendMessage(
          message.from,
          `⚠️ Este grupo já está vinculado ao workspace *'${existingWorkspace.name}'*.\n\nSe deseja alterar o dia e horário do jogo, use o comando */schedule*.\nSe deseja trocar este grupo para outro workspace, use o comando */unbind* primeiro.`
        );
        return;
      }
    }

    let ws;
    let isNewWorkspace = false;

    if (Types.ObjectId.isValid(param1)) {
      ws = await this.workspaceRepo.findById(param1);
      if (!ws) {
        await this.server.sendMessage(message.from, "❌ Workspace não encontrado com este ID.");
        return;
      }
      // Binding by ID always targets an existing workspace
      isNewWorkspace = false;
    } else {
      const existing = await this.workspaceRepo.findBySlug(param1);
      if (existing) {
        ws = existing;
        isNewWorkspace = false;
      } else {
        ws = await this.workspaceRepo.ensureWorkspaceBySlug(param1);
        isNewWorkspace = true;
      }
    }

    if (!isNewWorkspace) {
      try {
        const sender = await this.userService.resolveUserFromMessage(message);
        const membership = await this.workspaceMemberModel.findOne({
          userId: sender._id,
          workspaceId: ws._id,
          status: 'ACTIVE',
        });
        const isWorkspaceAdmin = !!membership && membership.roles.some(
          r => ['admin', 'owner'].includes(r.toLowerCase())
        );
        if (!isWorkspaceAdmin) {
          await this.server.sendMessage(
            message.from,
            '❌ Você não tem permissão para vincular este workspace. Apenas administradores do workspace podem fazer isso.'
          );
          return;
        }
      } catch (error) {
        console.error('Error checking workspace admin for /bind:', error);
        await this.server.sendMessage(
          message.from,
          '❌ Não foi possível verificar suas permissões. Tente novamente.'
        );
        return;
      }
    }

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
          schedule: {
            weekday: weekday ?? 2,
            time,
            title: ws.name ?? (isNewWorkspace ? param1 : "Meu Jogo"),
          },
          financials: {
            defaultPriceCents: ws.settings?.pricePerGameCents,
            pixKey: ws.settings?.pix,
            acceptsCash: true
          }
        },
      },
      { upsert: true, new: true }
    );

    const dias = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    const diaTxt = dias[chatDoc.schedule?.weekday ?? 2];

    try {
      const user = await this.userService.resolveUserFromMessage(message, ws._id);
      if (user) {
        await this.workspaceService.addMember(ws._id.toString(), user._id.toString(), ['ADMIN']);
      }
    } catch (error) {
      console.error("Error linking user to workspace:", error);
    }

    await this.server.sendMessage(
      message.from,
      `✅ Grupo vinculado com sucesso!\n\n` +
      `Workspace: *${ws.name}*\n` +
      `Dia: ${diaTxt}\n` +
      `Horário: ${time}\n` +
      `Pix: ${chatDoc.financials?.pixKey ?? 'Não definido'}\n` +
      `Valor: R$ ${((ws.settings?.pricePerGameCents ?? 0) / 100).toFixed(2)}`
    );
  }
}
