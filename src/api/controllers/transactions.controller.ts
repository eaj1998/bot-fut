import { Request, Response } from 'express';
import { injectable, inject } from 'tsyringe';
import { FinancialService, FINANCIAL_SERVICE_TOKEN } from '../../services/financial.service';
import { GameService } from '../../services/game.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';

@injectable()
export class TransactionsController {
    constructor(
        @inject(FINANCIAL_SERVICE_TOKEN) private financialService: FinancialService,
        @inject(GameService) private gameService: GameService
    ) { }

    /**
     * GET /api/transactions
     * Retorna todas as transações do workspace (para admin)
     */
    getAll = asyncHandler(async (req: AuthRequest, res: Response) => {
        const workspaceId = req.query.workspaceId as string;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const type = req.query.type as any;
        const status = req.query.status as any;
        const search = req.query.search as string;

        if (!workspaceId) {
            return res.status(400).json({
                success: false,
                message: 'Workspace ID é obrigatório'
            });
        }

        const filters: any = {};
        if (type) filters.type = type;
        if (status) filters.status = status;
        if (search) filters.search = search;

        const result = await this.financialService.getAllTransactions(workspaceId, page, limit, filters);

        res.json(result);
    });

    /**
     * GET /api/transactions/stats
     * Retorna estatísticas financeiras do workspace
     */
    getStats = asyncHandler(async (req: AuthRequest, res: Response) => {
        const workspaceId = req.query.workspaceId as string;

        if (!workspaceId) {
            return res.status(400).json({
                success: false,
                message: 'Workspace ID é obrigatório'
            });
        }

        const stats = await this.financialService.getWorkspaceStats(workspaceId);
        res.json(stats);
    });

    /**
     * GET /api/transactions/chart
     * Retorna dados para gráficos
     */
    getChartData = asyncHandler(async (req: AuthRequest, res: Response) => {
        const workspaceId = req.query.workspaceId as string;
        const days = parseInt(req.query.days as string) || 30;

        if (!workspaceId) {
            return res.status(400).json({
                success: false,
                message: 'Workspace ID é obrigatório'
            });
        }

        const data = await this.financialService.getChartData(workspaceId, days);
        res.json(data);
    });

    /**
     * GET /api/transactions/balance
     * Retorna o saldo financeiro do usuário e histórico
     */
    getMyBalance = asyncHandler(async (req: AuthRequest, res: Response) => {
        const userId = req.user!.id;
        const workspaceId = req.query.workspaceId as string;

        if (!workspaceId) {
            return res.status(400).json({
                success: false,
                message: 'Workspace ID não encontrado para o usuário'
            });
        }

        const stats = await this.financialService.getBalance(userId, workspaceId);

        res.json({
            totalPending: stats.totalDebt,
            history: stats.transactions
        });
    });

    /**
     * GET /api/transactions/my
     * Retorna transações do usuário (com filtros)
     */
    getMyTransactions = asyncHandler(async (req: AuthRequest, res: Response) => {
        const userId = req.user!.id;
        const workspaceId = req.query.workspaceId as string;
        const stats = await this.financialService.getBalance(userId, workspaceId);
        res.json({
            transactions: stats.transactions,
            total: stats.transactions.length
        });
    });

    /**
     * POST /api/transactions/:id/pay
     * Pagar uma transação
     */
    payTransaction = asyncHandler(async (req: AuthRequest, res: Response) => {
        const { id } = req.params;
        const { method = 'pix' } = req.body;

        // Buscar a transaction
        const transaction = await this.financialService['transactionRepo'].findById(id as string);
        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: 'Transação não encontrada'
            });
        }

        // Verificar se já está paga
        if (transaction.status === 'COMPLETED') {
            return res.status(400).json({
                success: false,
                message: 'Transação já foi paga'
            });
        }

        // Marcar como paga
        await this.financialService['transactionRepo'].markAsPaid(
            id as string,
            new Date(),
            method as 'pix' | 'dinheiro' | 'transf' | 'ajuste'
        );

        // Se for transaction de jogo, marcar jogador como pago no roster
        if (transaction.gameId && transaction.userId) {
            try {
                const game = await this.gameService.getGameById(transaction.gameId.toString());

                if (game) {
                    const transactionUserId = transaction.userId.toString();

                    const player = game.roster.players.find(p => {
                        const playerUserId = p.userId?.toString();
                        const invitedBy = p.invitedByUserId?.toString();

                        return playerUserId === transactionUserId || invitedBy === transactionUserId;
                    });

                    if (player && typeof player.slot === 'number') {
                        await this.gameService.markAsPaid(
                            game._id,
                            player.slot,
                            { method: method as 'pix' | 'dinheiro' | 'transf' | 'ajuste' }
                        );
                    } else {
                        // Player not found in roster
                    }
                } else {
                    // Game not found
                }
            } catch (error) {
                console.error('Erro ao atualizar roster do jogo:', error);
                // Não falha a operação se não conseguir atualizar o roster
            }
        }

        res.json({
            success: true,
            message: 'Pagamento registrado com sucesso'
        });
    });

    /**
     * POST /api/transactions
     * Cria uma nova transação (receita ou despesa)
     */
    create = asyncHandler(async (req: AuthRequest, res: Response) => {
        const { workspaceId, userId, amount, type, category, description, dueDate, method, status } = req.body;

        if (!workspaceId) {
            return res.status(400).json({
                success: false,
                message: 'Workspace ID é obrigatório'
            });
        }

        const transaction = await this.financialService.createManualTransaction({
            workspaceId,
            userId, // Optional
            amount, // Expected in CENTS
            type,
            category,
            description,
            dueDate: dueDate ? new Date(dueDate) : undefined,
            method,
            status
        });

        res.status(201).json(transaction);
    });


    /**
     * PUT /api/transactions/:id
     * Atualiza dados de uma transação (Edição via Admin)
     */
    update = asyncHandler(async (req: AuthRequest, res: Response) => {
        const { id } = req.params;
        const { status, description } = req.body;

        if (!id) {
            return res.status(400).json({ success: false, message: 'ID da transação é obrigatório' });
        }

        const result = await this.financialService.updateTransaction(id as string, {
            status,
            description
        });

        res.json({
            success: true,
            data: result,
            message: 'Transação atualizada com sucesso'
        });
    });

    /**
     * POST /api/transactions/:workspaceId/notify-singles
     * Dispara notificações de cobrança para pendências avulsas
     */
    notifySinglePayments = asyncHandler(async (req: AuthRequest, res: Response) => {
        const { workspaceId } = req.params;

        if (!workspaceId) {
            return res.status(400).json({ success: false, message: 'Workspace ID obrigatório' });
        }

        const report = await this.financialService.notifyOverdueSinglePayments(workspaceId);

        res.json({
            success: true,
            message: 'Processamento de notificações finalizado',
            data: report
        });
    });
}
