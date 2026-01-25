import { injectable, inject } from 'tsyringe';
import { TransactionRepository, TRANSACTION_REPOSITORY_TOKEN } from '../core/repositories/transaction.repository';
import { MembershipRepository, MEMBERSHIP_REPOSITORY_TOKEN } from '../core/repositories/membership.repository';
import { USER_REPOSITORY_TOKEN, UserRepository } from '../core/repositories/user.repository';
import { WorkspaceRepository } from '../core/repositories/workspace.repository';
import { TransactionType, TransactionCategory, TransactionStatus } from '../core/models/transaction.model';
import { TransactionResponseDto } from '../api/dto/transaction.dto';
import { ApiError } from '../api/middleware/error.middleware';

interface CreateManualTransactionInput {
    workspaceId: string;
    userId?: string;
    amount: number; // em centavos
    type: TransactionType;
    category: TransactionCategory;
    description: string;
    dueDate?: Date;
    method?: 'pix' | 'dinheiro' | 'transf' | 'ajuste';
    status?: TransactionStatus;
}

interface UserBalanceResult {
    totalPending: number; // em reais
    totalOverdue: number; // em reais
    totalDebt: number; // pending + overdue
    transactions: TransactionResponseDto[];
}

@injectable()
export class FinancialService {
    constructor(
        @inject(TRANSACTION_REPOSITORY_TOKEN) private readonly transactionRepo: TransactionRepository,
        @inject(MEMBERSHIP_REPOSITORY_TOKEN) private readonly membershipRepo: MembershipRepository,
        @inject(USER_REPOSITORY_TOKEN) private readonly userRepo: UserRepository,
        @inject(WorkspaceRepository) private readonly workspaceRepo: WorkspaceRepository
    ) { }

    /**
     * Cria uma transação manual (multa, equipamento, ajuste, etc)
     * Substitui o antigo addDebit do LedgerRepository
     */
    async createManualTransaction(data: CreateManualTransactionInput): Promise<TransactionResponseDto> {
        // Validations
        if (!data.workspaceId) {
            throw new ApiError(400, 'workspaceId é obrigatório');
        }

        if (data.amount <= 0) {
            throw new ApiError(400, 'Valor deve ser maior que zero');
        }

        // Verificar se usuário existe se fornecido
        if (data.userId) {
            const user = await this.userRepo.findById(data.userId);
            if (!user) {
                throw new ApiError(404, 'Usuário não encontrado');
            }
        }

        // Verificar se workspace existe
        const workspace = await this.workspaceRepo.findById(data.workspaceId);
        if (!workspace) {
            throw new ApiError(404, 'Workspace não encontrado');
        }

        // Create transaction
        const transaction = await this.transactionRepo.createTransaction({
            workspaceId: data.workspaceId,
            userId: data.userId,
            type: data.type,
            category: data.category,
            status: data.status || TransactionStatus.PENDING,
            amount: data.amount, // Já está em centavos
            dueDate: data.dueDate || new Date(),
            description: data.description,
            method: data.method || 'pix',
        });

        return this.toResponseDto(transaction);
    }

    /**
     * Calcula saldo devedor do usuário
     * Retorna soma de todas Transactions PENDING/OVERDUE do tipo INCOME
     * Esta é a nova lógica que substitui o cálculo antigo baseado em Ledger
     */
    async getBalance(userId: string, workspaceId: string): Promise<UserBalanceResult> {
        if (!userId) {
            throw new ApiError(400, 'userId é obrigatório');
        }

        if (!workspaceId) {
            throw new ApiError(400, 'workspaceId é obrigatório');
        }

        // Buscar transactions pendentes (tipo INCOME = dívidas do usuário)
        // findByUserId signature: (userId, workspaceId?, filters?)
        const allPendingTxs = await this.transactionRepo.findByUserId(userId, workspaceId, {
            type: TransactionType.INCOME,
        });

        const pending = allPendingTxs.filter(t => t.status === TransactionStatus.PENDING);
        const overdue = allPendingTxs.filter(t => t.status === 'OVERDUE'); // String literal as OVERDUE not in enum yet

        const totalPending = pending.reduce((sum, t) => sum + (t.amount || 0), 0) / 100;
        const totalOverdue = overdue.reduce((sum, t) => sum + (t.amount || 0), 0) / 100;
        const totalDebt = totalPending + totalOverdue;

        return {
            totalPending,
            totalOverdue,
            totalDebt,
            transactions: [...pending, ...overdue].map(t => this.toResponseDto(t)),
        };
    }

    /**
     * Retorna estatísticas financeiras do workspace
     */
    async getWorkspaceStats(workspaceId: string): Promise<{
        revenue: number;
        expenses: number;
        balance: number;
        pending: number;
    }> {
        const stats = await this.transactionRepo.calculateWorkspaceBalance(workspaceId);

        // Calcular pendências (receitas futuras)
        const pendingTxs = await this.transactionRepo.findPendingTransactions(workspaceId, {
            type: TransactionType.INCOME
        });

        const pending = pendingTxs.reduce((sum, t) => sum + (t.amount || 0), 0) / 100;

        return {
            revenue: stats.income / 100,
            expenses: stats.expense / 100,
            balance: stats.balance / 100,
            pending
        };
    }

    /**
     * Retorna dados agregados para gráficos
     */
    async getChartData(workspaceId: string, days = 30): Promise<any[]> {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        return this.transactionRepo.getAggregatedChartData(workspaceId, startDate, endDate);
    }

    /**
     * Lista todas as transações com paginação e filtros
     */
    async getAllTransactions(
        workspaceId: string,
        page: number = 1,
        limit: number = 20,
        filters?: { type?: TransactionType; search?: string }
    ): Promise<{ transactions: TransactionResponseDto[]; total: number; pages: number }> {
        if (!workspaceId) {
            throw new ApiError(400, 'workspaceId é obrigatório');
        }

        const repoFilters: any = {};
        if (filters?.type) repoFilters.type = filters.type;
        if (filters?.search) repoFilters.search = filters.search;

        const result = await this.transactionRepo.findAll(workspaceId, page, limit, repoFilters);

        return {
            transactions: result.transactions.map(t => this.toResponseDto(t)),
            total: result.total,
            pages: result.pages
        };
    }

    /**
     * Converte Transaction model para DTO de resposta
     */
    private toResponseDto(transaction: any): TransactionResponseDto {
        const amountCents = transaction.amount || 0;

        return {
            id: transaction._id.toString(),
            workspaceId: transaction.workspaceId.toString(),
            userId: transaction.userId?.toString(),
            gameId: transaction.gameId?.toString(),
            membershipId: transaction.membershipId?.toString(),
            type: transaction.type,
            category: transaction.category,
            status: transaction.status,
            amount: amountCents / 100,
            amountCents: amountCents,
            dueDate: transaction.dueDate.toISOString(),
            paidAt: transaction.paidAt?.toISOString(),
            description: transaction.description,
            method: transaction.method,
            createdAt: transaction.createdAt.toISOString(),
            updatedAt: transaction.updatedAt.toISOString(),
        };
    }
}

export const FINANCIAL_SERVICE_TOKEN = Symbol('FinancialService');
