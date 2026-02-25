import { injectable, inject } from 'tsyringe';
import { Model, Types } from 'mongoose';
import { GAME_MODEL_TOKEN, IGame } from '../core/models/game.model';
import { USER_MODEL_TOKEN, IUser } from '../core/models/user.model';
import { GameDetailResponseDto, GameResponseDto, PlayerInGameDto, WaitlistPlayerDto, OutlistPlayerDto, AddPlayerToGameDto, UpdateGameDto } from '../api/dto/game.dto';
import { ApiError } from '../api/middleware/error.middleware';

import { WhatsAppService } from './whatsapp.service';

import { GameRepository } from '../core/repositories/game.respository';

import { TransactionRepository, TRANSACTION_REPOSITORY_TOKEN } from '../core/repositories/transaction.repository';
import { MembershipRepository, MEMBERSHIP_REPOSITORY_TOKEN } from '../core/repositories/membership.repository';
import { TransactionType, TransactionCategory, TransactionStatus } from '../core/models/transaction.model';
import { MembershipStatus } from '../core/models/membership.model';
import { ConfigService } from '../config/config.service';
import { LoggerService } from '../logger/logger.service';

import { WorkspaceRepository } from '../core/repositories/workspace.repository';
import { ChatModel } from '../core/models/chat.model';
import { WorkspaceDoc } from '../core/models/workspace.model';
import Utils from '../utils/utils';
import { getNextWeekday, applyTime, formatHorario, todayISOyyyy_mm_dd, formatDateBR, getNowInSPAsUTC } from '../utils/date';
import { isOutfield } from '../utils/lineup';
import axios from 'axios';
import { GameModel, GameRoster, GamePlayer } from '../core/models/game.model';
import { Message } from 'whatsapp-web.js';

