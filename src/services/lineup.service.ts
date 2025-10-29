import { Contact, Message } from "whatsapp-web.js";
import { inject, injectable } from "tsyringe";
import { LineUpRepository } from "../repository/lineup.repository";
import { singleton } from "tsyringe";
import Utils from "../utils/utils";
import { ConfigService } from "../config/config.service";
import { GameDoc, GameModel, GameRoster, GamePlayer } from "../core/models/game.model";
import { WorkspaceDoc } from "../core/models/workspace.model";
import { ChatModel } from "../core/models/chat.model";
import { getNextWeekday, applyTime, formatHorario } from "../utils/date";
import { UserDoc, UserModel } from "../core/models/user.model";

export type LineUpInfo = {
  data: Date;
  horario: string;
  jogadores: (string | null)[];
  jogadoresFora: (string | null)[];
  suplentes: string[];
};

@singleton()

export class LineUpService {
  constructor(
    @inject(LineUpRepository) private readonly repo: LineUpRepository,
    @inject(ConfigService) private readonly configService: ConfigService,
  ) { }

  async getAuthorName(message: Message): Promise<string> {
    const contato = await message.getContact();
    return (
      contato.pushname ??
      contato.name ??
      message.author?.split("@")[0] ??
      "Desconhecido"
    );
  }

  async getActiveListOrWarn(
    workspaceId: string,
    groupId: string,
    reply: (txt: string) => void
  ): Promise<GameDoc | null> {
    if (!workspaceId || !groupId) {
      reply("Erro interno: workspace ou grupo não encontrado.");
      return null;
    }

    const game = await GameModel.findOne({
      workspaceId,
      chatId: groupId,
      status: "aberta",
    }).populate("roster.players.userId");

    if (!game) {
      reply(
        "⚠️ Nenhuma lista ativa encontrada. Peça a um admin para iniciar com /lista."
      );
      return null;
    }

    return game;
  }
  pullFromOutlist(
    game: GameDoc,
    user: UserDoc,
  ): void {
    if (!game.roster?.outlist) game.roster.outlist = [];

    const uid = user._id.toString();

    game.roster.outlist = game.roster.outlist.filter((o) => {
      const sameUser = o.userId?._id.toString() === uid;
      return !sameUser;
    });
  }
  getActiveList(groupId: string): LineUpInfo | null {
    const list = this.repo.listasAtuais[groupId];
    if (!list) {
      return null;
    }
    return list;
  }

  alreadyInList(roster: GameRoster, user: UserDoc): boolean {
    return (
      roster.players.some(p => p.userId?.toString() === user._id.toString()) ||
      roster.waitlist.some(p => p.userId?.toString() === user._id.toString())
    );
  }

  async addOutfieldPlayer(
    game: GameDoc,
    user: UserDoc,
    maxPlayers = 16
  ): Promise<{ added: boolean; suplentePos?: number }> {
    game.roster.players = game.roster.players ?? [];
    game.roster.waitlist = game.roster.waitlist ?? [];

    const firstOutfieldSlot = Math.max(1, (game.roster.goalieSlots ?? 2) + 1);

    const used = new Set<number>(
      game.roster.players
        .map(p => p.slot)
        .filter((s): s is number => typeof s === 'number')
    );

    for (let slot = firstOutfieldSlot; slot <= maxPlayers; slot++) {
      if (!used.has(slot)) {
        game.roster.players.push({ userId: user._id, slot, name: user.name, paid: false });
        game.save();
        return { added: true };
      }
    }

    game.roster.waitlist.push({ userId: user._id, name: user.name, createdAt: new Date() });
    game.save();
    return { added: false, suplentePos: game.roster.waitlist.length };
  }

  addGoalkeeper(list: LineUpInfo, name: string): { added: boolean; suplentePos?: number } {
    for (let i = 0; i < 2; i++) {
      if (list.jogadores[i] === "🧤" || list.jogadores[i] === null) {
        list.jogadores[i] = `🧤 ${name}`;
        return { added: true };
      }
    }
    list.suplentes.push(name);
    return { added: false, suplentePos: list.suplentes.length };
  }

  initList(groupId: string, gameDate: Date, gameTime: string) {
    const jogadores = Array<string | null>(16).fill(null);
    jogadores[0] = "🧤"; // goleiro 1
    jogadores[1] = "🧤"; // goleiro 2

    this.repo.listasAtuais[groupId] = {
      data: gameDate,
      horario: gameTime,
      jogadores,
      suplentes: [],
      jogadoresFora: [],
    };
  }

