import { injectable, inject } from 'tsyringe';
import { Model, Types } from 'mongoose';
import { GameService } from './game.service';
import {
    DashboardStatsDto,
    DashboardResponseDto,
    RecentGame,
    RecentDebt,
    MonthlyRevenue
} from '../api/dto/dashboard.dto';
import {
    TRANSACTION_MODEL_TOKEN,
    ITransaction,
    TransactionType,
    TransactionStatus
} from '../core/models/transaction.model';
import {
    MEMBERSHIP_MODEL_TOKEN,
    IMembership,
    MembershipStatus
} from '../core/models/membership.model';
import { GAME_MODEL_TOKEN, IGame } from '../core/models/game.model';

@injectable()
export class DashboardService {
    constructor(
        @inject(TRANSACTION_MODEL_TOKEN) private readonly transactionModel: Model<ITransaction>,
        @inject(MEMBERSHIP_MODEL_TOKEN) private readonly membershipModel: Model<IMembership>,
        @inject(GAME_MODEL_TOKEN) private readonly gameModel: Model<IGame>,
        @inject(GameService) private readonly gameService: GameService
    ) { }

    /**
     * Obtém estatísticas completas do dashboard para um workspace
     */
    async getStats(workspaceId: string): Promise<DashboardStatsDto> {
        if (!workspaceId) {
            throw new Error('Workspace ID is required for dashboard stats');
        }

        const wsId = new Types.ObjectId(workspaceId);

        const [financeStats, memberStats, gameStats] = await Promise.all([
            this.calculateFinanceStats(wsId),
            this.calculateMemberStats(wsId),
            this.calculateGameStats(wsId)
        ]);

        return {
            ...financeStats,
            ...memberStats,
            ...gameStats
        };
    }

    /**
     * Support legacy full dashboard call if needed, constructing response
     */
    async getDashboardStats(workspaceId?: string): Promise<DashboardResponseDto> {
        if (!workspaceId) throw new Error("Workspace ID required");

        const stats = await this.getStats(workspaceId);

        const recentGames = await this.getRecentGames(5, workspaceId);
        const recentDebts = await this.getRecentDebts(5, workspaceId);

        return {
            stats,
            recentGames,
            recentDebts,
            monthlyRevenue: []
        };
    }

    private async calculateFinanceStats(workspaceId: Types.ObjectId) {
        const [result] = await this.transactionModel.aggregate([
            { $match: { workspaceId } },
            {
                $group: {
                    _id: null,
                    totalRevenue: {
                        $sum: {
                            $cond: [
                                { $and: [{ $eq: ["$type", TransactionType.INCOME] }, { $eq: ["$status", TransactionStatus.COMPLETED] }] },
                                "$amount",
                                0
                            ]
                        }
                    },
                    totalExpenses: {
                        $sum: {
                            $cond: [
                                { $and: [{ $eq: ["$type", TransactionType.EXPENSE] }, { $eq: ["$status", TransactionStatus.COMPLETED] }] },
                                "$amount",
                                0
                            ]
                        }
                    },
                    pendingRevenue: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $eq: ["$type", TransactionType.INCOME] },
                                        { $eq: ["$status", TransactionStatus.PENDING] }
                                    ]
                                },
                                "$amount",
                                0
                            ]
                        }
                    }
                }
            }
        ]);

        const totalRevenue = result?.totalRevenue || 0;
        const totalExpenses = result?.totalExpenses || 0;
        const pendingRevenue = result?.pendingRevenue || 0;

        return {
            totalRevenue,
            totalExpenses,
            netBalance: totalRevenue - totalExpenses,
            pendingRevenue
        };
    }

    private async calculateMemberStats(workspaceId: Types.ObjectId) {
        const stats = await this.membershipModel.aggregate([
            { $match: { workspaceId } },
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 }
                }
            }
        ]);

        let totalMembers = 0;
        let activeMembers = 0;
        let suspendedMembers = 0;

        stats.forEach(s => {
            totalMembers += s.count;
            if (s._id === MembershipStatus.ACTIVE) activeMembers = s.count;
            if (s._id === MembershipStatus.SUSPENDED) suspendedMembers = s.count;
        });

        return {
            totalMembers,
            activeMembers,
            suspendedMembers
        };
    }

    private async calculateGameStats(workspaceId: Types.ObjectId) {
        const now = new Date();

        const [totalGames, nextGame] = await Promise.all([
            this.gameModel.countDocuments({ workspaceId }),
            this.gameModel.findOne({
                workspaceId,
                date: { $gte: now },
                status: 'open'
            }).sort({ date: 1 }).select('date').lean()
        ]);

        return {
            totalGames,
            nextGameDate: nextGame?.date || null
        };
    }

    private async getRecentGames(limit: number, workspaceId: string): Promise<RecentGame[]> {
        const result = await this.gameService.listGames({
            workspaceId,
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

    private async getRecentDebts(limit: number, workspaceId: string): Promise<RecentDebt[]> {
        const debts = await this.transactionModel.find({
            workspaceId,
            type: TransactionType.INCOME,
            status: TransactionStatus.PENDING,
            userId: { $exists: true, $ne: null }
        })
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate('userId', 'name')
            .lean();

        return debts.map(d => ({
            id: d._id.toString(),
            playerName: (d.userId as any)?.name || 'Usuário Desconhecido',
            amount: d.amount,
            status: d.status,
            createdAt: d.createdAt.toISOString(),
            description: d.description || ''
        }));
    }
}

export const DASHBOARD_SERVICE_TOKEN = 'DASHBOARD_SERVICE_TOKEN';