type ClosePlayerResult = {
  success: boolean;
  playerName: string;
  ledger: boolean;
  organizze: boolean;
  isMember?: boolean;
  transactionId?: string;
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

    @inject(TRANSACTION_REPOSITORY_TOKEN) private readonly transactionRepo: TransactionRepository,
    @inject(MEMBERSHIP_REPOSITORY_TOKEN) private readonly membershipRepo: MembershipRepository,
    @inject(ConfigService) private readonly configService: ConfigService,
    @inject(LoggerService) private readonly loggerService: LoggerService,

    @inject(WorkspaceRepository) private readonly workspaceRepo: WorkspaceRepository,
  ) {

    this.loggerService.setName('[GAME-SERVICE]');
  }

  async listGames(filters: {
    workspaceId: string;
    status?: string;
    type?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ games: GameResponseDto[]; total: number; page: number; totalPages: number }> {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const query: any = { workspaceId: filters.workspaceId };
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

  async getGameById(gameId: string, workspaceId: string): Promise<IGame | null> {
    return this.gameModel.findOne({ _id: gameId, workspaceId }).exec();
  }

  async getGameDetail(gameId: string, workspaceId: string): Promise<GameDetailResponseDto> {
    const game = await this.gameModel.findOne({ _id: gameId, workspaceId }).exec();
    if (!game) {
      throw new ApiError(404, 'Game not found');
    }

    const players: PlayerInGameDto[] = [];
    const waitlist: WaitlistPlayerDto[] = [];
    const outlist: OutlistPlayerDto[] = [];

    const activeMembers = await this.membershipRepo.findActiveMemberships(game.workspaceId.toString());
    const activeMemberIds = new Set(activeMembers.map(m => m.userId?._id?.toString() || m.userId?.toString()));

    // 1. Coletar IDs de usuários para buscar em lote (evitar N+1)
    const userIdsToFetch = new Set<string>();

    // Players (Main Roster)
    game.roster.players.forEach(p => {
      if (p.userId) userIdsToFetch.add(p.userId.toString());
      if (p.invitedByUserId) userIdsToFetch.add(p.invitedByUserId.toString());
    });

    const usersMap = new Map<string, IUser>();
    if (userIdsToFetch.size > 0) {
      const users = await this.userModel.find({ _id: { $in: Array.from(userIdsToFetch) } }).exec();
      users.forEach(u => usersMap.set(u._id.toString(), u));
    }

    let billingPlayersCount = 0;
    let paidBillingPlayersCount = 0;

    for (const player of game.roster.players) {
      const goalieSlots = game.roster.goalieSlots ?? 2;
      const isGoalkeeper = (player.slot ?? 0) <= goalieSlots && (player.slot ?? 0) > 0;

      let profileData = {
        mainPosition: 'MEI',
        rating: 3.0,
        guest: true,
        secondaryPositions: [] as string[]
      };

      if (player.userId) {
        const user = usersMap.get(player.userId.toString());
        if (user && user.profile) {
          profileData = {
            mainPosition: user.profile.mainPosition,
            rating: user.profile.rating,
            guest: false, // É usuário cadastrado
            secondaryPositions: user.profile.secondaryPositions || []
          };
        } else {
          profileData.guest = false;
        }
      }

      const playerDto: PlayerInGameDto = {
        id: player._id?.toString() || '',
        name: player.name,
        phone: player.phoneE164,
        slot: player.slot,
        isGoalkeeper,
        isPaid: player.paid || false,
        guest: player.guest || false,
        team: player.team,
        profile: profileData
      };

      players.push(playerDto);

      // Contagem financeira
      if (!isGoalkeeper) {
        const userId = player.userId?.toString() || player.invitedByUserId?.toString();
        const isGuest = !!player.guest;
        const isMember = userId && activeMemberIds.has(userId) && !isGuest;

        if (!isMember) {
          billingPlayersCount++;
          if (player.paid) paidBillingPlayersCount++;
        }
      }
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

    const totalToReceive = billingPlayersCount * game.priceCents;
    const totalPaid = paidBillingPlayersCount * game.priceCents;
    const totalPending = totalToReceive - totalPaid;

    return {
      ...this.mapToGameResponse(game),
      players,
      waitlist,
      outlist,
      financialSummary: {
        totalToReceive,
        totalPaid,
        totalPending,
        paidCount: paidBillingPlayersCount,
        unpaidCount: billingPlayersCount - paidBillingPlayersCount,
      },
    };
  }

  async findGameByDate(date: Date): Promise<IGame | null> {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);

    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    return this.gameModel.findOne({
      date: {
        $gte: start,
        $lte: end,
      },
      status: { $in: ['closed', 'finished'] },
    }).exec();
  }

  async createGame(data: any, createdByPhone: string): Promise<GameResponseDto> {
    const creator = await this.userModel.findOne({ phoneE164: createdByPhone }).exec();
    if (!creator) {
      throw new ApiError(404, 'User not found');
    }

    const game = await this.gameModel.create({
      title: data.name,
      gameType: data.type,
      date: new Date(data.date + 'T' + data.time + ':00.000Z'),
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

  async cancelGame(gameId: string, workspaceId: string): Promise<void> {
    const game = await this.gameModel.findOne({ _id: gameId, workspaceId }).exec();
    if (!game) {
      throw new ApiError(404, 'Game not found');
    }

    game.status = "cancelled";
    await this.gameRepo.save(game);

    try {
      const sent = await this.whatsappService.sendMessage(game.chatId, "Jogo Cancelado!");
      this.loggerService.info(`pinned message: ${sent}`);
      if (sent && sent.pin) {
        await sent.pin(86400); // 24 horas
      }
    } catch (error) {
      this.loggerService.error(`Failed to send/pin cancellation message to group ${game.chatId}`, error);
    }
  }

  async closeGame(gameId: string, workspaceId: string): Promise<GameResponseDto> {
    const game = await this.gameModel.findOne({ _id: gameId, workspaceId }).exec();
    if (!game) {
      throw new ApiError(404, 'Game not found');
    }

    await this.closeGameInternal(game);

    return this.mapToGameResponse(game);
  }

  /**
   * Mensalistas ACTIVE não são cobrados (já pagam mensalidade)
   * Registra despesas automáticas (quadra, árbitro)
   */
  async closeGameInternal(game: IGame): Promise<CloseGameResult> {
    const session = await this.gameModel.db.startSession();

    try {
      return await session.withTransaction(async () => {
        const amountCents = game.priceCents ?? this.configService.organizze.valorJogo;
        const goalieSlots = Math.max(0, game.roster.goalieSlots ?? 2);
        const workspace = await this.workspaceRepo.findById(game.workspaceId.toString());

        // Processar cada jogador (exceto goleiros)
        const tasks = game.roster.players
          .filter(p => (p.slot ?? 0) > goalieSlots)
          .map(async (player): Promise<ClosePlayerResult> => {
            const playerName = player.name;

            try {
              const targetUserId = player.guest
                ? player.invitedByUserId?.toString()
                : player.userId?.toString();

              console.log("Target user id", targetUserId);
              if (!targetUserId) {
                return {
                  success: false,
                  playerName,
                  ledger: false,
                  organizze: false,
                  error: player.guest ? "Convidado sem invitedByUserId" : "Jogador sem userId"
                };
              }

              const membership = await this.membershipRepo.findByUserId(
                targetUserId,
                game.workspaceId.toString()
              );

              if (membership && membership.status === MembershipStatus.ACTIVE && !player.guest) {
                return {
                  success: true,
                  playerName,
                  ledger: false,
                  organizze: false,
                  isMember: true,
                };
              }

              let transactionId: string | undefined;
              let ledgerOk = false;

              const finalAmount = amountCents;

              if (finalAmount > 0) {
                const isPaid = player.paid || false;
                const transaction = await this.transactionRepo.createTransaction({
                  workspaceId: game.workspaceId.toString(),
                  userId: targetUserId,
                  gameId: game._id.toString(),
                  type: TransactionType.INCOME,
                  category: TransactionCategory.GAME_FEE,
                  status: isPaid ? TransactionStatus.COMPLETED : TransactionStatus.PENDING,
                  amount: finalAmount,
                  dueDate: game.date,
                  paidAt: isPaid ? new Date() : undefined,
                  description: player.guest
                    ? `Jogo ${game.title} - ${formatDateBR(game.date)} (convidado: ${player.name})`
                    : `Jogo ${game.title} - ${formatDateBR(game.date)} - ${player.name}`,
                  method: isPaid ? 'dinheiro' : 'pix',
                });

                transactionId = transaction._id.toString();
                ledgerOk = true;
              }

              return {
                success: ledgerOk,
                playerName,
                ledger: ledgerOk,
                organizze: false,
                transactionId,
                isMember: false,
              };
            } catch (err: any) {
              console.log("Error", err);

              return {
                success: false,
                playerName,
                ledger: false,
                organizze: false,
                error: err?.message ?? String(err)
              };
            }
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
          await game.save({ session });
        }

        return { added: true, results };
      });
    } catch (error) {
      this.loggerService.error('Erro ao fechar jogo', { gameId: game._id, error });
      throw error;
    } finally {
      session.endSession();
    }
  }

  async addPlayer(gameId: string, workspaceId: string, data: AddPlayerToGameDto): Promise<void> {
    const game = await this.gameModel.findOne({ _id: gameId, workspaceId }).exec();
    if (!game) {
      throw new ApiError(404, 'Jogo não encontrado');
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

    const membership = await this.membershipRepo.findByUserId(
      user._id.toString(),
      game.workspaceId.toString()
    );

    const gameDate = new Date(game.date);
    gameDate.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const workspace = await this.workspaceRepo.findById(game.workspaceId.toString());
    const enableMemberPriority = workspace?.settings?.enableMemberPriority ?? false;

    const isFutureGame = gameDate > today;
    const isActiveMember = membership?.status === MembershipStatus.ACTIVE;
    const isSuspended = membership?.status === MembershipStatus.SUSPENDED;

    if (isSuspended) {
      throw new ApiError(
        403,
        '🚫 Ação bloqueada. Sua mensalidade está suspensa! Regularize para jogar.'
      );
    }

    if (enableMemberPriority && isFutureGame && !isActiveMember && !game.allowCasualsEarly) {
      throw new ApiError(
        403,
        '🔒 Apenas mensalistas podem entrar na lista antecipadamente. Avulsos apenas no dia do jogo.'
      );
    }

    if (data.guestName) {
      if (!data.name) {
        throw new ApiError(400, 'Nome de quem convida é obrigatório ao adicionar convidado');
      }

      this.addGuestWithInviter(
        game,
        data.guestName,
        { _id: user._id, name: user.name ?? '' },
        { asGoalie: data.isGoalkeeper || false }
      );

      await game.save();
      return;
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
      await this.addGoalkeeper(game, user, isActiveMember);
    } else {
      await this.addOutfieldPlayer(game, user, game.maxPlayers, isActiveMember);
    }
  }

  async removePlayer(gameId: string, workspaceId: string, playerId: string): Promise<void> {
    const game = await this.gameModel.findOne({ _id: gameId, workspaceId }).exec();
    if (!game) {
      throw new ApiError(404, 'Game not found');
    }

    const cleanPlayerId = (playerId || '').trim();

    const players = game.roster.players ?? [];
    let idx = players.findIndex(p =>
      p.userId?.toString() === cleanPlayerId ||
      p._id?.toString() === cleanPlayerId
    );

    if (idx === -1) {
      const user = await this.userModel.findById(cleanPlayerId).exec();
      if (!user) {
        throw new ApiError(404, 'Player not found in game roster');
      }
      throw new ApiError(404, 'Player not in this game');
    }

    await this.removePlayerAtIndex(game, idx);
  }

  async removeGuest(gameId: string, workspaceId: string, slot: number): Promise<void> {
    const game = await this.gameModel.findOne({ _id: gameId, workspaceId }).exec();
    if (!game) {
      throw new ApiError(404, 'Game not found');
    }

    const players = game.roster.players ?? [];
    const idx = players.findIndex(p => p.slot === slot);

    if (idx === -1) {
      throw new ApiError(404, 'Jogador não encontrado na posição');
    }

    const player = players[idx];

    if (!player.guest) {
      throw new ApiError(400, 'O jogador não é um convidado');
    }


    await this.removePlayerAtIndex(game, idx);
  }

  /**
   * Private centralized method to remove a player by index, handle promotion, and save.
   */
  private async removePlayerAtIndex(game: IGame, index: number): Promise<{ player: GamePlayer, promotedMessage: string, mentions: string[] }> {
    const players = game.roster.players;
    const waitlist = game.roster.waitlist ?? [];
    const goalieSlots = Math.max(0, game.roster?.goalieSlots ?? 2);

    const removed = players[index];
    const removedSlot = removed?.slot ?? 0;

    // Remove
    players.splice(index, 1);

    let promotedMessage = "";
    let mentions: string[] = [];

    if (removedSlot >= goalieSlots + 1 && waitlist.length > 0) {
      const promovido = waitlist.shift()!;

      console.log("Promovido", promovido);
      let isPaid = false;
      const isGuest = (promovido.name ?? "").toLowerCase().includes('(conv.');

      if (promovido.userId && !isGuest) {
        const membership = await this.membershipRepo.findByUserId(
          promovido.userId.toString(),
          game.workspaceId.toString()
        );
        isPaid = membership?.status === MembershipStatus.ACTIVE;
      }
      const promotedPlayer: GamePlayer = {
        slot: removedSlot,
        name: promovido.name ?? "Jogador",
        paid: isPaid,
        ...(isGuest ? { guest: true, invitedByUserId: promovido.userId } : { guest: false, userId: promovido.userId, phoneE164: promovido.phoneE164 })
      };

      players.push(promotedPlayer);

      if (promovido?.phoneE164) {
        const e164 = promovido.phoneE164.replace(/@c\.us$/i, "");
        const jid = `${e164.replace(/\D/g, "")}@c.us`;
        mentions.push(jid);
      }

      const alvo = promovido?.phoneE164
        ? `*@${promovido.phoneE164.replace(/@c\.us$/i, "")}*`
        : `*${promovido?.name ?? "Jogador"}*`;

      promotedMessage = `\n\n📢 Atenção: ${alvo} foi promovido da suplência para a lista principal (slot ${removedSlot})!`;
    }

    game.markModified('roster.players');
    game.markModified('roster.waitlist');

    await game.save();

    return { player: removed, promotedMessage, mentions };
  }

  async addOutfieldPlayer(
    game: IGame,
    user: IUser,
    maxPlayersArg?: number,
    paid = false
  ): Promise<{ added: boolean; suplentePos?: number }> {
    const maxPlayers = maxPlayersArg ?? game.maxPlayers ?? 16;
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
        game.roster.players.push({ userId: user._id, phoneE164: user.phoneE164 || user.lid, slot, name: user.name, paid, organizzeId: null });
        await game.save();
        return { added: true };
      }
    }

    game.roster.waitlist.push({ userId: user._id, phoneE164: user.phoneE164 || user.lid, name: user.name, createdAt: new Date() });
    await game.save();
    return { added: false, suplentePos: game.roster.waitlist.length };
  }

  async addGoalkeeper(game: IGame, user: IUser, paid = false): Promise<{ added: boolean; suplentePos?: number }> {
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
          paid,
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

    const players = Array.isArray(game.roster?.players) ? game.roster.players : [];
    const waitlist = Array.isArray(game.roster?.waitlist) ? game.roster.waitlist : [];

    const nomeTarget = (nomeAutor ?? "").trim().toLowerCase();

    let idxPlayer = players.findIndex(p => (p.name?.trim().toLowerCase() === nomeTarget && p.guest));
    if (idxPlayer <= -1) {
      idxPlayer = players.findIndex(p => (p.userId?._id?.toString() ?? p.userId?.toString() ?? "")
        .toLowerCase()
        .includes(user._id.toString()));
    }

    let mensagemPromocao = "";

    if (idxPlayer > -1) {
      const removed = await this.removePlayerAtIndex(game, idxPlayer);

      let texto = `Ok, ${nomeAutor}, seu nome foi removido da lista.${removed.promotedMessage}`;

      if (removed.player.guest ?? false) { // Use Nullish Coalescing for safety
        texto = `Ok, o convidado: ${removed.player.name}, foi removido da lista.`;
      }
      return { removed: true, message: texto, mentions: removed.mentions };
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

    if (!Array.isArray(game.roster.waitlist)) game.roster.waitlist = [];
    game.roster.waitlist.push({
      userId: inviter._id,
      name: label,
      createdAt: new Date(),
    });

    return { placed: false, finalName: label, role: "outfield" };
  }

  async markPayment(gameId: string, workspaceId: string, slot: number, isPaid: boolean): Promise<void> {
    const game = await this.gameModel.findOne({ _id: gameId, workspaceId }).exec();
    if (!game) {
      throw new ApiError(404, 'Jogo não encontrado');
    }

    const player = game.roster.players.find(p => p.slot === slot);

    if (!player) {
      throw new ApiError(404, 'Jogador não encontrado no slot especificado');
    }

    if (isPaid) {
      await this.markAsPaid(game, slot);
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
      return { updated: false, reason: 'User nao encontrado' };
    }

    const transactions = await this.transactionRepo.find({
      gameId: game._id.toString(),
      userId: userId.toString(),
      status: TransactionStatus.COMPLETED,
      type: TransactionType.INCOME
    });

    let targetTx = null;
    const searchName = player.name;

    if (player.guest) {
      targetTx = transactions.find((t: any) => t.description && t.description.includes(searchName));
    } else {
      targetTx = transactions.find((t: any) => t.description && !t.description.includes('(convidado:'));
    }

    if (targetTx) {
      await this.transactionRepo.updateStatus(targetTx._id.toString(), TransactionStatus.PENDING);
    }

    const isDeleted = true;

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
        return { updated: true, playerName: player.name };
      }
    }

    return { updated: false, reason: 'Houve um problema ao remover o credito do jogador.' };
  }

  async markAsPaid(
    game: IGame,
    slot?: number,
    opts?: { method?: "pix" | "dinheiro" | "transf" | "ajuste" }
  ): Promise<{ updated: boolean; reason?: string; game: IGame | null }> {
    if (typeof slot !== "number") {
      return { updated: false, reason: "Slot inválido", game: null };
    }
    // const game = await this.gameRepo.findById(gameId); // Removed fetch

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
    const finalAmount = amountCents;



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

    const validMethod = (payMethod === 'dinheiro' || payMethod === 'pix' || payMethod === 'transf') ? payMethod : 'pix';

    if (game.status === 'closed' || game.status === 'finished') {
      const transactions = await this.transactionRepo.find({
        gameId: game._id.toString(),
        userId: inviterId,
        status: TransactionStatus.PENDING,
        type: TransactionType.INCOME
      });

      let targetTx = null;
      const searchName = player.name;

      if (player.guest) {
        targetTx = transactions.find(t => t.description && t.description.includes(searchName));
      } else {
        targetTx = transactions.find(t => t.description && !t.description.includes('(convidado:'));
      }

      if (targetTx) {
        await this.transactionRepo.markAsPaid(targetTx._id.toString(), now, validMethod);
      } else if (finalAmount > 0) {
        await this.transactionRepo.createTransaction({
          workspaceId: game.workspaceId.toString(),
          userId: inviterId,
          gameId: game._id.toString(),
          type: TransactionType.INCOME,
          category: TransactionCategory.GAME_FEE,
          status: TransactionStatus.COMPLETED,
          amount: finalAmount,
          dueDate: game.date,
          paidAt: now,
          description: player.guest
            ? `Pagamento Avulso - Jogo ${game.title} (convidado: ${player.name})`
            : `Pagamento Avulso - Jogo ${game.title}`,
          method: validMethod,
        });
      }
    }

    const goalieSlots = Math.max(0, game.roster.goalieSlots ?? 2);
    const allPaidAfter = game.roster.players
      .filter(p => (p.slot ?? 0) > goalieSlots)
      .every(p => !!p.paid);

    if (allPaidAfter && game.status === 'closed') {
      game.status = "finished";
    }

    try {
      await game.save();
    } catch (e: any) {
      return { updated: false, reason: `Falha ao salvar jogo: ${e.message}`, game };
    }

    return { updated: true, game };
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
      return { added: true };
    }

    const { email, apiKey } = organizzeConfig;

    const idx = game.roster.players.findIndex(p => p.slot === slot);

    if (idx === -1) return { added: false };

    const player = game.roster.players[idx];

    if (!player.organizzeId) {
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
      return { added: true };
    }

    const { email, apiKey, accountId, categories } = organizzeConfig;
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

      return { added: false };
    }
  }

  async updateGame(gameId: string, workspaceId: string, dto: UpdateGameDto): Promise<GameResponseDto> {
    const game = await this.gameModel.findOne({ _id: gameId, workspaceId }).exec();
    if (!game) {
      throw new ApiError(404, 'Game not found');
    }

    if (dto.name) game.title = dto.name;
    if (dto.date && dto.time) game.date = new Date(dto.date + 'T' + dto.time);
    if (dto.location) game.location = dto.location;
    if (dto.maxPlayers) game.maxPlayers = dto.maxPlayers;
    if (dto.pricePerPlayer) game.priceCents = dto.pricePerPlayer;
    if (dto.status) game.status = dto.status;
    if (typeof dto.allowCasualsEarly === 'boolean') {
      game.allowCasualsEarly = dto.allowCasualsEarly;
    }

    await this.gameRepo.save(game);
    return this.mapToGameResponse(game);
  }

  /**
   * Save team assignments for players in a game
   */
  async saveTeamAssignments(gameId: string, workspaceId: string, assignments: { rosterId: string; team: 'A' | 'B' }[]): Promise<void> {
    const game = await this.gameModel.findOne({ _id: gameId, workspaceId }).exec();
    if (!game) {
      throw new ApiError(404, 'Game not found');
    }

    // Create a map for quick lookup using roster ID
    const assignmentMap = new Map(assignments.map(a => [a.rosterId, a.team]));

    // Update team assignments for each player
    for (const player of game.roster.players) {
      // Use the subdocument _id as the key
      const rosterId = player._id?.toString();

      if (rosterId && assignmentMap.has(rosterId)) {
        player.team = assignmentMap.get(rosterId);
      } else {
        // Optional: clear team if not in assignment list? 
        // Or keep existing if not specified? 
        // The prompt implies we are saving the state, so maybe we should update everything.
        // But usually we just update what is sent. 
        // Let's assume the frontend sends all assignments.
        // If the player is NOT in the map, maybe we should clear the team?
        // For now, let's just update if present to be safe, or as per user request "if (player) player.team = assignment.team;"
        // The user snippet was:
        // const player = game.roster.find(p => p._id.toString() === assignment.rosterId);
        // if (player) player.team = assignment.team;
      }
    }


    await game.save();
  }


  async sendReminder(gameId: string, workspaceId: string): Promise<void> {
    const game = await this.gameModel.findOne({ _id: gameId, workspaceId }).exec();
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
    const dia = String(d.getUTCDate()).padStart(2, "0");
    const mes = String(d.getUTCMonth() + 1).padStart(2, "0");
    const horario = formatHorario(d);

    const chat = await ChatModel.findOne({ chatId: game.chatId, workspaceId: game.workspaceId });

    const titulo = game?.title;
    const pix = chat?.financials?.pixKey;
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

    let texto = `${titulo}\n${dia}/${mes} às ${horario}\n${pix ? `Pix: ${pix}\n` : ''}${valor ? `Valor: ${valor}\n` : ''}\n\n`;

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
    const priceCents = chat.financials?.defaultPriceCents ?? workspace.settings?.pricePerGameCents ?? 1400;

    const base = getNowInSPAsUTC();
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
        maxPlayers: chat.settings?.maxPlayersPerGame || 16,
      });
    } else {

      if (!game.roster) game.set("roster", { goalieSlots: 2, players: [], waitlist: [] } as any);
      if (!game.roster.players) (game.roster as any).players = [];
      if (!game.roster.waitlist) (game.roster as any).waitlist = [];
      if (game.isModified()) await game.save();
    }

    return { game, priceCents, pix: chat.financials?.pixKey };
  }

  async initListAt(workspace: WorkspaceDoc, targetDate: Date, opts?: { title?: string; priceCents?: number; }) {
    const start = new Date(targetDate); start.setUTCHours(0, 0, 0, 0);
    const end = new Date(targetDate); end.setUTCHours(23, 59, 59, 999);

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
    const transactions = await this.transactionRepo.findByUserId(userId);

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

    const getWs = (wsId: string) => {
      if (!map.has(wsId)) {
        map.set(wsId, { workspaceId: wsId, balanceCents: 0, games: [] });
      }
      return map.get(wsId)!;
    };

    for (const t of transactions) {
      const wsId = t.workspaceId.toString();
      const entry = getWs(wsId);

      if (t.gameId) {
        const gId = t.gameId.toString();
      }
    }

    return [];
  }

  async getDebtsSummary(workspace: WorkspaceDoc, user: IUser) {
    const balanceCents = 0;

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

    const bbqTransactions = await this.transactionRepo.findPendingTransactions(
      workspace._id.toString(),
      {
        category: TransactionCategory.BBQ_REVENUE,
        type: TransactionType.INCOME
      }
    );
    const bbqLedgers = bbqTransactions;

    for (const bbqL of bbqLedgers) {
      let date = bbqL.createdAt || new Date();
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

      const isBBQ = g.title?.startsWith("🍖");

      if (isBBQ) {
        linhas.push(`\n*${data}* — ${g.title}\n- Churrasco — ${valor}`);
      } else {
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

    const bbqDebts = await this.transactionRepo.findPendingTransactions(
      workspaceId,
      {
        category: TransactionCategory.BBQ_REVENUE,
        type: TransactionType.INCOME
      }
    );

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
      date: game.date.toISOString(),
      time: String(game.date.getUTCHours()).padStart(2, "0") + ":" + String(game.date.getUTCMinutes()).padStart(2, "0"),
      location: game.location,
      maxPlayers: game.maxPlayers ?? 16,
      currentPlayers: game.roster.players.length,
      pricePerPlayer: game.priceCents,
      status: game.status as any,
      createdAt: game.createdAt?.toISOString() || new Date().toISOString(),
      workspaceId: game.workspaceId?.toString(),
      players: game.roster?.players?.map(p => ({
        id: (p.userId ?? p.invitedByUserId)?.toString() ?? '',
        name: p.name,
        phone: p.phoneE164,
        slot: p.slot,
        isGoalkeeper: (p.slot ?? 0) <= (game.roster.goalieSlots ?? 2) && (p.slot ?? 0) > 0,
        isPaid: p.paid || false,
        guest: p.guest || false,
      })) || [],
      allowCasualsEarly: game.allowCasualsEarly,
    };
  }

  /**
   * Obtém estatísticas gerais de jogos
   */
  async getStats(workspaceId: string): Promise<any> {
    const total = await this.gameModel.countDocuments({ workspaceId });
    const open = await this.gameModel.countDocuments({ workspaceId, status: 'open' });
    const closed = await this.gameModel.countDocuments({ workspaceId, status: 'closed' });
    const finished = await this.gameModel.countDocuments({ workspaceId, status: 'finished' });
    const cancelled = await this.gameModel.countDocuments({ workspaceId, status: 'cancelled' });

    const now = getNowInSPAsUTC();
    const next7Days = getNowInSPAsUTC();
    next7Days.setUTCDate(now.getUTCDate() + 7);

    const upcoming = await this.gameModel.countDocuments({
      workspaceId,
      date: { $gte: now, $lte: next7Days },
      status: { $in: ['open', 'scheduled'] }
    });

    // Calculate active players (active memberships)
    const activeMembers = await this.membershipRepo.findActiveMemberships(workspaceId);
    const activePlayers = activeMembers.length;

    return {
      total,
      open,
      closed,
      finished,
      cancelled,
      upcoming,
      activePlayers
    };
  }

  /**
   * Atualiza o status de um jogo
   */
  async updateStatus(gameId: string, workspaceId: string, status: string): Promise<GameResponseDto> {
    const game = await this.gameModel.findOne({ _id: gameId, workspaceId }).exec();
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
