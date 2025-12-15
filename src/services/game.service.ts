import { injectable, inject } from 'tsyringe';
import { Model, Types } from 'mongoose';
import { GAME_MODEL_TOKEN, IGame } from '../core/models/game.model';
import { USER_MODEL_TOKEN, IUser } from '../core/models/user.model';
import { GameDetailResponseDto, GameResponseDto, PlayerInGameDto, WaitlistPlayerDto, OutlistPlayerDto, AddPlayerToGameDto, UpdateGameDto } from '../api/dto/game.dto';
import { ApiError } from '../api/middleware/error.middleware';

import { WhatsAppService } from './whatsapp.service';

import { GameRepository } from '../core/repositories/game.respository';
import { LedgerRepository } from '../core/repositories/ledger.repository';
import { ConfigService } from '../config/config.service';
import { LoggerService } from '../logger/logger.service';

import { WorkspaceRepository } from '../core/repositories/workspace.repository';
import { ChatModel } from '../core/models/chat.model';
import { WorkspaceDoc } from '../core/models/workspace.model';
import Utils from '../utils/utils';
import { getNextWeekday, applyTime, formatHorario, todayISOyyyy_mm_dd, formatDateBR } from '../utils/date';
import { isOutfield } from '../utils/lineup';
import axios from 'axios';
import { GameModel, GameRoster, GamePlayer } from '../core/models/game.model';
import { Message } from 'whatsapp-web.js';

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

type OwnDebts = { type: "your place"; slot?: number | null };
type GuestDebts = { type: "guest"; name?: string; slot?: number | null };

type UserDebtByWorkspace = {
  workspaceId: string;
  workspaceName?: string;
  workspaceSlug?: string;
  balanceCents: number;
  games: UserDebtByGame[];
};

type UserDebtByGame = {
  gameId?: string;
  date?: Date;
  title?: string;
  debitsCents: number;
  creditsCents: number;
  totalCents?: number | undefined;
  lines?: GameLine[];
};

type FormattedGame = {
  date?: Date;
  title?: string;
  totalCents: number;
  lines: GameLine[];
};

type FormattedWorkspace = {
  workspaceName?: string;
  workspaceSlug?: string;
  balanceCents: number;
  games: FormattedGame[];
};

type GameLine = { label: string; amountCents: number };

@injectable()
export class GameService {
  constructor(
    @inject(GAME_MODEL_TOKEN) private gameModel: Model<IGame>,
    @inject(USER_MODEL_TOKEN) private userModel: Model<IUser>,
    @inject(WhatsAppService) private whatsappService: WhatsAppService,
    @inject(GameRepository) private readonly gameRepo: GameRepository,
    @inject(LedgerRepository) private readonly ledgerRepo: LedgerRepository,
    @inject(ConfigService) private readonly configService: ConfigService,
    @inject(LoggerService) private readonly loggerService: LoggerService,

    @inject(WorkspaceRepository) private readonly workspaceRepo: WorkspaceRepository,
  ) { }

