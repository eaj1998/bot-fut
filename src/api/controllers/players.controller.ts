import { Request, Response, NextFunction } from 'express';
import { injectable, inject } from 'tsyringe';
import { PlayersService, PLAYERS_SERVICE_TOKEN } from '../../services/players.service';
import { CreatePlayerDto, UpdatePlayerDto, ListPlayersDto } from '../dto/player.dto';
import { ApiError } from '../middleware/error.middleware';

@injectable()
export class PlayersController {
    constructor(
        @inject(PLAYERS_SERVICE_TOKEN) private readonly playersService: PlayersService
    ) { }

    listPlayers = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const filters: ListPlayersDto = {
                status: req.query.status as any,
                search: req.query.search as string,
                page: parseInt(req.query.page as string) || 1,
                limit: parseInt(req.query.limit as string) || 20,
                sortBy: req.query.sortBy as any,
                sortOrder: req.query.sortOrder as any,
            };

            const result = await this.playersService.listPlayers(filters);
            res.json(result);
        } catch (error) {
            next(error);
        }
    };

    getPlayerById = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            const player = await this.playersService.getPlayerById(id);
            res.json(player);
        } catch (error) {
            if (error instanceof Error && error.message === 'Jogador não encontrado') {
                next(new ApiError(404, error.message));
            } else {
                next(error);
            }
        }
    };

    createPlayer = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const data: CreatePlayerDto = req.body;

            // WorkspaceId deve vir no body do request
            if (!data.workspaceId) {
                return next(new ApiError(400, 'Workspace ID é obrigatório'));
            }

            const player = await this.playersService.createPlayer(data);
            res.status(201).json(player);
        } catch (error) {
            if (error instanceof Error) {
                if (error.message.includes('Já existe') || error.message.includes('já cadastrado')) {
                    next(new ApiError(409, error.message));
                } else if (error.message.includes('obrigatório') || error.message.includes('inválido')) {
                    next(new ApiError(400, error.message));
                } else {
                    next(error);
                }
            } else {
                next(error);
            }
        }
    };

    updatePlayer = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            const data: UpdatePlayerDto = req.body;
            const player = await this.playersService.updatePlayer(id, data);
            res.json(player);
        } catch (error) {
            if (error instanceof Error) {
                if (error.message === 'Jogador não encontrado') {
                    next(new ApiError(404, error.message));
                } else if (error.message.includes('Já existe')) {
                    next(new ApiError(409, error.message));
                } else {
                    next(error);
                }
            } else {
                next(error);
            }
        }
    };

    deletePlayer = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            await this.playersService.deletePlayer(id);
            res.status(204).send();
        } catch (error) {
            if (error instanceof Error) {
                if (error.message === 'Jogador não encontrado') {
                    next(new ApiError(404, error.message));
                } else if (error.message.includes('débitos pendentes')) {
                    next(new ApiError(400, error.message));
                } else {
                    next(error);
                }
            } else {
                next(error);
            }
        }
    };

    suspendPlayer = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            const player = await this.playersService.suspendPlayer(id);
            res.json(player);
        } catch (error) {
            if (error instanceof Error && error.message === 'Jogador não encontrado') {
                next(new ApiError(404, error.message));
            } else {
                next(error);
            }
        }
    };

    activatePlayer = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            const player = await this.playersService.activatePlayer(id);
            res.json(player);
        } catch (error) {
            if (error instanceof Error && error.message === 'Jogador não encontrado') {
                next(new ApiError(404, error.message));
            } else {
                next(error);
            }
        }
    };

    getStats = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const stats = await this.playersService.getStats();
            res.json(stats);
        } catch (error) {
            next(error);
        }
    };

    getPlayerDebts = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            const debts = await this.playersService.getPlayerDebts(id);
            res.json(debts);
        } catch (error) {
            if (error instanceof Error && error.message === 'Jogador não encontrado') {
                next(new ApiError(404, error.message));
            } else {
                next(error);
            }
        }
    };

    getPlayerGames = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            const games = await this.playersService.getPlayerGames(id);
            res.json(games);
        } catch (error) {
            if (error instanceof Error && error.message === 'Jogador não encontrado') {
                next(new ApiError(404, error.message));
            } else {
                next(error);
            }
        }
    };

    getPlayerTransactions = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 20;

            const result = await this.playersService.getPlayerTransactions(id, page, limit);
            res.json(result);
        } catch (error) {
            if (error instanceof Error && error.message === 'Jogador não encontrado') {
                next(new ApiError(404, error.message));
            } else {
                next(error);
            }
        }
    };

    exportPlayers = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const filters: ListPlayersDto = {
                status: req.query.status as any,
                search: req.query.search as string,
                page: 1,
                limit: 10000, // Exporta todos
            };

            const result = await this.playersService.listPlayers(filters);

            const headers = ['ID', 'Nome', 'Email', 'Telefone', 'CPF', 'Status', 'Débito Total', 'Data de Cadastro'];
            const rows = result.players.map(p => [
                p.id,
                p.name,
                p.email || '',
                p.phone,
                p.cpf || '',
                p.status,
                p.totalDebt.toFixed(2),
                new Date(p.joinDate).toLocaleDateString('pt-BR'),
            ]);

            const csv = [
                headers.join(','),
                ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
            ].join('\n');

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=jogadores.csv');
            res.send(csv);
        } catch (error) {
            next(error);
        }
    };

    addCredit = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            const { workspaceId, amountCents, note, method, category } = req.body;

            if (!workspaceId || !amountCents) {
                throw new Error('workspaceId e amountCents são obrigatórios');
            }

            const player = await this.playersService.addCredit(id, {
                workspaceId,
                amountCents,
                note,
                method,
                category
            });
            res.json(player);
        } catch (error) {
            if (error instanceof Error && error.message === 'Jogador não encontrado') {
                next(new ApiError(404, error.message));
            } else {
                next(error);
            }
        }
    };
}
