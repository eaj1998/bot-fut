/**
 * DTOs para Dashboard e Estatísticas Gerais
 */

/**
 * DTO de resposta do Dashboard
 */
export interface DashboardStatsDto {
    // Financeiro
    totalRevenue: number;        // Total Recebido (Transactions INCOME + COMPLETED)
    totalExpenses: number;       // Total Gasto (Transactions EXPENSE + COMPLETED)
    netBalance: number;          // Revenue - Expenses
    pendingRevenue: number;      // A Receber (Transactions INCOME + PENDING/OVERDUE)

    // Membros
    totalMembers: number;
    activeMembers: number;       // Status ACTIVE
    suspendedMembers: number;    // Status SUSPENDED (Inadimplentes)

    // Operacional
    totalGames: number;
    nextGameDate: Date | string | null;
}

/**
 * DTO para dados de jogos recentes
 */
export interface RecentGame {
    id: string;
    name: string;
    date: string;
    time: string;
    status: string;
    currentPlayers: number;
    maxPlayers: number;
}

/**
 * DTO para débitos recentes
 */
export interface RecentDebt {
    id: string;
    playerName: string;
    amount: number;              // Em centavos
    status: string;
    createdAt: string;
    description?: string;
}

/**
 * DTO para dados de receita mensal
 */
export interface MonthlyRevenue {
    month: string;
    value: number;               // Em centavos
}

/**
 * DTO de resposta completa do dashboard
 */
export interface DashboardResponseDto {
    stats: DashboardStatsDto;
    recentGames?: RecentGame[];
    recentDebts?: RecentDebt[];
    monthlyRevenue?: MonthlyRevenue[];
}
