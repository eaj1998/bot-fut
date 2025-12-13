import { injectable, inject } from 'tsyringe';
import { PlayersService, PLAYERS_SERVICE_TOKEN } from './players.service';
import { GameService } from './game.service';
import { DebtsService, DEBTS_SERVICE_TOKEN } from './debts.service';
import { WorkspaceService, WORKSPACES_SERVICE_TOKEN } from './workspace.service';
import { ChatService, CHATS_SERVICE_TOKEN } from './chat.service';
import { LedgerRepository, LEDGER_REPOSITORY_TOKEN } from '../core/repositories/ledger.repository';
import {
    DashboardResponseDto,
    DashboardStatsDto,
    RecentGame,
    RecentDebt,
    MonthlyRevenue,
} from '../api/dto/dashboard.dto';

@injectable()
export class DashboardService {
    constructor(
        @inject(PLAYERS_SERVICE_TOKEN) private readonly playersService: PlayersService,
        @inject(GameService) private readonly gameService: GameService,
        @inject(DEBTS_SERVICE_TOKEN) private readonly debtsService: DebtsService,
        @inject(WORKSPACES_SERVICE_TOKEN) private readonly workspaceService: WorkspaceService,
        @inject(CHATS_SERVICE_TOKEN) private readonly chatService: ChatService,
        @inject(LEDGER_REPOSITORY_TOKEN) private readonly ledgerRepository: LedgerRepository
    ) { }

    /**
     * Obtém estatísticas completas do dashboard
     */
    async getDashboardStats(workspaceId?: string): Promise<DashboardResponseDto> {
        const [
            playersStats,
            gamesStats,
            debtsStats,
            workspacesStats,
            chatsStats,
            balance,
            recentGames,
            recentDebts,
            monthlyRevenue,
            revenueGrowth,
        ] = await Promise.all([
            this.playersService.getStats(),
            this.gameService.getStats(),
            this.debtsService.getStats(workspaceId),
            this.workspaceService.getStats(),
            this.chatService.getStats(),
            workspaceId ? this.ledgerRepository.sumWorkspaceCashbox(workspaceId) : Promise.resolve(0),
            this.getRecentGames(5),
            this.getRecentDebts(5, workspaceId),
            this.getMonthlyRevenue(6, workspaceId),
            this.calculateRevenueGrowth(workspaceId),
        ]);

        const receivables = workspaceId ? debtsStats.totalPendingAmount : 0;

        const stats: DashboardStatsDto = {
            totalPlayers: playersStats.total,
            activePlayers: playersStats.active,
            inactivePlayers: playersStats.inactive,
            totalGames: gamesStats.total,
            upcomingGames: gamesStats.upcoming,
            completedGames: gamesStats.finished,
            totalDebt: debtsStats.totalPendingAmount,
            totalPending: debtsStats.totalPending,
            totalOverdue: debtsStats.totalOverdue,
            paidThisMonth: debtsStats.thisMonthAmount,
            revenue: debtsStats.totalPaidAmount,
            balance,
            receivables,
            revenueGrowth,
            totalWorkspaces: workspacesStats.totalWorkspaces,
            activeWorkspaces: workspacesStats.activeWorkspaces,
            totalChats: chatsStats.totalChats,
        };

        return {
            stats,
            recentGames,
            recentDebts,
            monthlyRevenue,
        };
    }

    /**
     * Obtém apenas as estatísticas (sem dados adicionais)
     */
    async getStats(workspaceId?: string): Promise<DashboardStatsDto> {
        const dashboard = await this.getDashboardStats(workspaceId);
        return dashboard.stats;
    }

    /**
     * Obtém jogos recentes
     */
    private async getRecentGames(limit: number = 5): Promise<RecentGame[]> {
        const result = await this.gameService.listGames({
            page: 1,
            limit,
        });

        return result.games.map(game => ({
            id: game.id,
            name: game.name,
            date: game.date,
            time: game.time,
            status: game.status,
            currentPlayers: game.currentPlayers,
            maxPlayers: game.maxPlayers,
        }));
    }

    /**
     * Obtém débitos recentes
     */
    private async getRecentDebts(limit: number = 5, workspaceId?: string): Promise<RecentDebt[]> {
        const result = await this.debtsService.listDebts({
            workspaceId,
            status: 'all',
            page: 1,
            limit,
        });

        return result.debts.map(debt => ({
            id: debt.id,
            playerName: debt.playerName,
            notes: debt.notes,
            category: debt.category,
            amount: debt.amountCents,
            status: debt.status,
            createdAt: debt.createdAt,
        }));
    }

    /**
     * Obtém receita mensal dos últimos N meses
     */
    private async getMonthlyRevenue(months: number = 6, workspaceId?: string): Promise<MonthlyRevenue[]> {
        const monthlyData: MonthlyRevenue[] = [];
        const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

        for (let i = months - 1; i >= 0; i--) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);

            const month = monthNames[date.getMonth()];

            // TODO: Implementar cálculo real de receita por mês
            // Por enquanto, retorna dados mockados em centavos
            const valueInReais = 12000 + Math.random() * 4000;
            const valueInCents = Math.round(valueInReais * 100);

            monthlyData.push({
                month,
                value: valueInCents,  // Valor em centavos
            });
        }

        return monthlyData;
    }

    /**
     * Calcula crescimento de receita em relação ao mês anterior
     */
    private async calculateRevenueGrowth(workspaceId?: string): Promise<number> {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

        // TODO: Implementar cálculo real de crescimento baseado em dados do banco
        // Por enquanto, retorna um valor mockado
        return 12.5;
    }
}

export const DASHBOARD_SERVICE_TOKEN = 'DASHBOARD_SERVICE_TOKEN';
