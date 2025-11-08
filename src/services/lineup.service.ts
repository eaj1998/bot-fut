import { Message } from "whatsapp-web.js";
import { inject } from "tsyringe";
import { LineUpRepository } from "../repository/lineup.repository";
import { singleton } from "tsyringe";
import Utils from "../utils/utils";
import { GameDoc, GameModel, GameRoster, GamePlayer } from "../core/models/game.model";
import { WorkspaceDoc } from "../core/models/workspace.model";
import { ChatModel } from "../core/models/chat.model";
import { getNextWeekday, applyTime, formatHorario } from "../utils/date";
import { UserDoc } from "../core/models/user.model";
import { GameRepository } from "../core/repositories/game.respository";
import { Types } from "mongoose";
import { LedgerRepository } from "../core/repositories/ledger.repository";
import { ConfigService } from "../config/config.service";
import { todayISOyyyy_mm_dd, formatDateBR } from "../utils/date";
import axios from "axios";
import { LoggerService } from "../logger/logger.service";
import { isOutfield } from "../utils/lineup";

type ClosePlayerResult = {
  success: boolean;
  playerName: string;
  ledger: boolean;
  organizze: boolean;
  error?: string;
};

type CloseGameResult = {
  added: boolean;
  results: ClosePlayerResult[];
};

type CancelGameResult = {
  added: boolean;
};

type OwnDebts = { type: "your place"; slot?: number | null };
type GuestDebts = { type: "guest"; name?: string; slot?: number | null };


@singleton()

