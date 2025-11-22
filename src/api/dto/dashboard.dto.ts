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
    totalDebt: number;
    totalPending: number;
    totalOverdue: number;
    paidThisMonth: number;
    revenue: number;
    revenueGrowth: number;
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
    amount: number;
    status: string;
    createdAt: string;
}

/**
 * DTO para dados de receita mensal
 */
export interface MonthlyRevenue {
    month: string;
    value: number;
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