  async listGames(filters: {
    status?: string;
    type?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ games: GameResponseDto[]; total: number; page: number; totalPages: number }> {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const query: any = {};
    if (filters.status) query.status = filters.status;
    if (filters.type) query.gameType = filters.type;
    if (filters.search) {
      query.$or = [
        { title: { $regex: filters.search, $options: 'i' } },
        { location: { $regex: filters.search, $options: 'i' } },
      ];
    }

    const [games, total] = await Promise.all([
      this.gameModel.find(query).sort({ date: -1 }).skip(skip).limit(limit).exec(),
      this.gameModel.countDocuments(query).exec(),
    ]);

    return {
      games: games.map((game) => this.mapToGameResponse(game)),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getGameById(gameId: string): Promise<IGame | null> {
    return this.gameModel.findById(gameId).exec();
  }

  async getGameDetail(gameId: string): Promise<GameDetailResponseDto> {
    const game = await this.gameModel.findById(gameId).exec();
    if (!game) {
      throw new ApiError(404, 'Game not found');
    }

    const players: PlayerInGameDto[] = [];
    const waitlist: WaitlistPlayerDto[] = [];
    const outlist: OutlistPlayerDto[] = [];

    for (const player of game.roster.players) {
      const goalieSlots = game.roster.goalieSlots ?? 2;
      const isGoalkeeper = (player.slot ?? 0) <= goalieSlots && (player.slot ?? 0) > 0;

      const playerDto: PlayerInGameDto = {
        id: (player.invitedByUserId ?? player.userId)?.toString() ?? '',
        name: player.name,
        phone: player.phoneE164,
        slot: player.slot,
        isGoalkeeper,
        isPaid: player.paid || false,
      };

      players.push(playerDto);
    }

    game.roster.waitlist?.forEach((wp, index) => {
      waitlist.push({
        id: wp.userId?.toString() ?? '',
        name: wp.name ?? '',
        phone: wp.phoneE164 ?? '',
        position: index + 1,
      });
    });

    game.roster.outlist?.forEach((op) => {
      outlist.push({
        id: op.userId?.toString() ?? '',
        name: op.name ?? '',
        phone: op.phoneE164 ?? '',
      });
    });

    const outfieldPlayers = players.filter((p) => !p.isGoalkeeper);
    const paidPlayers = outfieldPlayers.filter((p) => p.isPaid);
    const totalToReceive = outfieldPlayers.length * game.priceCents;
    const totalPaid = paidPlayers.length * game.priceCents;

    return {
      ...this.mapToGameResponse(game),
      players,
      waitlist,
      outlist,
      financialSummary: {
        totalToReceive,
        totalPaid,
        totalPending: totalToReceive - totalPaid,
        paidCount: paidPlayers.length,
        unpaidCount: outfieldPlayers.length - paidPlayers.length,
      },
    };
  }

  async createGame(data: any, createdByPhone: string): Promise<GameResponseDto> {
    const creator = await this.userModel.findOne({ phoneE164: createdByPhone }).exec();
    if (!creator) {
      throw new ApiError(404, 'User not found');
    }

    const game = await this.gameModel.create({
      title: data.name,
      gameType: data.type,
      date: new Date(data.date + 'T' + data.time),
      location: data.location,
      maxPlayers: data.maxPlayers,
      priceCents: data.pricePerPlayer,
      chatId: data.chatId,
      workspaceId: data.workspaceId,
      status: 'open',
      players: [],
      waitlist: [],
      outlist: [],
    });

    // Enviar lista para o grupo
    try {
      const message = await this.formatGameList(game);
      await this.whatsappService.sendMessage(game.chatId, message);
    } catch (error) {
      this.loggerService.error(`Failed to send game list to group ${game.chatId}`, error);
    }

    return this.mapToGameResponse(game);
  }

  async cancelGame(gameId: string): Promise<void> {
    const game = await this.gameModel.findById(gameId).exec();
    if (!game) {
      throw new ApiError(404, 'Game not found');
    }

    game.status = "cancelled";
    await this.gameRepo.save(game);

    // Enviar mensagem de cancelamento e fixar
    try {
      const sent = await this.whatsappService.sendMessage(game.chatId, "Jogo Cancelado!");
      if (sent && sent.pin) {
        await sent.pin(86400); // 24 horas
      }
    } catch (error) {
      this.loggerService.error(`Failed to send/pin cancellation message to group ${game.chatId}`, error);
    }
  }

  async closeGame(gameId: string): Promise<GameResponseDto> {
    const game = await this.gameModel.findById(gameId).exec();
    if (!game) {
      throw new ApiError(404, 'Game not found');
    }

    await this.closeGameInternal(game);

    return this.mapToGameResponse(game);
  }

  async closeGameInternal(game: IGame): Promise<CloseGameResult> {
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
                amountCents: this.configService.whatsApp.adminNumbers.includes(player?.phoneE164 ?? "") ? 0 : amountCents,
                gameId: game._id.toString(),
                note: player.guest
                  ? `Débito (convidado) — ${player.name} — jogo ${formatDateBR(game.date)}`
                  : `Débito referente ao jogo ${playerName} - ${formatDateBR(game.date)}`,
                category: "player-debt",
                status: "pendente"
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
            const org = await this.criarMovimentacaoOrganizze(player, game.date, amountCents, game.workspaceId.toString());
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

  async addPlayer(gameId: string, data: AddPlayerToGameDto): Promise<void> {
    const game = await this.gameModel.findById(gameId).exec();
    if (!game) {
      throw new ApiError(404, 'Jogo não encontrado');
    }

    if (data.guestName) {
      if (!data.name) {
        throw new ApiError(400, 'Nome de quem convida é obrigatório ao adicionar convidado');
      }

      await this.addGuestPlayer(
        game,
        data.phone,
        data.name,
        data.guestName,
        { asGoalie: data.isGoalkeeper || false }
      );

      await game.save();
      return;
    }

    let user = await this.userModel.findOne({ phoneE164: data.phone }).exec();
    if (!user) {
      if (!data.name) {
        throw new ApiError(400, 'Usuário não encontrado e nome não fornecido para criar um novo');
      }
      user = await this.userModel.create({
        phoneE164: data.phone,
        name: data.name,
      });
    }

    const isInMainRoster = game.roster.players.some(p =>
      p.userId?.toString() === user!._id.toString() || p.phoneE164 === data.phone
    );
    const isInWaitlist = game.roster.waitlist?.some(w =>
      w.userId?.toString() === user!._id.toString() || w.phoneE164 === data.phone
    );

    if (isInMainRoster) {
      throw new ApiError(400, 'Jogador já está na lista do jogo');
    }

    if (isInWaitlist) {
      throw new ApiError(400, 'Jogador já está na lista de espera');
    }

    if (data.isGoalkeeper) {
      await this.addGoalkeeper(game, user);
    } else {
      await this.addOutfieldPlayer(game, user);
    }
  }

  async removePlayer(gameId: string, playerId: string): Promise<void> {
    const game = await this.gameModel.findById(gameId).exec();
    if (!game) {
      throw new ApiError(404, 'Game not found');
    }

    const user = await this.userModel.findById(playerId).exec();
    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    await this.giveUpFromList(game, user, user.name);
  }

  async addOutfieldPlayer(
    game: IGame,
    user: IUser,
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
        game.roster.players.push({ userId: user._id, phoneE164: user.phoneE164 || user.lid, slot, name: user.name, paid: false, organizzeId: null });
        game.save();
        return { added: true };
      }
    }

    game.roster.waitlist.push({ userId: user._id, phoneE164: user.phoneE164 || user.lid, name: user.name, createdAt: new Date() });
    game.save();
    return { added: false, suplentePos: game.roster.waitlist.length };
  }

  async addGoalkeeper(game: IGame, user: IUser): Promise<{ added: boolean; suplentePos?: number }> {
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
          phoneE164: user.phoneE164 || user.lid,
          paid: false,
        });
        placed = true;
        break;
      }
    }

    if (placed) {
      await game.save();
      return { added: true };
    }

    throw new ApiError(400, 'Não há vagas de goleiro disponíveis');
  }

  async giveUpFromList(
    game: IGame,
    user: IUser,
    nomeAutor: string,
  ): Promise<{ removed: boolean, message: string, mentions?: string[] }> {
    const goalieSlots = Math.max(0, game.roster?.goalieSlots ?? 2);
    const players = Array.isArray(game.roster?.players) ? game.roster.players : [];
    const waitlist = Array.isArray(game.roster?.waitlist) ? game.roster.waitlist : [];

    const nomeTarget = (nomeAutor ?? "").trim().toLowerCase();

    let idxPlayer = players.findIndex(p => (p.name?.trim().toLowerCase() === nomeTarget && p.guest));
    this.loggerService.log(`idxPlayer guest: ${idxPlayer}`);
    if (idxPlayer <= -1) {
      idxPlayer = players.findIndex(p => (p.userId?._id?.toString() ?? p.userId?.toString() ?? "")
        .toLowerCase()
        .includes(user._id.toString()));
    }

    let mensagemPromocao = "";

    if (idxPlayer > -1) {
      const removed = players[idxPlayer];
      const removedSlot = removed?.slot ?? 0;
      players.splice(idxPlayer, 1);
      nomeAutor = removed.name;

      let promotedPlayer: any | null = null;
      let promovido: any | null = null;

      if (removedSlot >= goalieSlots + 1 && waitlist.length > 0) {
        promovido = waitlist.shift()!;

        promotedPlayer = {
          slot: removedSlot,
          userId: promovido.userId,
          name: promovido.name ?? "Jogador",
          phoneE164: promovido.phoneE164,
          paid: false,
        };

        players.push(promotedPlayer);
      }

      const mentions: string[] = [];
      if (promovido?.phoneE164) {
        const e164 = promovido.phoneE164.replace(/@c\.us$/i, "");
        const jid = `${e164.replace(/\D/g, "")}@c.us`;
        mentions.push(jid);
      }

      const alvo =
        promovido?.phoneE164
          ? `*@${promovido.phoneE164.replace(/@c\.us$/i, "")}*`
          : `*${promovido?.name ?? "Jogador"}*`;

      if (promovido) {
        mensagemPromocao = `\n\n📢 Atenção: ${alvo} foi promovido da suplência para a lista principal (slot ${removedSlot})!`;
      }

      game.markModified("roster.players");
      game.markModified("roster.waitlist");

      if (await game.save()) {
        let texto = `Ok, ${nomeAutor}, seu nome foi removido da lista.${mensagemPromocao}`;

        if (removed.guest) {
          texto = `Ok, o convidado: ${nomeAutor}, foi removido da lista.`;
        }
        return { removed: true, message: texto, mentions };
      }
    }

    const idxWait = waitlist.findIndex(w => {
      const nameMatch = (w.name ?? "").toLowerCase().includes(nomeTarget);
      const userIdMatch = (w.userId?._id?.toString() ?? w.userId?.toString() ?? "")
        .toLowerCase()
        .includes(user._id.toString());
      return nameMatch || userIdMatch;
    });

    if (idxWait > -1) {
      waitlist.splice(idxWait, 1);
      game.markModified("roster.waitlist");
      if (await game.save()) {
        mensagemPromocao = `Ok, ${nomeAutor}, você foi removido da suplência.`;
        return { removed: true, message: mensagemPromocao }
      }
    }
    mensagemPromocao = `Não foi possível remover da lista!`
    return { removed: false, message: mensagemPromocao }
  }

  pullFromOutlist(
    game: IGame,
    user: IUser,
  ): void {
    if (!game.roster?.outlist) game.roster.outlist = [];

    const uid = user._id.toString();

    game.roster.outlist = game.roster.outlist.filter((o) => {
      const sameUser = o.userId?._id.toString() === uid;
      return !sameUser;
    });
  }

  alreadyInMainByLabel(game: IGame, label: string): boolean {
    return (game.roster.players ?? []).some(p => p.name?.trim().toLocaleLowerCase() === label?.trim().toLocaleLowerCase());
  }

  alreadyInList(roster: GameRoster, user: IUser): boolean {
    return (
      roster.players.some(p => p.userId?.toString() === user._id.toString()) ||
      roster.waitlist.some(p => p.userId?.toString() === user._id.toString())
    );
  }

  takeNextGoalieSlot(game: IGame, user: IUser, name?: string): { placed: boolean } {
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
          phoneE164: user.phoneE164 || user.lid,
          paid: false,
        });
        return { placed: true };
      }
    }
    return { placed: false };
  }

  pushToWaitlist(game: IGame, user: IUser, name?: string) {
    if (!Array.isArray(game.roster.waitlist)) game.roster.waitlist = [];
    game.roster.waitlist.push({
      userId: user._id,
      name: name ?? user.name,
      createdAt: new Date(),
    });
    return game.roster.waitlist.length;
  }

  buildGuestLabel(guestName: string, inviterName: string): string {
    const g = guestName.trim();
    const i = inviterName.trim();
    return `${g} (conv. ${i})`;
  }

  addGuestWithInviter(
    game: IGame,
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

  async markPayment(gameId: string, slot: number, isPaid: boolean): Promise<void> {
    const game = await this.gameModel.findById(gameId).exec();
    if (!game) {
      throw new ApiError(404, 'Jogo não encontrado');
    }

    const player = game.roster.players.find(p => p.slot === slot);

    if (!player) {
      throw new ApiError(404, 'Jogador não encontrado no slot especificado');
    }

    if (isPaid) {
      await this.markAsPaid(game._id, slot);
    } else {
      await this.unmarkAsPaid(game, slot);
    }
  }

  async unmarkAsPaid(
    game: IGame,
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

    await this.ledgerRepo.unconfirmDebit(
      game.workspaceId._id.toString(),
      userId.toString(),
      game._id.toString()
    );

    const isDeleted = await this.ledgerRepo.deleteCredit(game.workspaceId._id, userId, game._id);

    if (isDeleted) {
      const updatedPlayer = {
        name: player.name,
        userId: player.userId,
        phoneE164: player.phoneE164,
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
      const res = await this.updateMovimentacaoOrganizze(game, slot, false)
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
  ): Promise<{ updated: boolean; reason?: string; game: IGame | null }> {
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

    if (!inviterId) {
      return { updated: false, reason: "Usuário não identificado para este jogador", game: game };
    }

    const now = new Date();
    const payMethod = opts?.method ?? "pix";
    const amountCents = game.priceCents ?? this.configService.organizze.valorJogo;
    const finalAmount = this.configService.whatsApp.adminNumbers.includes(player?.phoneE164 ?? "") ? 0 : amountCents;

    const pendingDebit = await this.ledgerRepo.findPendingDebitByUserAndGame(
      game.workspaceId.toString(),
      inviterId,
      game._id.toString()
    );

    const updatedPlayer = {
      name: player.name,
      userId: player.userId,
      phoneE164: player.phoneE164,
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

    try {
      if (pendingDebit) {
        await this.ledgerRepo.confirmDebit(pendingDebit._id.toString());

        const note = `Pagamento ${player.guest ? "de convidado" : ""} - ${player.name} - Jogo ${formatDateBR(game.date)}`;

        await this.ledgerRepo.addCredit({
          workspaceId: game.workspaceId.toString(),
          userId: inviterId,
          amountCents: finalAmount,
          gameId: game._id.toString(),
          note,
          method: payMethod,
          category: "player-payment",
        });
      } else {
        await this.ledgerRepo.addDebit({
          workspaceId: game.workspaceId.toString(),
          userId: inviterId,
          amountCents: finalAmount,
          gameId: game._id.toString(),
          note: player.guest
            ? `Débito (convidado) — ${player.name} — jogo ${formatDateBR(game.date)}`
            : `Débito referente ao jogo ${player.name} - ${formatDateBR(game.date)}`,
          category: "player-debt",
          status: "confirmado",
          confirmedAt: now
        });

        const note = `Pagamento ${player.guest ? "de convidado" : ""} - ${player.name} - Jogo ${formatDateBR(game.date)}`;

        await this.ledgerRepo.addCredit({
          workspaceId: game.workspaceId.toString(),
          userId: inviterId,
          amountCents: finalAmount,
          gameId: game._id.toString(),
          note,
          method: payMethod,
          category: "player-payment",
        });
      }

      const res = await this.updateMovimentacaoOrganizze(game, slot);
      if (!res.added) {
        this.loggerService.log(`[ORGANIZZE] Falha ao atualizar movimentação para slot ${slot}`);
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
      this.loggerService.log(`[MARK-AS-PAID] Falha ao processar pagamento: ${creditError}`);

      game.roster.players[idx].paid = false;
      game.roster.players[idx].paidAt = undefined;
      await game.save();

      return { updated: false, reason: `Erro ao processar pagamento: ${creditError}`, game };
    }

    await game.save();

    if (creditError) {
      return { updated: true, game, reason: `Crédito não lançado: ${creditError}` };
    }

    return { updated: true, game: game };
  }


  private async updateMovimentacaoOrganizze(
    game: IGame,
    slot: Number,
    markAsPaid: boolean = true
  ): Promise<{ added: boolean; }> {
    const organizzeConfig = await this.workspaceRepo.getDecryptedOrganizzeConfig(
      game.workspaceId.toString()
    );

    if (!organizzeConfig?.email || !organizzeConfig?.apiKey) {
      this.loggerService.log('[ORGANIZZE] Workspace Organizze config not set, skipping');
      return { added: true };
    }

    const { email, apiKey } = organizzeConfig;

    const idx = game.roster.players.findIndex(p => p.slot === slot);

    if (idx === -1) return { added: false };

    const player = game.roster.players[idx];

    if (!player.organizzeId) {
      this.loggerService.log(`[ORGANIZZE] Player ${player.name} não tem organizzeId, pulando atualização`);
      return { added: true };
    }

    const payload = {
      description: `Pagamento ${player.guest ? "de convidado" : ""} — ${player.name} — jogo ${formatDateBR(game.date)}`,
      amount_cents: game.priceCents,
      date: todayISOyyyy_mm_dd(),
      update_future: false,
      paid: markAsPaid
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
    amountCents: number,
    workspaceId: string
  ): Promise<{ added: boolean }> {
    // Get workspace-specific Organizze config
    const organizzeConfig = await this.workspaceRepo.getDecryptedOrganizzeConfig(workspaceId);

    if (!organizzeConfig?.email || !organizzeConfig?.apiKey) {
      this.loggerService.log('[ORGANIZZE] Workspace Organizze config not set, skipping');
      return { added: true };
    }

    const { email, apiKey, accountId, categories } = organizzeConfig;
    // Use playerPayment category for game payments
    const categoryId = categories.playerPayment;

    const payload = {
      description: `${player.name} - Jogo ${formatDateBR(dataDoJogo)} - Slot: ${player.slot}`,
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

  async updateGame(gameId: string, data: UpdateGameDto): Promise<GameResponseDto> {
    const game = await this.gameModel.findById(gameId).exec();
    if (!game) {
      throw new ApiError(404, 'Game not found');
    }

    if (data.name) game.title = data.name;
    if (data.date || data.time) {
      const dateStr = data.date || game.date.toISOString().split('T')[0];
      const timeStr = data.time || game.date.toTimeString().slice(0, 5);
      game.date = new Date(dateStr + 'T' + timeStr);
    }
    if (data.location) game.location = data.location;
    if (data.maxPlayers) game.maxPlayers = data.maxPlayers;
    if (data.pricePerPlayer) game.priceCents = data.pricePerPlayer * 100;
    if (data.status) game.status = data.status;

    await game.save();
    return this.mapToGameResponse(game);
  }

  async sendReminder(gameId: string): Promise<void> {
    const game = await this.gameModel.findById(gameId).exec();
    if (!game) {
      throw new ApiError(404, 'Game not found');
    }

    if (!game.chatId) {
      throw new ApiError(400, 'Game has no associated chat');
    }

    const message = await this.formatList(game);
    await this.whatsappService.sendMessage(game.chatId, message);
  }

  async getActiveGame(workspaceId: string, chatId: string): Promise<IGame | null> {
    return await this.gameRepo.findActiveForChat(new Types.ObjectId(workspaceId), chatId);
  }

  async formatGameList(game: IGame): Promise<string> {
    return this.formatList(game);
  }

  argsFromMessage(message: Message): string[] {
    const commandParts = message.body.split('\n');
    return commandParts[0].split(' ').slice(1);
  }

  async createGameForChat(workspace: any, chatId: string): Promise<IGame> {
    const { game } = await this.initListForChat(workspace, chatId);
    return game;
  }

  async addPlayerToGame(game: IGame, phone: string, name: string): Promise<{ added: boolean; message?: string; suplentePos?: number }> {
    let user = await this.userModel.findOne({ phoneE164: phone }).exec();

    if (!user) {
      // Check if phone is actually a LID (15+ digits)
      const isLid = /^\d{15,}$/.test(phone);
      user = await this.userModel.create({
        name,
        ...(isLid ? { lid: phone } : { phoneE164: phone })
      });
    } else if (user.name === user.phoneE164) {
      user.name = name;
      await user.save();
    }

    if (!user) throw new Error("Failed to create/update user");

    this.pullFromOutlist(game, user);

    if (this.alreadyInList(game.roster, user)) {
      return { added: false, message: "Você já está na lista!" };
    }

    const res = await this.addOutfieldPlayer(game, user);
    return { added: res.added, suplentePos: res.suplentePos };
  }

  async closeGameForBot(game: IGame): Promise<any> {
    return this.closeGameInternal(game);
  }

  async addOffLineupPlayer(game: IGame, phone: string, name: string): Promise<{ added: boolean; message?: string }> {
    let user = await this.userModel.findOne({ phoneE164: phone }).exec();

    if (!user) {
      // Check if phone is actually a LID (15+ digits)
      const isLid = /^\d{15,}$/.test(phone);
      user = await this.userModel.create({
        name,
        ...(isLid ? { lid: phone } : { phoneE164: phone })
      });
    } else if (user.name === user.phoneE164) {
      user.name = name;
      await user.save();
    }

    if (!user) throw new Error("Failed to create/update user");

    try {
      game.roster.outlist = game.roster.outlist ?? [];
      game.roster.outlist.push({
        userId: user._id,
        name: user.name,
        phoneE164: user.phoneE164 || user.lid,
        createdAt: new Date(),
      });
      return { added: true };
    } catch {
      return { added: false };
    }
  }

  async removePlayerFromGame(game: IGame, phone: string, name: string, authorName?: string): Promise<{ removed: boolean; message: string; mentions?: string[] }> {
    let user = await this.userModel.findOne({ phoneE164: phone }).exec();

    if (!user) {
      // Check if phone is actually a LID (15+ digits)
      const isLid = /^\d{15,}$/.test(phone);
      user = await this.userModel.create({
        name,
        ...(isLid ? { lid: phone } : { phoneE164: phone })
      });
    } else if (user.name === user.phoneE164) {
      user.name = name;
      await user.save();
    }

    if (!user) throw new Error("Failed to create/update user");

    return this.giveUpFromList(game, user, authorName ?? '');
  }

  async addGuestPlayer(game: IGame, inviterPhone: string, inviterName: string, guestName: string, options: { asGoalie: boolean }): Promise<{ placed: boolean; role?: string; finalName?: string; slot?: number; message?: string }> {
    let user = await this.userModel.findOne({ phoneE164: inviterPhone }).exec();

    if (!user) {
      // Check if phone is actually a LID (15+ digits)
      const isLid = /^\d{15,}$/.test(inviterPhone);
      user = await this.userModel.create({
        name: inviterName,
        ...(isLid ? { lid: inviterPhone } : { phoneE164: inviterPhone })
      });
    } else if (user.name === user.phoneE164) {
      user.name = inviterName;
      await user.save();
    }

    if (!user) throw new Error("Failed to create/update user");

    return this.addGuestWithInviter(
      game,
      guestName,
      { _id: user._id, name: user.name ?? '' },
      options
    );
  }

  async addGoalkeeperToGame(game: IGame, phone: string, name: string): Promise<{ placed: boolean; pos?: number; message?: string }> {
    let user = await this.userModel.findOne({ phoneE164: phone }).exec();

    if (!user) {
      // Check if phone is actually a LID (15+ digits)
      const isLid = /^\d{15,}$/.test(phone);
      user = await this.userModel.create({
        name,
        ...(isLid ? { lid: phone } : { phoneE164: phone })
      });
    } else if (user.name === user.phoneE164) {
      user.name = name;
      await user.save();
    }

    if (!user) throw new Error("Failed to create/update user");

    if (this.alreadyInList(game.roster, user)) {
      return { placed: false, message: "Você já está na lista!" };
    }

    this.pullFromOutlist(game, user);

    const { placed } = this.takeNextGoalieSlot(game, user, user.name);
    if (!placed) {
      const pos = this.pushToWaitlist(game, user, user.name);
      return { placed: false, pos };
    }

    return { placed: true };
  }

  async formatList(
    game: IGame,
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

  async getUserDebtsGrouped(userId: string): Promise<FormattedWorkspace[]> {
    const balances = await this.ledgerRepo.listBalancesByUser(userId);
    const ledgers = await this.ledgerRepo.listLedgersByUser(userId);

    const map = new Map<string, {
      workspaceId: string;
      balanceCents: number;
      games: Array<{
        gameId?: string;
        debitsCents: number;
        creditsCents: number;
        date?: Date;
        title?: string;
        totalCents?: number;
        lines?: GameLine[];
      }>;
      workspaceName?: string;
      workspaceSlug?: string;
    }>();

    for (const b of balances) {
      const wsId = (b.workspaceId as any)?.toString?.() ?? String(b.workspaceId);
      if (!map.has(wsId)) {
        map.set(wsId, { workspaceId: wsId, balanceCents: b.balanceCents ?? 0, games: [] });
      } else {
        map.get(wsId)!.balanceCents += b.balanceCents ?? 0;
      }
    }

    for (const l of ledgers) {
      const wsId = (l.workspaceId as any)?.toString?.() ?? String(l.workspaceId);
      if (!map.has(wsId)) {
        map.set(wsId, { workspaceId: wsId, balanceCents: 0, games: [] });
      }
    }

    for (const l of ledgers) {
      const wsId = (l.workspaceId as any)?.toString?.() ?? String(l.workspaceId);
      const ws = map.get(wsId)!;

      // Determine the key for grouping
      let key: string;
      if (l.gameId) {
        // Has gameId - group by game
        const gid = (l.gameId as any)?.toString?.() ?? String(l.gameId);
        key = gid;
      } else if ((l as any).category === "churrasco") {
        // BBQ debt - group by date extracted from note
        let dateKey = "_bbq_";
        if ((l as any).note) {
          const noteMatch = ((l as any).note as string).match(/(\d{4}-\d{2}-\d{2})/);
          if (noteMatch) {
            dateKey = `_bbq_${noteMatch[1]}`; // e.g., "_bbq_2025-12-09"
          }
        }
        key = dateKey;
      } else {
        // Other non-game debts
        key = "_no_game_";
      }

      let game = ws.games.find(g => ((g as any)._internalKey ?? g.gameId ?? "_no_game_") === key);
      if (!game) {
        const newGame: any = { gameId: key.startsWith("_bbq_") || key === "_no_game_" ? undefined : key, debitsCents: 0, creditsCents: 0 };
        // Store the internal key for BBQ entries so we can match them later
        if (key.startsWith("_bbq_") || key === "_no_game_") {
          newGame._internalKey = key;
        }
        ws.games.push(newGame);
        game = newGame;
      }

      const cents = Number(l.amountCents ?? 0);
      if (l.type === "debit") game!.debitsCents += cents;
      if (l.type === "credit") game!.creditsCents += cents;
    }

    const wsIds = Array.from(map.keys())
      .filter(id => Types.ObjectId.isValid(id))
      .map(id => new Types.ObjectId(id));

    const workspaces = wsIds.length
      ? await (this.workspaceRepo as any).model
        ?.find({ _id: { $in: wsIds } })
        .select({ name: 1, slug: 1 })
        .lean()
      : [];

    const wsInfo = new Map<string, { name?: string; slug?: string }>();
    for (const w of workspaces ?? []) {
      wsInfo.set(w._id.toString(), { name: w.name, slug: w.slug });
    }

    const allGameIds = Array.from(map.values())
      .flatMap(ws => ws.games.map(g => g.gameId).filter(Boolean)) as string[];
    const uniqueGameIds = Array.from(new Set(allGameIds))
      .filter(id => Types.ObjectId.isValid(id))
      .map(id => new Types.ObjectId(id));

    const gInfo = new Map<string, { date?: Date; title?: string; priceCents?: number; roster?: any }>();
    const rawIGames = new Map<string, any>();

    if (uniqueGameIds.length > 0) {
      const games = await (this.gameRepo as any).model
        ?.find({ _id: { $in: uniqueGameIds } })
        .select({ _id: 1, date: 1, title: 1, priceCents: 1, roster: 1, workspaceId: 1 })
        .lean();

      for (const g of games ?? []) {
        const id = g._id.toString();
        gInfo.set(id, { date: g.date, title: g.title, priceCents: g.priceCents, roster: g.roster });
        rawIGames.set(id, g);
      }
    }

    const defaultPriceFrom = (workspaceId: string): number => {
      return this.configService.organizze?.valorJogo ?? 0;
    };

    for (const ws of map.values()) {
      for (const g of ws.games) {
        const gid = g.gameId;

        // Check if this is a BBQ debt entry by checking the internal key
        const internalKey = (g as any)._internalKey;
        const isBBQ = internalKey && internalKey.startsWith("_bbq_");

        const IGame = gid ? rawIGames.get(gid) : undefined;
        const gi = gid ? gInfo.get(gid) : undefined;

        const priceCents =
          (IGame?.priceCents ?? null) != null
            ? Number(IGame.priceCents)
            : defaultPriceFrom(ws.workspaceId);

        const lines: GameLine[] = [];

        if (IGame) {
          const roster = IGame.roster ?? {};
          const goalieSlots = Math.max(0, roster.goalieSlots ?? 2);
          const players = Array.isArray(roster.players) ? roster.players : [];

          const ownUnpaid = players.filter((p: any) =>
            String(p.userId) === String(userId) &&
            (p.slot ?? 0) > goalieSlots &&
            !p.paid
          );
          for (const p of ownUnpaid) {
            lines.push({ label: "Própria vaga", amountCents: priceCents });
          }

          const guestUnpaid = players.filter((p: any) =>
            p.guest === true &&
            String(p.invitedByUserId) === String(userId) &&
            (p.slot ?? 0) > goalieSlots &&
            !p.paid
          );
          for (const p of guestUnpaid) {
            const clean = (p.name ?? "").replace(/\s*\(conv\.[^)]+\)\s*$/i, "").trim() || "Convidado";
            lines.push({ label: `Convidado ${clean}`, amountCents: priceCents });
          }
        } else if (isBBQ) {
          const bbqLedgers = ledgers.filter(l =>
            !l.gameId &&
            (l as any).category === "churrasco" &&
            (l.workspaceId as any)?.toString?.() === ws.workspaceId &&
            l.type === "debit"
          );

          const processedIds = new Set<string>();

          for (const bbqL of bbqLedgers) {
            const ledgerId = (bbqL._id as any)?.toString?.() ?? String(bbqL._id);
            if (processedIds.has(ledgerId)) {
              continue; // Skip if already processed
            }
            processedIds.add(ledgerId);

            const amount = Number(bbqL.amountCents ?? 0);
            lines.push({ label: "Churrasco", amountCents: amount });
          }
        }

        const totalLines = lines.reduce((s, l) => s + (l.amountCents ?? 0), 0);

        // Set title and date
        if (isBBQ) {
          g.title = "🍖 Churrasco";
          // Try to extract date from note field (format: "Debito de churrasco - YYYY-MM-DD - UserName")
          const bbqLedger = ledgers.find(l =>
            !l.gameId &&
            (l as any).category === "churrasco" &&
            (l.workspaceId as any)?.toString?.() === ws.workspaceId
          );
          if (bbqLedger && (bbqLedger as any).note) {
            const noteMatch = ((bbqLedger as any).note as string).match(/(\d{4}-\d{2}-\d{2})/);
            if (noteMatch) {
              g.date = new Date(noteMatch[1]);
            }
          }
        } else {
          g.date = gi?.date;
          g.title = gi?.title ?? "Jogo";
        }

        g.totalCents = Number.isFinite(totalLines) ? totalLines : 0;
        g.lines = Array.isArray(lines) ? lines : [];
      }
    }

    for (const [id, ws] of map) {
      const inf = wsInfo.get(id);
      ws.workspaceName = inf?.name;
      ws.workspaceSlug = inf?.slug;
    }

    const result: FormattedWorkspace[] = Array.from(map.values()).map(ws => ({
      workspaceName: ws.workspaceName,
      workspaceSlug: ws.workspaceSlug,
      balanceCents: ws.balanceCents,
      games: ws.games.map(g => ({
        date: g.date,
        title: g.title,
        totalCents: g.totalCents ?? 0,
        lines: g.lines ?? [],
      })),
    }));

    return result;
  }

  async getDebtsSummary(workspace: WorkspaceDoc, user: IUser) {
    const balanceCents = await this.ledgerRepo.getUserBalance(
      workspace._id.toString(),
      user._id.toString()
    );

    const games = await this.gameRepo.findUnpaidGamesForUser(
      workspace._id,
      user._id,
      50
    );

    const debts = games.filter(w => w.status === "open" || w.status === "closed").map(g => {
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
          isOutfield(p, goalieSlots) &&
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

    // Add BBQ debts from ledger
    const bbqLedgers = await this.ledgerRepo.findBBQDebtsByUser(
      workspace._id.toString(),
      user._id.toString()
    );

    for (const bbqL of bbqLedgers) {
      let date = bbqL.createdAt || new Date();
      // Try to extract date from note (format: "Debito de churrasco - YYYY-MM-DD - UserName")
      if (bbqL.note) {
        const noteMatch = bbqL.note.match(/(\d{4}-\d{2}-\d{2})/);
        if (noteMatch) {
          date = new Date(noteMatch[1]);
        }
      }

      debts.push({
        gameId: null,
        date,
        title: "🍖 Churrasco",
        own: [{ type: "your place" as const, slot: undefined }],
        guests: [],
        priceCents: bbqL.amountCents || 0,
      });
    }

    // Sort debts by date (most recent first)
    debts.sort((a, b) => b.date.getTime() - a.date.getTime());

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

      // Check if this is a BBQ debt (title starts with 🍖)
      const isBBQ = g.title?.startsWith("🍖");

      if (isBBQ) {
        // BBQ debts don't have slots
        linhas.push(`\n*${data}* — ${g.title}\n- Churrasco — ${valor}`);
      } else {
        // Game debts with slots
        const ownStr = g.own.map((o: OwnDebts) => `- Vaga própria (slot ${o.slot ?? "?"}) — ${valor}`).join("\n");
        const guestStr = g.guests.map((gu: GuestDebts) => `- Convidado ${gu.name ?? ""} (slot ${gu.slot ?? "?"}) — ${valor}`).join("\n");
        const bloco = [ownStr, guestStr].filter(Boolean).join("\n");

        linhas.push(`\n*${data}* — ${g.title}\n${bloco}`);
      }
    }

    linhas.push(`\nℹ️ Goleiros não geram débito.`);
    return linhas.join("\n");
  }

  formatUserDebtsGroupedMessage(groups: UserDebtByWorkspace[]) {
    const out: string[] = [];
    if (!groups || groups.length === 0) {
      out.push("✅ Você não possui pendências em nenhum workspace.");
      return out.join("\n");
    }

    for (const ws of groups) {
      out.push(`\n🏟️ ${ws.workspaceName ?? "Workspace"} (${ws.workspaceSlug ?? ws.workspaceId})`);
      out.push(`Saldo: ${Utils.formatCentsToReal(ws.balanceCents)}`);

      const rows: string[] = [];
      for (const g of ws.games) {
        const net = (g.debitsCents ?? 0) - (g.creditsCents ?? 0);
        if (net <= 0) continue;
        const data = g.date ? `${String(new Date(g.date).getDate()).padStart(2, "0")}/${String(new Date(g.date).getMonth() + 1).padStart(2, "0")}` : "—";
        const title = g.title ?? "Jogo";
        rows.push(`- ${data} — ${title}: ${Utils.formatCentsToReal(net)}`);
      }

      if (rows.length === 0) {
        out.push("Sem pendências de jogos aqui.");
      } else {
        out.push("Pendências por jogo:");
        out.push(...rows);
      }
    }

    return out.join("\n");
  }

  formatWorkspaceBlock(ws: {
    workspaceName?: string;
    workspaceSlug?: string;
    balanceCents: number;
    games: Array<{
      date?: Date;
      title?: string;
      totalCents: number;
      lines: { label: string; amountCents: number }[];
    }>;
  }): string {
    const out: string[] = [];
    const title = `🏟️ ${ws.workspaceName ?? "Workspace"}${ws.workspaceSlug ? ` (${ws.workspaceSlug})` : ""}`;
    out.push(title);
    out.push(`Saldo: ${Utils.formatCentsToReal(ws.balanceCents)}`);
    const pending = ws.games.filter(g => g.totalCents > 0);
    if (pending.length === 0) {
      out.push("");
      out.push("Sem pendências de jogos aqui");
      return out.join("\n");
    }
    out.push("");
    out.push("Pendências por jogo");
    for (const g of pending) {
      const d = g.date ? new Date(g.date) : undefined;
      const data = d ? `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}` : "—";
      out.push(`— ${data} · ${g.title ?? "Jogo"} · ${Utils.formatCentsToReal(g.totalCents)}`);
      const lefts = g.lines.map(l => l.label);
      const maxLen = Math.min(28, Math.max(...lefts.map(s => s.length), 0) || 0);
      for (const line of g.lines) {
        const left = this.padDots(line.label, 30);
        out.push(`   • ${left}${Utils.formatCentsToReal(line.amountCents)}`);
      }
      out.push("");
    }
    return out.join("\n").trim();
  }

  formatUserDebtsDetailedMessage(groups: Array<{
    workspaceName?: string;
    workspaceSlug?: string;
    balanceCents: number;
    games: Array<{ date?: Date; title?: string; totalCents: number; lines: { label: string; amountCents: number }[] }>;
  }>): string {
    if (!groups || groups.length === 0) return "✅ Você não possui pendências em nenhum workspace.";
    const blocks = groups.map(ws => this.formatWorkspaceBlock(ws));
    return blocks.join("\n\n");
  }

  async getWorkspaceReceivablesCents(workspaceId: string): Promise<{
    totalCents: number;
    games: Array<{ gameId: string; date: Date; title: string; receivableCents: number }>;
  }> {
    const games = await (this.gameRepo as any).model
      ?.find({ workspaceId: new Types.ObjectId(workspaceId), status: { $in: ["open", "closed"] } })
      .select({ _id: 1, date: 1, title: 1, priceCents: 1, roster: 1 })
      .lean();

    let total = 0;
    const items: Array<{ gameId: string; date: Date; title: string; receivableCents: number }> = [];

    for (const g of games ?? []) {
      const roster = g.roster ?? {};
      const goalieSlots = Math.max(0, roster.goalieSlots ?? 2);
      const players = Array.isArray(roster.players) ? roster.players : [];

      const priceCents = g.priceCents ?? this.configService.organizze.valorJogo;

      const unpaidOutfield = players.filter((p: any) => (p.slot ?? 0) > goalieSlots && !p.paid);
      const receivable = unpaidOutfield.length * priceCents;

      if (receivable > 0) {
        total += receivable;
        items.push({
          gameId: g._id.toString(),
          date: g.date,
          title: g.title ?? "Jogo",
          receivableCents: receivable,
        });
      }
    }

    const bbqDebts = await this.ledgerRepo.findPendingBBQDebtsByWorkspace(workspaceId);

    const bbqByDate = new Map<string, { date: Date; total: number }>();

    for (const bbq of bbqDebts) {
      const amount = bbq.amountCents || 0;

      let date = bbq.createdAt || new Date();
      if (bbq.note) {
        const noteMatch = bbq.note.match(/(\d{4}-\d{2}-\d{2})/);
        if (noteMatch) {
          date = new Date(noteMatch[1]);
        }
      }

      const dateKey = date.toISOString().split('T')[0];

      if (bbqByDate.has(dateKey)) {
        bbqByDate.get(dateKey)!.total += amount;
      } else {
        bbqByDate.set(dateKey, { date, total: amount });
      }
    }

    for (const { date, total: amount } of bbqByDate.values()) {
      total += amount;
      items.push({
        gameId: null as any,
        date,
        title: "🍖 Churrasco",
        receivableCents: amount,
      });
    }

    return { totalCents: total, games: items };
  }

  private padDots(left: string, width = 24): string {
    const clean = (left ?? "").trim();
    const dots = Math.max(1, width - clean.length);
    return clean + " " + ".".repeat(dots) + " ";
  }

  private mapToGameResponse(game: IGame): GameResponseDto {
    return {
      id: game._id.toString(),
      name: game.title ?? '',
      date: game.date.toISOString().split('T')[0],
      time: game.date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }),
      location: game.location,
      maxPlayers: game.maxPlayers ?? 16,
      currentPlayers: game.roster.players.length,
      pricePerPlayer: game.priceCents,
      status: game.status as any,
      createdAt: game.createdAt?.toISOString() || new Date().toISOString(),
      workspaceId: game.workspaceId?.toString(),
    };
  }

  /**
   * Obtém estatísticas gerais de jogos
   */
  async getStats(): Promise<any> {
    const now = new Date();
    const next7Days = new Date();
    next7Days.setDate(now.getDate() + 7);

    const [stats] = await this.gameModel.aggregate([
      {
        $facet: {
          total: [{ $count: 'count' }],
          open: [{ $match: { status: 'open' } }, { $count: 'count' }],
          closed: [{ $match: { status: 'closed' } }, { $count: 'count' }],
          finished: [{ $match: { status: 'finished' } }, { $count: 'count' }],
          cancelled: [{ $match: { status: 'cancelled' } }, { $count: 'count' }],
          upcoming: [
            {
              $match: {
                date: { $gte: now, $lte: next7Days },
                status: { $in: ['open'] }
              }
            },
            { $count: 'count' }
          ]
        }
      }
    ]);

    const activePlayers = await this.userModel.countDocuments({ status: 'active' });

    return {
      total: stats.total[0]?.count || 0,
      open: stats.open[0]?.count || 0,
      closed: stats.closed[0]?.count || 0,
      finished: stats.finished[0]?.count || 0,
      cancelled: stats.cancelled[0]?.count || 0,
      upcoming: stats.upcoming[0]?.count || 0,
      activePlayers,
    };
  }

  /**
   * Atualiza o status de um jogo
   */
  async updateStatus(gameId: string, status: string): Promise<GameResponseDto> {
    const game = await this.gameModel.findById(gameId).exec();
    if (!game) {
      throw new ApiError(404, 'Game not found');
    }

    const validStatuses = ['open', 'closed', 'finished', 'cancelled'];
    if (!validStatuses.includes(status)) {
      throw new ApiError(400, `Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    game.status = status as any;
    await game.save();

    return this.mapToGameResponse(game);
  }
}