export class LineUpService {
  constructor(
    @inject(LineUpRepository) private readonly repo: LineUpRepository,
    @inject(GameRepository) private readonly gameRepo: GameRepository,
    @inject(LedgerRepository) private readonly ledgerRepo: LedgerRepository,
    @inject(ConfigService) private readonly configService: ConfigService,
    @inject(LoggerService) private readonly loggerService: LoggerService
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
  async cancelGame(game: GameDoc): Promise<CancelGameResult> {
    game.status = "cancelled";
    if (await this.gameRepo.save(game)) {
      return { added: true }
    }
    return { added: false }
  }
  async closeGame(game: GameDoc): Promise<CloseGameResult> {
    try {
      const amountCents =
        game.priceCents ?? this.configService.organizze.valorJogo;
      const goalieSlots = Math.max(0, game.roster.goalieSlots ?? 2);

      const tasks = game.roster.players
        .filter(p => (p.slot ?? 0) > goalieSlots)
        .map(async (player): Promise<ClosePlayerResult> => {
          const playerName = player.name;

          let ledgerOk = false;
          try {
            const targetUserId =
              player.guest
                ? player.invitedByUserId?.toString()
                : player.userId?.toString();

            if (!targetUserId) {
              // Pagamento sem dono, tratado como erro de lancamento
              return {
                success: false,
                playerName,
                ledger: false,
                organizze: false,
                error: player.guest
                  ? "Convidado sem invitedByUserId"
                  : "Jogador sem userId"
              };
            }

            if (targetUserId) {
              await this.ledgerRepo.addDebit({
                workspaceId: game.workspaceId.toString(),
                userId: targetUserId,
                amountCents,
                gameId: game._id.toString(),
                note: player.guest
                  ? `Débito (convidado) — ${player.name} — jogo ${formatDateBR(game.date)}`
                  : `Débito referente ao jogo ${game._id} - ${formatDateBR(game.date)}`
              });
              ledgerOk = true;
            } else {
              ledgerOk = false;
            }
          } catch (err: any) {
            return {
              success: false,
              playerName,
              ledger: false,
              organizze: false,
              error: `ledger: ${err?.message ?? String(err)}`
            };
          }

          let organizzeOk = false;
          try {
            const org = await this.criarMovimentacaoOrganizze(player, game.date, amountCents);
            organizzeOk = !!org.added;
          } catch (err: any) {
            return {
              success: false,
              playerName,
              ledger: ledgerOk,
              organizze: false,
              error: `organizze: ${err?.message ?? String(err)}`
            };
          }

          return {
            success: ledgerOk && organizzeOk,
            playerName,
            ledger: ledgerOk,
            organizze: organizzeOk
          };
        });

      const settled = await Promise.allSettled(tasks);
      const results: ClosePlayerResult[] = settled.map((r) =>
        r.status === "fulfilled"
          ? r.value
          : {
            success: false,
            playerName: "Desconhecido",
            ledger: false,
            organizze: false,
            error: r.reason?.message ?? String(r.reason)
          }
      );

      game.status = "closed";
      if (typeof game.save === "function") {
        await game.save();
      }

      return { added: true, results };
    } catch {
      return { added: false, results: [] };
    }
  }

  async unmarkAsPaid(
    game: GameDoc,
    slot?: number
  ): Promise<{ updated: boolean; reason?: string; playerName?: string }> {
    if (typeof slot !== "number") {
      return { updated: false, reason: "Slot inválido" };
    }

    const idx = game.roster.players.findIndex(p => p.slot === slot);
    if (idx === -1) {
      return { updated: false, reason: "Jogador não encontrado" };
    }

    const player = game.roster.players[idx];
    if (!player.paid) {
      return { updated: false, reason: "Jogador já está desmarcado", playerName: player.name };
    }

    let userId = player.userId?._id ?? player.invitedByUserId?._id;

    if (!userId) {
      this.loggerService.log(`[LEDGER] Nenhum userId encontrado para ${player.name}`);
      return { updated: false, reason: 'User nao encontrado' };
    }

    const isDeleted = await this.ledgerRepo.deleteCredit(game.workspaceId._id, userId, game._id);

    if (isDeleted) {
      const updatedPlayer = {
        name: player.name,
        userId: player.userId,
        guest: player.guest,
        slot: player.slot,
        invitedByUserId: player.invitedByUserId,
        organizzeId: player.organizzeId,
        paid: false,
        paidAt: undefined,
      };

      game.roster.players[idx] = updatedPlayer;

      if (game.status === "finished") {
        game.status = "closed";
      }


      game.markModified("roster.players");
      const res = await this.updateMovimentacaoOrganizze(game, slot)
      if (!res.added) {
        return { updated: false, reason: 'Movimento nao foi atualizado no organizze' };
      }

      if (await game.save()) {
        await this.ledgerRepo.recomputeUserBalance(game.workspaceId._id.toString(), userId.toString());
        return { updated: true, playerName: player.name };
      }
    }

    return { updated: false, reason: 'Houve um problema ao remover o credito do jogador.' };
  }

  async markAsPaid(
    gameId: Types.ObjectId,
    slot?: number,
    opts?: { method?: "pix" | "dinheiro" | "transf" | "ajuste" }
  ): Promise<{ updated: boolean; reason?: string; game: GameDoc | null }> {
    if (typeof slot !== "number") {
      return { updated: false, reason: "Slot inválido", game: null };
    }
    const game = await this.gameRepo.findById(gameId);

    if (!game) {
      return { updated: false, reason: `Game nao encontrado!`, game: null }
    }

    let idx = game.roster.players.findIndex(p => p.slot === slot && p.paid == false);
    const player = game.roster.players[idx];
    if (!player) return { updated: false, reason: "Jogador não encontrado", game: game };

    if (player.paid) {
      return { updated: false, reason: "Jogador já está marcado como pago", game: game };
    }

    const inviterId =
      player.guest
        ? player.invitedByUserId?.toString()
        : player.userId?.toString();

    const now = new Date();
    const payMethod = opts?.method ?? "pix";

    const updatedPlayer = {
      name: player.name,
      userId: player.userId,
      guest: player.guest,
      slot: player.slot,
      invitedByUserId: player.invitedByUserId,
      organizzeId: player.organizzeId,
      paid: true,
      paidAt: now,
    };

    game.roster.players[idx] = updatedPlayer;

    game.markModified("roster");


    let creditError: string | undefined;
    if (inviterId) {
      const amountCents = game.priceCents ?? this.configService.organizze.valorJogo;
      const note = `Pagamento ${player.guest ? "de convidado" : ""} - ${player.name} - Jogo ${formatDateBR(game.date)}`;
      try {
        await this.ledgerRepo.addCredit({
          workspaceId: game.workspaceId.toString(),
          userId: inviterId,
          amountCents,
          gameId: game._id.toString(),
          note,
          method: payMethod,
        });
        const res = await this.updateMovimentacaoOrganizze(game, slot)
        if (!res.added) {
          return { updated: false, game: game };
        }
        const goalieSlots = Math.max(0, game.roster.goalieSlots ?? 2);

        const allPaidAfter = game.roster.players
          .filter(p => (p.slot ?? 0) > goalieSlots)
          .every(p => !!p.paid);

        if (allPaidAfter) {
          game.status = "finished";
        }

        if (await game.save()) {
          return { updated: true, game };
        }

      } catch (e: any) {
        creditError = e?.message ?? String(e);
        this.loggerService.log(`[GUEST-PAID] Falha ao creditar convidador: ${creditError}`);
      }
    }

    await game.save();

    if (creditError) {
      return { updated: true, game, reason: `Crédito não lançado: ${creditError}` };
    }

    return { updated: true, game: game };
  }


  private async updateMovimentacaoOrganizze(
    game: GameDoc,
    slot: Number
  ): Promise<{ added: boolean; }> {
    const { email, apiKey } = this.configService.organizze ?? {};

    if (!email || !apiKey) {
      this.loggerService.log('Organizze credentials are not set');
      return { added: true };
    }

    const idx = game.roster.players.findIndex(p => p.slot === slot && p.paid == true);

    if (idx === -1) return { added: false };

    const player = game.roster.players[idx];

    const payload = {
      description: `Pagamento ${player.guest ? "de convidado" : ""} — ${player.name} — jogo ${formatDateBR(game.date)}`,
      amount_cents: game.priceCents,
      date: todayISOyyyy_mm_dd(),
      update_future: false,
      paid: true
    };

    const headers = {
      "Content-Type": "application/json",
      "User-Agent": "BotFutebol (edipo1998@gmail.com)"
    } as const;

    try {

      const res = await axios.put(
        `https://api.organizze.com.br/rest/v2/transactions/${player.organizzeId?.toString()}`,
        payload,
        { auth: { username: email, password: apiKey }, headers }
      );
      if (res.status === 201 && res.data?.id != null) {
        return { added: true };
      }
      return { added: false };
    } catch (error: any) {
      const apiErr =
        error?.response?.data ??
        error?.message ??
        "Erro desconhecido ao criar transação no Organizze";

      this.loggerService.log("[ORGANIZZE] ERRO:", apiErr);
      return { added: false };
    }
  }

  private async criarMovimentacaoOrganizze(
    player: GamePlayer,
    dataDoJogo: Date,
    amountCents: number
  ): Promise<{ added: boolean }> {
    const { email, apiKey, accountId, categoryId } = this.configService.organizze ?? {};

    if (!email || !apiKey) {
      this.loggerService.log('Organizze credentials are not set');
      return { added: true };
    }

    const payload = {
      description: `${player.name} - Jogo ${formatDateBR(dataDoJogo)}`,
      amount_cents: amountCents,
      date: todayISOyyyy_mm_dd(),
      account_id: accountId,
      category_id: categoryId,
      paid: false
    };

    const headers = {
      "Content-Type": "application/json",
      "User-Agent": "BotFutebol (edipo1998@gmail.com)"
    } as const;

    try {
      const res = await axios.post(
        "https://api.organizze.com.br/rest/v2/transactions",
        payload,
        { auth: { username: email, password: apiKey }, headers }
      );

      if (res.status === 201 && res.data?.id != null) {
        player.organizzeId = res.data.id;
        return { added: true };
      }
      return { added: false };
    } catch (error: any) {
      const apiErr =
        error?.response?.data ??
        error?.message ??
        "Erro desconhecido ao criar transação no Organizze";

      this.loggerService.log("[ORGANIZZE] ERRO:", apiErr);
      return { added: false };
    }
  }


  buildGuestLabel(guestName: string, inviterName: string): string {
    const g = guestName.trim();
    const i = inviterName.trim();
    return `${g} (conv. ${i})`;
  }

  addGuestWithInviter(
    game: GameDoc,
    guestName: string,
    inviter: { _id: Types.ObjectId; name: string },
    opts?: { asGoalie?: boolean }
  ): { placed: boolean; slot?: number; finalName: string; role: "goalie" | "outfield" } {
    if (!Array.isArray(game.roster.players)) game.roster.players = [];

    const asGoalie = !!opts?.asGoalie;
    const label = this.buildGuestLabel(guestName, inviter.name);
    const maxPlayers = game.maxPlayers ?? 16;
    const goalieSlots = Math.max(0, game.roster.goalieSlots ?? 2);

    const used = new Set<number>(
      game.roster.players.map(p => p.slot).filter((s): s is number => typeof s === "number")
    );

    const basePlayer: Partial<GamePlayer> = {
      name: label,
      paid: false,
      guest: true,
      invitedByUserId: inviter._id,
    };

    if (asGoalie) {
      for (let slot = 1; slot <= goalieSlots; slot++) {
        if (!used.has(slot)) {
          game.roster.players.push({ ...basePlayer, slot } as GamePlayer);
          return { placed: true, slot, finalName: label, role: "goalie" };
        }
      }
      return { placed: false, finalName: label, role: "goalie" };
    }


    for (let slot = goalieSlots + 1; slot <= maxPlayers; slot++) {
      if (!used.has(slot)) {
        game.roster.players.push({ ...basePlayer, slot } as GamePlayer);
        return { placed: true, slot, finalName: label, role: "outfield" };
      }
    }
    return { placed: false, finalName: label, role: "outfield" };
  }

  async giveUpFromList(
    game: GameDoc,
    user: UserDoc,
    nomeAutor: string,
    reply: (txt: string) => void
  ): Promise<boolean> {
    const goalieSlots = Math.max(0, game.roster?.goalieSlots ?? 2);
    const players = Array.isArray(game.roster?.players) ? game.roster.players : [];
    const waitlist = Array.isArray(game.roster?.waitlist) ? game.roster.waitlist : [];

    const nomeTarget = (nomeAutor ?? "").trim().toLowerCase();

    let idxPlayer = players.findIndex(p => (p.name?.trim().toLowerCase() === nomeTarget && p.guest));
    if (idxPlayer <= -1) {
      idxPlayer = players.findIndex(p => (p.userId?._id.toString() ?? "").toLowerCase().includes(user._id.toString()));
    }
    let mensagemPromocao = "";

    if (idxPlayer > -1) {
      const removed = players[idxPlayer];
      const removedSlot = removed?.slot ?? 0;
      players.splice(idxPlayer, 1);

      if (removedSlot >= goalieSlots + 1 && waitlist.length > 0) {
        const promovido = waitlist.shift()!;
        players.push({
          slot: removedSlot,
          name: promovido.name ?? "Jogador",
          paid: false,
        });
        mensagemPromocao = `\n\n📢 Atenção: ${(promovido.name ?? "Jogador")} foi promovido da suplência para a lista principal!`;
      }

      if (await game.save()) {
        await reply(`Ok, ${nomeAutor}, seu nome foi removido da lista.` + mensagemPromocao);
        const texto = await this.formatList(game);
        await reply(texto);
      }
    }

    const idxWait = waitlist.findIndex(w => (w.name ?? "").toLowerCase().includes(nomeTarget));
    if (idxWait > -1) {
      waitlist.splice(idxWait, 1);
      await game.save();

      await reply(`Ok, ${nomeAutor}, você foi removido da suplência.`);
      const texto = await this.formatList(game);
      await reply(texto);
      return true;
    }

    return false;
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
      status: "open",
    }).populate("roster.players.userId");

