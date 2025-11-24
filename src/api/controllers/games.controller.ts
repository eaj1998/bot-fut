import { Request, Response } from 'express';
import { injectable } from 'tsyringe';
import { GameService } from '../../services/game.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { CreateGameDto, UpdateGameDto, AddPlayerToGameDto, MarkPaymentDto, GameFilterDto, GameStatus } from '../dto/game.dto';

@injectable()
export class GamesController {
  constructor(
    private gameService: GameService,
  ) { }

  listGames = asyncHandler(async (req: Request, res: Response) => {
    const filters: GameFilterDto = {
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

  getGameDetail = asyncHandler(async (req: Request, res: Response) => {
    const { gameId } = req.params;
    const gameDetail = await this.gameService.getGameDetail(gameId);

    res.json({
      success: true,
      data: gameDetail,
    });
  });

  createGame = asyncHandler(async (req: AuthRequest, res: Response) => {
    const dto: CreateGameDto = req.body;
    const game = await this.gameService.createGame(dto, req.user!.phone);

    res.status(201).json({
      success: true,
      data: game,
      message: 'Game created successfully',
    });
  });

  updateGame = asyncHandler(async (req: Request, res: Response) => {
    const { gameId } = req.params;
    const dto: UpdateGameDto = req.body;

    const game = await this.gameService.updateGame(gameId, dto);

    res.json({
      success: true,
      data: game,
      message: 'Game updated successfully',
    });
  });

  closeGame = asyncHandler(async (req: Request, res: Response) => {
    const { gameId } = req.params;
    const game = await this.gameService.closeGame(gameId);

    res.json({
      success: true,
      data: game,
      message: 'Game closed successfully',
    });
  });

  cancelGame = asyncHandler(async (req: Request, res: Response) => {
    const { gameId } = req.params;
    await this.gameService.cancelGame(gameId);

    res.json({
      success: true,
      message: 'Game cancelled successfully',
    });
  });

  addPlayer = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { gameId } = req.params;
    const dto: AddPlayerToGameDto = req.body;

    await this.gameService.addPlayer(gameId, dto);

    res.status(201).json({
      success: true,
      message: 'Player added to game',
    });
  });

  removePlayer = asyncHandler(async (req: Request, res: Response) => {
    const { gameId, playerId } = req.params;

    await this.gameService.removePlayer(gameId, playerId);

    res.json({
      success: true,
      message: 'Player removed from game',
    });
  });

  markPayment = asyncHandler(async (req: Request, res: Response) => {
    const { gameId, playerId } = req.params;
    const { isPaid }: MarkPaymentDto = req.body;

    await this.gameService.markPayment(gameId, playerId, isPaid);

    res.json({
      success: true,
      message: `Payment ${isPaid ? 'marked' : 'unmarked'}`,
    });
  });

  sendReminder = asyncHandler(async (req: Request, res: Response) => {
    const { gameId } = req.params;

    await this.gameService.sendReminder(gameId);

    res.json({
      success: true,
      message: 'Reminder sent to all players',
    });
  });

  exportCSV = asyncHandler(async (req: Request, res: Response) => {
    const { gameId } = req.params;
    const gameDetail = await this.gameService.getGameDetail(gameId);

    // Generate CSV
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

  getStats = asyncHandler(async (req: Request, res: Response) => {
    const stats = await this.gameService.getStats();

    res.json({
      success: true,
      data: stats,
    });
  });

  updateStatus = asyncHandler(async (req: Request, res: Response) => {
    const { gameId } = req.params;
    const { status } = req.body;

    const game = await this.gameService.updateStatus(gameId, status);

    res.json({
      success: true,
      data: game,
      message: 'Game status updated successfully',
    });
  });

  deleteGame = asyncHandler(async (req: Request, res: Response) => {
    const { gameId } = req.params;

    await this.gameService.cancelGame(gameId);

    res.json({
      success: true,
      message: 'Game cancelled successfully',
    });
  });
}
