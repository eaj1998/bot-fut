import { Request, Response } from 'express';
import { injectable } from 'tsyringe';
import { GameService } from '../../services/game.service';
import { UserService } from '../../services/user.service';
import { TeamBalancerService } from '../../services/team-balancer.service';
import { WorkspaceMemberRepository } from '../../core/repositories/workspace-member.repository';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler, ApiError } from '../middleware/error.middleware';
import { CreateGameDto, UpdateGameDto, AddPlayerToGameDto, MarkPaymentDto, GameFilterDto, GameStatus } from '../dto/game.dto';

@injectable()
export class GamesController {
  constructor(
    private gameService: GameService,
    private userService: UserService,
    private teamBalancer: TeamBalancerService,
    private workspaceMemberRepo: WorkspaceMemberRepository
  ) { }

  listGames = asyncHandler(async (req: AuthRequest, res: Response) => {
    const filters: GameFilterDto & { workspaceId: string } = {
      workspaceId: req.workspaceId!,
      status: req.query.status as GameStatus,
      search: req.query.search as string,
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
    };

    const result = await this.gameService.listGames(filters);

    res.json({
      success: true,
      data: result.games,
      pagination: {
        page: result.page,
        limit: filters.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  });

  getGameDetail = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { gameId } = req.params;
    const gameDetail = await this.gameService.getGameDetail(gameId as string, req.workspaceId!);

    res.json({
      success: true,
      data: gameDetail,
    });
  });

  createGame = asyncHandler(async (req: AuthRequest, res: Response) => {
    const dto: CreateGameDto = req.body;
    dto.workspaceId = req.workspaceId!; // Enforce workspace context
    const game = await this.gameService.createGame(dto, req.user!.phone);

    res.status(201).json({
      success: true,
      data: game,
      message: 'Game created successfully',
    });
  });

  updateGame = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { gameId } = req.params;
    const dto: UpdateGameDto = req.body;

    const game = await this.gameService.updateGame(gameId as string, req.workspaceId!, dto);

    res.json({
      success: true,
      data: game,
      message: 'Game updated successfully',
    });
  });

  closeGame = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { gameId } = req.params;
    const game = await this.gameService.closeGame(gameId as string, req.workspaceId!);

    res.json({
      success: true,
      data: game,
      message: 'Game closed successfully',
    });
  });

  cancelGame = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { gameId } = req.params;
    await this.gameService.cancelGame(gameId as string, req.workspaceId!);

    res.json({
      success: true,
      message: 'Game cancelled successfully',
    });
  });

  addPlayer = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { gameId } = req.params;
    const dto: AddPlayerToGameDto = req.body;

    await this.gameService.addPlayer(gameId as string, req.workspaceId!, dto);

    res.status(201).json({
      success: true,
      message: 'Player added to game',
    });
  });

  removePlayer = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { gameId, playerId } = req.params;

    // Legacy support for DELETE /:gameId/players/:playerId
    await this.gameService.removePlayer(gameId as string, req.workspaceId!, playerId as string);

    res.json({
      success: true,
      message: 'Player removed from game',
    });
  });

  removePlayerFromBody = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { gameId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      res.status(400);
      throw new Error("userId is required");
    }

    await this.gameService.removePlayer(gameId as string, req.workspaceId!, userId as string);

    res.json({ success: true, message: 'Player removed from game' });
  });

  removeGuest = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { gameId } = req.params;
    const { slot } = req.body;

    if (slot === undefined) {
      res.status(400);
      throw new Error("slot is required");
    }

    await this.gameService.removeGuest(gameId as string, req.workspaceId!, parseInt(slot, 10));

    res.json({
      success: true,
      message: 'Guest removed from game',
    });
  });

  markPayment = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { gameId } = req.params;
    const slot = parseInt(req.params.slot as string, 10);
    const { isPaid }: MarkPaymentDto = req.body;

    await this.gameService.markPayment(gameId as string, req.workspaceId!, slot, isPaid);

    res.json({
      success: true,
      message: `Pagamento ${isPaid ? 'marcado' : 'desmarcado'} com sucesso`,
    });
  });

  sendReminder = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { gameId } = req.params;

    await this.gameService.sendReminder(gameId as string, req.workspaceId!);

    res.json({
      success: true,
      message: 'Reminder sent to all players',
    });
  });

  exportCSV = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { gameId } = req.params;
    const gameDetail = await this.gameService.getGameDetail(gameId as string, req.workspaceId!);

    const csv = this.generateCSV(gameDetail);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="game-${gameId}.csv"`);
    res.send(csv);
  });

  private generateCSV(gameDetail: any): string {
    const rows = [
      ['Nome', 'Telefone', 'Tipo', 'Pago', 'Entrada'],
      ...gameDetail.players.map((p: any) => [
        p.name,
        p.phone,
        p.isPaid ? 'Sim' : 'Não',
      ]),
    ];

    return rows.map((row) => row.join(',')).join('\n');
  }

  getStats = asyncHandler(async (req: AuthRequest, res: Response) => {
    const stats = await this.gameService.getStats(req.workspaceId!);

    res.json({
      success: true,
      data: stats,
    });
  });

  updateStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { gameId } = req.params;
    const { status } = req.body;

    const game = await this.gameService.updateStatus(gameId as string, req.workspaceId!, status);

    res.json({
      success: true,
      data: game,
      message: 'Game status updated successfully',
    });
  });

  deleteGame = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { gameId } = req.params;

    await this.gameService.cancelGame(gameId as string, req.workspaceId!);

    res.json({
      success: true,
      message: 'Game cancelled successfully',
    });
  });

  generateTeams = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { gameId } = req.params;
    const game = await this.gameService.getGameById(gameId as string, req.workspaceId!);

    if (!game) {
      throw new ApiError(404, 'Game not found');
    }

    // 1. Get all user IDs to fetch real users
    const userIds = game.roster.players
      .map(p => p.userId?.toString())
      .filter((id): id is string => !!id);

    const usersMap = new Map<string, any>();
    const memberRatingsMap = new Map<string, number>();

    if (userIds.length > 0) {
      const users = await this.userService.findUsersByIds(userIds);
      users.forEach(u => usersMap.set(u._id.toString(), u));

      const members = await this.workspaceMemberRepo.findByWorkspaceAndUsers(req.workspaceId!, userIds);
      members.forEach(m => memberRatingsMap.set(m.userId.toString(), m.rating ?? 3.0));
    }

    // 2. Map ALL roster players to IUser-like structure for the balancer
    const playersForBalancer: any[] = game.roster.players.map(player => {
      // Use Roster ID as the unique identifier
      const rosterId = player._id?.toString();

      // Logic to enforce Goalkeeper position if in goalie slot
      const goalieSlots = game.roster.goalieSlots ?? 2;
      const isGoalkeeperSlot = (player.slot ?? 0) <= goalieSlots && (player.slot ?? 0) > 0;

      // If registered user
      if (player.userId && usersMap.has(player.userId.toString())) {
        const user = usersMap.get(player.userId.toString());
        // CLONE user to avoid mutating the original cached object if any
        // OVERRIDE _id with rosterId to match frontend keys
        const clonedUser = {
          ...user,
          _id: rosterId,
          name: player.name || user.name, // Prefer roster name if available? Or user name? Roster name usually snapshot.
          workspaceRating: memberRatingsMap.get(player.userId.toString()) ?? 3.0
        };

        // Enforce GOL position
        if (isGoalkeeperSlot && clonedUser.profile) {
          clonedUser.profile = {
            ...clonedUser.profile,
            mainPosition: 'GOL'
          };
        }

        return clonedUser;
      }

      // If guest (or user not found)
      return {
        _id: rosterId,
        name: player.name,
        phoneE164: player.phoneE164,
        roles: ['guest'],
        workspaceRating: 3.0,
        profile: {
          mainPosition: isGoalkeeperSlot ? 'GOL' : 'MEI',
          rating: 3.0,
          guest: true
        }
      };
    });

    const result = this.teamBalancer.balanceTeams(playersForBalancer);

    res.json({
      success: true,
      data: result
    });
  });

  saveTeamAssignments = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { gameId } = req.params;
    const { assignments } = req.body;

    if (!assignments || !Array.isArray(assignments)) {
      throw new ApiError(400, 'Invalid assignments format');
    }

    await this.gameService.saveTeamAssignments(gameId as string, req.workspaceId!, assignments);

    res.json({
      success: true,
      message: 'Team assignments saved successfully'
    });
  });
}
