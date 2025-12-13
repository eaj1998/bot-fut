import { Request, Response, NextFunction } from 'express';
import { injectable, inject } from 'tsyringe';
import { DebtsService, DEBTS_SERVICE_TOKEN } from '../../services/debts.service';
import { CreateDebtDto, UpdateDebtDto, PayDebtDto, ListDebtsDto, SendRemindersDto } from '../dto/debt.dto';
import { ApiError } from '../middleware/error.middleware';

@injectable()
export class DebtsController {
    constructor(
        @inject(DEBTS_SERVICE_TOKEN) private readonly debtsService: DebtsService
    ) { }

    listDebts = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const filters: ListDebtsDto = {
                status: req.query.status as any,
                playerId: req.query.playerId as string,
                gameId: req.query.gameId as string,
                workspaceId: req.query.workspaceId as string,
                search: req.query.search as string,
                page: parseInt(req.query.page as string) || 1,
                limit: parseInt(req.query.limit as string) || 20,
                sortBy: req.query.sortBy as any,
                sortOrder: req.query.sortOrder as any,
            };

            const result = await this.debtsService.listDebts(filters);
            res.json(result);
        } catch (error) {
            next(error);
        }
    };

    getDebtById = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            const debt = await this.debtsService.getDebtById(id);
            res.json(debt);
        } catch (error) {
            if (error instanceof Error && error.message === 'Débito não encontrado') {
                next(new ApiError(404, error.message));
            } else {
                next(error);
            }
        }
    };

    createDebt = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const data: CreateDebtDto = req.body;
            const debt = await this.debtsService.createDebt(data);
            res.status(201).json(debt);
        } catch (error) {
            if (error instanceof Error) {
                if (error.message.includes('não encontrado')) {
                    next(new ApiError(404, error.message));
                } else if (error.message.includes('obrigatório') || error.message.includes('maior que zero')) {
                    next(new ApiError(400, error.message));
                } else {
                    next(error);
                }
            } else {
                next(error);
            }
        }
    };

    payDebt = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            const data: PayDebtDto = req.body;
            const debt = await this.debtsService.payDebt(id, data);
            res.json(debt);
        } catch (error) {
            if (error instanceof Error) {
                if (error.message === 'Débito não encontrado') {
                    next(new ApiError(404, error.message));
                } else if (error.message.includes('não é um débito')) {
                    next(new ApiError(400, error.message));
                } else {
                    next(error);
                }
            } else {
                next(error);
            }
        }
    };

    cancelDebt = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            await this.debtsService.cancelDebt(id);
            res.status(204).send();
        } catch (error) {
            if (error instanceof Error && error.message === 'Débito não encontrado') {
                next(new ApiError(404, error.message));
            } else {
                next(error);
            }
        }
    };

    getStats = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const workspaceId = req.query.workspaceId as string;
            const stats = await this.debtsService.getStats(workspaceId);
            res.json(stats);
        } catch (error) {
            next(error);
        }
    };

    sendReminders = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const data: SendRemindersDto = req.body;
            const result = await this.debtsService.sendReminders(data);
            res.json({
                message: 'Lembretes enviados',
                ...result,
            });
        } catch (error) {
            next(error);
        }
    };
}
