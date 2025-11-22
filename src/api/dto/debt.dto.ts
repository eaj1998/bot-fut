import { Types } from 'mongoose';

/**
 * DTO para criar um novo débito
 */
export interface CreateDebtDto {
    playerId: string;
    gameId?: string;
    workspaceId: string;
    amount: number; // Em reais
    dueDate?: string;
    notes?: string;
    category?: 'field-payment' | 'player-payment' | 'player-debt' | 'general';
}

/**
 * DTO para atualizar um débito
 */
export interface UpdateDebtDto {
    amount?: number;
    dueDate?: string;
    notes?: string;
    status?: "pendente" | "confirmado" | "estornado";
}

/**
 * DTO para registrar pagamento
 */
export interface PayDebtDto {
    amount?: number; // Valor pago (se parcial)
    method?: 'pix' | 'dinheiro' | 'transf';
    notes?: string;
}

/**
 * DTO de resposta de débito
 */
export interface DebtResponseDto {
    id: string;
    playerId: string;
    playerName: string;
    gameId?: string;
    gameName?: string;
    workspaceId: string;
    amount: number;
    amountCents: number;
    dueDate?: string;
    status: "pendente" | "confirmado" | "estornado";
    notes?: string;
    category: string;
    createdAt: string;
    paidAt?: string;
    updatedAt: string;
}

/**
 * DTO para listagem de débitos
 */
export interface ListDebtsDto {
    status?: "pendente" | "confirmado" | "estornado" | 'all';
    playerId?: string;
    gameId?: string;
    workspaceId?: string;
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: 'amount' | 'dueDate' | 'createdAt';
    sortOrder?: 'asc' | 'desc';
}

/**
 * DTO de resposta paginada
 */
export interface PaginatedDebtsResponseDto {
    debts: DebtResponseDto[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
}

/**
 * DTO para estatísticas de débitos
 */
export interface DebtsStatsDto {
    totalPending: number;
    totalPendingAmount: number;
    totalPaid: number;
    totalPaidAmount: number;
    totalOverdue: number;
    totalOverdueAmount: number;
    thisMonth: number;
    thisMonthAmount: number;
}

/**
 * DTO para enviar lembretes
 */
export interface SendRemindersDto {
    debtIds?: string[];
    workspaceId?: string;
    onlyOverdue?: boolean;
}