  async getOrCreateTodayList(workspaceId: string) {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));

    let game = await GameModel.findOne({
      workspaceId,
      date: { $gte: startOfDay },
    });

    if (!game) {
      game = await GameModel.create({
        workspaceId,
        date: new Date(),
        title: "⚽ Jogo da Semana",
        roster: { goalieSlots: 2, players: [], waitlist: [] },
      });
    }

    return game;
  }

  addOffLineupPlayer(game: GameDoc, user: UserDoc): { added: boolean; } {
    try {
      game.roster.outlist.push({
        userId: user._id,
        name: user.name,
        createdAt: new Date(),
      });
      return { added: true };
    } catch {
      return { added: false };
    }
  }


  async formatList(
    game: GameDoc,
    workspace?: WorkspaceDoc,
  ): Promise<string> {
    if (!game) return "Erro: jogo não encontrado.";

    const d = new Date(game.date);
    const dia = String(d.getDate()).padStart(2, "0");
    const mes = String(d.getMonth() + 1).padStart(2, "0");
    const horario = formatHorario(d);

    const chat = await ChatModel.findOne({ chatId: game.chatId, workspaceId: game.workspaceId });

    const titulo = game?.title ?? "⚽ CAMPO DO VIANA";
    const pix = chat?.schedule?.pix ?? "fcjogasimples@gmail.com";
    const valor = `${Utils.formatCentsToReal(chat?.schedule?.priceCents ?? 0)}`;

    const maxPlayers = game.maxPlayers ?? 16;
    const goalieSlots = Math.max(0, game.roster?.goalieSlots ?? 2);

    const players: GamePlayer[] = Array.isArray(game.roster?.players) ? game.roster.players : [];
    const waitlist = Array.isArray(game.roster?.waitlist) ? game.roster.waitlist : [];

    const slots: (GamePlayer | null)[] = Array(maxPlayers).fill(null);
    const pending: GamePlayer[] = [];

    for (const p of players) {
      const s = p.slot ?? 0;
      if (s >= 1 && s <= maxPlayers && slots[s - 1] === null) {
        slots[s - 1] = p;
      } else {
        pending.push(p);
      }
    }

    // 2) realoca pendentes no primeiro espaço livre
    for (const p of pending) {
      let placed = false;
      for (let i = 0; i < maxPlayers; i++) {
        if (slots[i] === null) {
          slots[i] = p;
          placed = true;
          break;
        }
      }
    }

    let texto = `${titulo}\n${dia}/${mes} às ${horario}\nPix: ${pix}\nValor: ${valor}\n\n`;

    for (let i = 0; i < maxPlayers; i++) {
      const pos = i + 1;
      const isGoalie = pos <= goalieSlots;
      const glove = isGoalie ? "🧤 " : "";

      const p = slots[i];
      if (p) {
        const nome = (p.name ?? "Jogador").trim();
        const paid = p.paid ? " ✅" : "";
        texto += `${pos} - ${glove}${nome}${paid}\n`;
      } else {
        texto += `${pos} - ${glove}\n`;
      }
    }

    if (waitlist.length > 0) {
      texto += `\n--- SUPLENTES ---\n`;
      waitlist.forEach((w, idx) => {
        const nome = (w.name ?? "Jogador").trim();
        texto += `${idx + 1} - ${nome}\n`;
      });
    }

    return texto.trim();
  }

  argsFromMessage(message: Message): string[] {
    const commandParts = message.body.split('\n');
    return commandParts[0].split(' ').slice(1);
  }


  async initListForChat(workspace: WorkspaceDoc, chatId: string) {
    const chat = await ChatModel.findOne({ chatId, workspaceId: workspace._id }).lean();
    if (!chat || !chat.schedule) {
      throw new Error("Chat sem configuração de schedule. Cadastre weekday/time em Chat.schedule.");
    }

    const weekday = chat.schedule.weekday ?? 2;
    const timeStr = chat.schedule.time || "20:30";
    const title = chat.schedule.title || workspace.settings?.title || "⚽ Jogo";
    const priceCents = chat.schedule.priceCents ?? workspace.settings?.pricePerGameCents ?? 1400;

    const base = new Date();
    const gameDate = applyTime(getNextWeekday(base, weekday), timeStr);

    let game = await GameModel.findOne({
      workspaceId: workspace._id,
      chatId: chatId,
      status: "aberta",
    });

    if (!game) {
      game = await GameModel.create({
        workspaceId: workspace._id,
        date: gameDate,
        chatId: chatId,
        title,
        priceCents,
        roster: { goalieSlots: 2, players: [], waitlist: [] },
      });
    } else {

      if (!game.roster) game.set("roster", { goalieSlots: 2, players: [], waitlist: [] } as any);
      if (!game.roster.players) (game.roster as any).players = [];
      if (!game.roster.waitlist) (game.roster as any).waitlist = [];
      if (game.isModified()) await game.save();
    }

    return { game, priceCents, pix: chat.schedule.pix };
  }

  /**
   * Versão por data explicitada (se você quiser passar manualmente).
   */
  async initListAt(workspace: WorkspaceDoc, targetDate: Date, opts?: { title?: string; priceCents?: number; }) {
    const start = new Date(targetDate); start.setHours(0, 0, 0, 0);
    const end = new Date(targetDate); end.setHours(23, 59, 59, 999);

    let game = await GameModel.findOne({ workspaceId: workspace._id, date: { $gte: start, $lte: end } });

    if (!game) {
      game = await GameModel.create({
        workspaceId: workspace._id,
        date: targetDate,
        title: opts?.title ?? (workspace.settings?.title || "⚽ Jogo"),
        priceCents: opts?.priceCents ?? workspace.settings?.pricePerGameCents ?? 1400,
        roster: { goalieSlots: 2, players: [], waitlist: [] },
      });
    }
    return game;
  }

}
