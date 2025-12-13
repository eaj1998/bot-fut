/**
 * DTOs para Dashboard e Estatísticas Gerais
 */

/**
 * DTO de resposta do Dashboard
 */
export interface DashboardStatsDto {
    totalPlayers: number;
    activePlayers: number;
    inactivePlayers: number;
    totalGames: number;
    upcomingGames: number;
    completedGames: number;
    totalDebt: number;           // Em centavos
    totalPending: number;
    totalOverdue: number;
    paidThisMonth: number;       // Em centavos
    revenue: number;             // Em centavos
    balance: number;             // Em centavos (créditos - débitos)
    receivables: number;         // Em centavos (débitos pendentes)
    revenueGrowth: number;       // Percentual
    totalWorkspaces: number;
    activeWorkspaces: number;
    totalChats: number;
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
