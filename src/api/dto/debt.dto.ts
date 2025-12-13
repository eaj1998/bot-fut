import { Types } from 'mongoose';

export interface CreateDebtDto {
    playerId: string;
    gameId?: string;
    workspaceId: string;
    amount: number; // Em reais
    dueDate?: string;
    notes?: string;
    category?: 'field-payment' | 'player-payment' | 'player-debt' | 'general' | 'equipment' | 'rental-goalkeeper';
    status?: "pendente" | "confirmado";
}

export interface UpdateDebtDto {
    amount?: number;
    dueDate?: string;
    notes?: string;
    status?: "pendente" | "confirmado" | "estornado";
}

export interface PayDebtDto {
    amount?: number; // Valor pago (se parcial)
    method?: 'pix' | 'dinheiro' | 'transf';
    notes?: string;
    category?: 'field-payment' | 'player-payment' | 'player-debt' | 'general' | 'equipment' | 'rental-goalkeeper';
}

export interface DebtResponseDto {
    id: string;
    playerId: string;
    playerName: string;
    gameId?: string;
    gameName?: string;
    slot?: number;
    workspaceId: string;
    amount: number;
    amountCents: number;
    dueDate?: string;
    type: 'debit' | 'credit';
    status: "pendente" | "confirmado" | "estornado";
    notes?: string;
    category: string;
    createdAt: string;
    paidAt?: string;
    updatedAt: string;
}

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

export interface PaginatedDebtsResponseDto {
    debts: DebtResponseDto[];
    overdue: number;
    debtsMonth: number;
    pendingAmount: number;
    paidAmount: number;
    total: number;
    page: number;
    totalPages: number;
    limit: number;
}

export interface DebtsStatsDto {
    totalPending: number;
    totalPendingAmount: number;
    totalPaid: number;
    totalPaidAmount: number;
    totalOverdue: number;
    totalOverdueAmount: number;
    thisMonth: number;
    thisMonthAmount: number;
    totalDebitsAmount: number;  // Total de débitos (pendentes + confirmados)
}

export interface SendRemindersDto {
    debtIds?: string[];
    workspaceId?: string;
    onlyOverdue?: boolean;
}
