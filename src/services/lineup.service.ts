import { Message } from "whatsapp-web.js";
import { inject, injectable } from "tsyringe";
import { LineUpRepository } from "../repository/lineup.repository";
import { singleton } from "tsyringe";
import Utils from "../utils/utils";
import { ConfigService } from "../config/config.service";
import { GameDoc, GameModel } from "../core/models/game.model";
import { WorkspaceDoc } from "../core/models/workspace.model";
import { ChatModel } from "../core/models/chat.model";
import { getNextWeekday, applyTime, formatHorario } from "../utils/date";

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

  getActiveListOrWarn(groupId: string, reply: (txt: string) => void): LineUpInfo | null {
    const list = this.repo.listasAtuais[groupId];
    if (!list) {
      reply(
        "Nenhuma lista de jogo ativa no momento. Aguarde um admin enviar com o comando /lista."
      );
      return null;
    }
    return list;
  }

  getActiveList(groupId: string): LineUpInfo | null {
    const list = this.repo.listasAtuais[groupId];
    if (!list) {
      return null;
    }
    return list;
  }

  alreadyInList(list: LineUpInfo, name: string): boolean {
    return list.jogadores.includes(name) || list.suplentes.includes(name);
  }

  addOutfieldPlayer(list: LineUpInfo, name: string): { added: boolean; suplentePos?: number } {
    for (let i = 2; i < 16; i++) {
      if (list.jogadores[i] === null) {
        list.jogadores[i] = name;
        return { added: true };
      }
    }
    list.suplentes.push(name);
    return { added: false, suplentePos: list.suplentes.length };
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

  addOffLineupPlayer(list: LineUpInfo, name: string): { added: boolean; } {
    try {
      list.jogadoresFora.push(name);
      return { added: true };
    } catch {
      return { added: false };
    }
  }

  formatList(
    game: GameDoc,
    opts?: { titulo?: string; pix?: string; valor?: string }
  ): string {
    if (!game) return "Erro: jogo não encontrado.";

    const dia = String(game.date.getDate()).padStart(2, "0");
    const mes = String(game.date.getMonth() + 1).padStart(2, "0");

    const titulo = opts?.titulo ?? "⚽ CAMPO DO VIANA";
    const pix = opts?.pix ?? "fcjogasimples@gmail.com";
    const valor = opts?.valor ?? `${Utils.formatCentsToReal(this.configService.organizze.valorJogo)}`;
    const horario = formatHorario(game.date);
    let texto = `${titulo}\n${dia}/${mes} às ${horario}\nPix: ${pix}\nValor: ${valor}\n\n`;

    for (let i = 0; i < 16; i++) {
      const jogador = game.roster.players[i] || "";
      texto += `${i + 1} - ${jogador}\n`;
    }

    if (game.roster.waitlist.length > 0) {
      texto += "\n--- SUPLENTES ---\n";
      game.roster.waitlist.forEach((s, idx) => {
        texto += `${idx + 1} - ${s}\n`;
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

    const start = new Date(gameDate);
    const end = new Date(gameDate); end.setHours(23, 59, 59, 999);

    let game = await GameModel.findOne({
      workspaceId: workspace._id,
      date: { $gte: start, $lte: end },
    });

    if (!game) {
      game = await GameModel.create({
        workspaceId: workspace._id,
        date: gameDate,
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
