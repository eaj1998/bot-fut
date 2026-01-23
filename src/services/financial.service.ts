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
    userId: string;
    amount: number; // em reais
    type: TransactionType;
    category: TransactionCategory;
    description: string;
    dueDate?: Date;
    method?: 'pix' | 'dinheiro' | 'transf' | 'ajuste';
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

        if (!data.userId) {
            throw new ApiError(400, 'userId é obrigatório');
        }

        if (data.amount <= 0) {
            throw new ApiError(400, 'Valor deve ser maior que zero');
        }

        // Verificar se usuário existe
        const user = await this.userRepo.findById(data.userId);
        if (!user) {
            throw new ApiError(404, 'Usuário não encontrado');
        }

        // Verificar se workspace existe
        const workspace = await this.workspaceRepo.findById(data.workspaceId);
        if (!workspace) {
            throw new ApiError(404, 'Workspace não encontrado');
        }

        // Convert to cents
        const amountCents = Math.round(data.amount * 100);

        // Create transaction (note: parameter is 'amount' in cents, not 'amountCents')
        const transaction = await this.transactionRepo.createTransaction({
            workspaceId: data.workspaceId,
            userId: data.userId,
            type: data.type,
            category: data.category,
            status: TransactionStatus.PENDING,
            amount: amountCents, // Repository expects 'amount' in cents
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