    if (!game) {
      reply(
        "⚠️ Nenhuma lista ativa encontrada. Peça a um admin para iniciar com /lista."
      );
      return null;
    }

    return game;
  }

  async getActiveGame(workspaceId: Types.ObjectId, chatId: string): Promise<GameDoc | null> {
    return await this.gameRepo.findActiveForChat(workspaceId, chatId);
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

  alreadyInMainByLabel(game: GameDoc, label: string): boolean {
    return (game.roster.players ?? []).some(p => p.name?.trim().toLocaleLowerCase() === label?.trim().toLocaleLowerCase());
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
        game.roster.players.push({ userId: user._id, slot, name: user.name, paid: false, organizzeId: null });
        game.save();
        return { added: true };
      }
    }

    game.roster.waitlist.push({ userId: user._id, name: user.name, createdAt: new Date() });
    game.save();
    return { added: false, suplentePos: game.roster.waitlist.length };
  }

  async addGoalkeeper(game: GameDoc, user: UserDoc): Promise<{ added: boolean; suplentePos?: number }> {
    const usedSlots = new Set<number>(
      game.roster.players.map(p => p.slot).filter((s): s is number => typeof s === "number")
    );
    let placed = false;

    for (let slot = 1; slot <= game.roster.goalieSlots; slot++) {
      if (!usedSlots.has(slot)) {
        game.roster.players.push({
          slot,
          userId: user._id,
          name: user.name,
          paid: false,
        });
        placed = true;
        break;
      }
    }

    if (!placed) {
      game.roster.waitlist.push({
        userId: user._id,
        name: user.name,
        createdAt: new Date(),
      });

      if (await game.save()) {
        return { added: true, suplentePos: game.roster.waitlist.length };
      }
    }
    return { added: false, suplentePos: game.roster.waitlist.length };
  }

  takeNextGoalieSlot(game: GameDoc, user: UserDoc, name?: string): { placed: boolean } {
    if (!Array.isArray(game.roster.players)) game.roster.players = [];
    const goalieSlots = Math.max(1, game.roster.goalieSlots ?? 2);

    const used = new Set<number>(
      game.roster.players.map(p => p.slot).filter((s): s is number => typeof s === "number")
    );

    for (let slot = 1; slot <= goalieSlots; slot++) {
      if (!used.has(slot)) {
        game.roster.players.push({
          slot,
          userId: user._id,
          name: name ?? user.name,
          paid: false,
        });
        return { placed: true };
      }
    }
    return { placed: false };
  }

  pushToWaitlist(game: GameDoc, user: UserDoc, name?: string) {
    if (!Array.isArray(game.roster.waitlist)) game.roster.waitlist = [];
    game.roster.waitlist.push({
      userId: user._id,
      name: name ?? user.name,
      createdAt: new Date(),
    });
    return game.roster.waitlist.length;
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
        phoneE164: user.phoneE164,
        createdAt: new Date(),
      });
      return { added: true };
    } catch {
      return { added: false };
    }
  }

  async formatList(
    game: GameDoc,
  ): Promise<string> {
    if (!game) return "Erro: jogo não encontrado.";

    const d = new Date(game.date);
    const dia = String(d.getDate()).padStart(2, "0");
    const mes = String(d.getMonth() + 1).padStart(2, "0");
    const horario = formatHorario(d);

    const chat = await ChatModel.findOne({ chatId: game.chatId, workspaceId: game.workspaceId });

    const titulo = game?.title ?? "⚽ CAMPO DO VIANA";
    const pix = chat?.schedule?.pix ?? "fcjogasimples@gmail.com";
    const valor = `${Utils.formatCentsToReal(game?.priceCents ?? 0)}`;

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
      status: "open",
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

  async getDebtsSummary(workspace: WorkspaceDoc, user: UserDoc) {
    const balanceCents = await this.ledgerRepo.getUserBalance(
      workspace._id.toString(),
      user._id.toString()
    );

    console.log('balance: ', balanceCents);

    const games = await this.gameRepo.findUnpaidGamesForUser(
      workspace._id,
      user._id,
      50
    );

    const debts = games.map(g => {
      const goalieSlots = Math.max(0, g.roster?.goalieSlots ?? 2);
      const players: GamePlayer[] = g.roster?.players ?? [];

      const own: OwnDebts[] = players
        .filter(p =>
          String(p.userId) === String(user._id) &&
          isOutfield(p, goalieSlots) &&
          !p.paid
        )
        .map(p => ({ type: "your place" as const, slot: p.slot }));

      const guests: GuestDebts[] = players
        .filter(p =>
          p.guest === true &&
          String(p.invitedByUserId) === String(user._id) &&
          !p.paid
        )
        .map(p => ({ type: "guest" as const, name: p.name, slot: p.slot }));

      const has = own.length + guests.length > 0;
      if (!has) return null;

      return {
        gameId: g._id,
        date: g.date,
        title: g.title ?? "⚽ Jogo",
        own,
        guests,
        priceCents: g.priceCents ?? workspace.settings?.pricePerGameCents ?? this.configService.organizze.valorJogo,
      };
    }).filter(Boolean) as Array<{
      gameId: any; date: Date; title: string;
      own: OwnDebts[];
      guests: GuestDebts[] | undefined;
      priceCents: number;
    }>;

    return { balanceCents, debts };
  }

  formatDebtsMessage(summary: { balanceCents: number; debts: any[] }) {
    const linhas: string[] = [];

    linhas.push(`📊 *Seu saldo:* ${Utils.formatCentsToReal(summary.balanceCents)}`);

    if (summary.debts.length === 0) {
      linhas.push(`\n✅ Você não possui pendências de jogos.`);
      return linhas.join("\n");
    }

    linhas.push(`\n🧾 *Jogos com pendência:*`);
    for (const g of summary.debts) {
      const dia = new Date(g.date);
      const data = `${String(dia.getDate()).padStart(2, "0")}/${String(dia.getMonth() + 1).padStart(2, "0")}`;
      const valor = Utils.formatCentsToReal(g.priceCents);

      const ownStr = g.own.map((o: OwnDebts) => `- Vaga própria (slot ${o.slot ?? "?"}) — ${valor}`).join("\n");
      const guestStr = g.guests.map((gu: GuestDebts) => `- Convidado ${gu.name ?? ""} (slot ${gu.slot ?? "?"}) — ${valor}`).join("\n");
      const bloco = [ownStr, guestStr].filter(Boolean).join("\n");

      linhas.push(`\n*${data}* — ${g.title}\n${bloco}`);
    }

    linhas.push(`\nℹ️ Goleiros não geram débito.`);
    return linhas.join("\n");
  }


}
