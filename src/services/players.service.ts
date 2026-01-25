import { injectable, inject } from 'tsyringe';
import { UserRepository } from '../core/repositories/user.repository';

import { GameRepository, GAME_REPOSITORY_TOKEN } from '../core/repositories/game.respository';
import { TransactionRepository, TRANSACTION_REPOSITORY_TOKEN } from '../core/repositories/transaction.repository';
import { MembershipRepository, MEMBERSHIP_REPOSITORY_TOKEN } from '../core/repositories/membership.repository';
import { WORKSPACE_MEMBER_MODEL_TOKEN, IWorkspaceMember } from '../core/models/workspace-member.model';
import { Model } from 'mongoose';
import { TransactionType, TransactionStatus, TransactionCategory } from '../core/models/transaction.model';
import {
    CreatePlayerDto,
    UpdatePlayerDto,
    PlayerResponseDto,
    ListPlayersDto,
    PaginatedPlayersResponseDto,
    PlayersStatsDto,
} from '../api/dto/player.dto';

@injectable()
export class PlayersService {
    constructor(
        @inject('USER_REPOSITORY_TOKEN') private readonly userRepository: UserRepository,
        @inject(GAME_REPOSITORY_TOKEN) private readonly gameRepository: GameRepository,
        @inject(TRANSACTION_REPOSITORY_TOKEN) private readonly transactionRepository: TransactionRepository,
        @inject(MEMBERSHIP_REPOSITORY_TOKEN) private readonly membershipRepo: MembershipRepository,
        @inject(WORKSPACE_MEMBER_MODEL_TOKEN) private readonly workspaceMemberModel: Model<IWorkspaceMember>
    ) { }

    /**
     * Converte documento do usuário para DTO de resposta
     */
    private async toResponseDto(user: any): Promise<PlayerResponseDto> {
        // Balance defaulted to 0 as Ledger is removed
        const balance = 0;

        // Usar TransactionRepository para calcular débitos pendentes (Income Pending)
        const debts = await this.transactionRepository.findByUserId(user._id.toString(), undefined, {
            status: TransactionStatus.PENDING,
            type: TransactionType.INCOME
        });
        const totalDebt = debts.reduce((sum, d) => sum + d.amount, 0);

        return {
            id: user._id.toString(),
            name: user.name,
            email: '',
            phone: user.phoneE164,
            cpf: '',
            nick: user.nick || '',
            isGoalie: user.isGoalie || false,
            status: user.status || 'active',
            balance: balance / 100,
            totalDebt: totalDebt / 100,
            role: user.role || 'user',
            joinDate: user.createdAt?.toISOString() || new Date().toISOString(),
            lastActivity: user.updatedAt?.toISOString() || user.createdAt?.toISOString() || new Date().toISOString(),
            createdAt: user.createdAt?.toISOString() || new Date().toISOString(),
            updatedAt: user.updatedAt?.toISOString() || new Date().toISOString(),
        };
    }

    /**
     * Lista jogadores com filtros e paginação
     */
    async listPlayers(filters: ListPlayersDto): Promise<PaginatedPlayersResponseDto> {
        const { users, total } = await this.userRepository.findAll(filters);

        const players = await Promise.all(
            users.map((user) => this.toResponseDto(user))
        );

        const stats = await this.userRepository.getStats();

        const allUsers = await this.userRepository.findAll({ limit: 10000 });
        let withDebtsCount = 0;

        for (const user of allUsers.users) {
            const debts = await this.transactionRepository.findByUserId(user._id.toString(), undefined, {
                status: TransactionStatus.PENDING,
                type: TransactionType.INCOME
            });

            if (debts.length > 0) {
                withDebtsCount++;
            }
        }

        return {
            players,
            total,
            page: filters.page || 1,
            totalPages: Math.ceil(total / (filters.limit || 20)),
            limit: filters.limit || 20,
            activeCount: stats.active,
            withDebtsCount,
            inactiveCount: stats.inactive,
        };
    }

    /**
     * Obtém um jogador por ID
     */
    async getPlayerById(id: string): Promise<PlayerResponseDto> {
        const user = await this.userRepository.findById(id);
        if (!user) {
            throw new Error('Jogador não encontrado');
        }
        return this.toResponseDto(user);
    }

    /**
     * Cria um novo jogador com suporte multi-tenant
     */
    async createPlayer(data: CreatePlayerDto): Promise<PlayerResponseDto> {
        if (!data.name || !data.phoneE164) {
            throw new Error('Nome e telefone são obrigatórios');
        }

        if (!data.type) {
            throw new Error('Tipo de jogador (MENSALISTA/AVULSO) é obrigatório');
        }

        if (!data.workspaceId) {
            throw new Error('Workspace ID é obrigatório');
        }

        // Normalizar telefone
        const { normalizePhone, isValidBrazilianPhone } = require('../utils/phone.util');
        const normalizedPhone = normalizePhone(data.phoneE164);

        if (!normalizedPhone || !isValidBrazilianPhone(data.phoneE164)) {
            throw new Error('Formato de telefone inválido');
        }

        // Verificar duplicidade de telefone no workspace
        // Como User não tem workspaceId direto, vamos verificar se existe o telefone
        // e depois verificar se tem membership neste workspace
        const existingUser = await this.userRepository['model'].findOne({ phoneE164: normalizedPhone });
        if (existingUser) {
            // Verificar se já tem membership neste workspace
            const existingMembership = await this.membershipRepo.findByUserId(
                existingUser._id.toString(),
                data.workspaceId
            );
            if (existingMembership) {
                throw new Error('Já existe um jogador com este telefone neste workspace');
            }
        }

        // Criar ou atualizar usuário
        let user = existingUser;
        if (!user) {
            user = await this.userRepository.create({
                name: data.name,
                phoneE164: normalizedPhone,
                nick: data.nick,
                isGoalie: data.isGoalie || data.position === 'GOALKEEPER',
                role: data.role || 'user',
                position: data.position,
                playerType: data.type,
                stars: data.stars,
            });
        } else {
            // Atualizar dados se usuário já existe
            user.name = data.name;
            user.nick = data.nick || user.nick;
            user.position = data.position || user.position;
            user.playerType = data.type;
            user.stars = data.stars || user.stars;
            if (data.isGoalie !== undefined) user.isGoalie = data.isGoalie;
            await user.save();
        }

        // Se for MENSALISTA, criar membership automaticamente
        if (data.type === 'MENSALISTA') {
            const today = new Date();
            const nextDueDate = MembershipRepository.calculateNextDueDate(today);

            await this.membershipRepo.createMembership({
                workspaceId: data.workspaceId,
                userId: user._id.toString(),
                planValue: 5000, // R$50 padrão (pode vir de workspace settings)
                startDate: today,
                nextDueDate: nextDueDate,
                status: 'ACTIVE' as any,
                notes: 'Criado automaticamente via cadastro de jogador'
            });
        }

        return this.toResponseDto(user);
    }

    /**
     * Atualiza um jogador
     */
    async updatePlayer(id: string, data: UpdatePlayerDto): Promise<PlayerResponseDto> {
        const user = await this.userRepository.findById(id);
        if (!user) {
            throw new Error('Jogador não encontrado');
        }

        if (data.phoneE164 && data.phoneE164 !== user.phoneE164) {
            const exists = await this.userRepository.exists(data.phoneE164, id);
            if (exists) {
                throw new Error('Já existe um jogador com este telefone');
            }
        }

        // Separate workspaceId from user update data to avoid type errors
        const { workspaceId, ...userData } = data;

        const updated = await this.userRepository.update(id, userData);
        if (!updated) {
            throw new Error('Erro ao atualizar jogador');
        }

        // Update Workspace Member Role if provided
        if (workspaceId && data.role) {
            const member = await this.workspaceMemberModel.findOne({
                workspaceId: workspaceId,
                userId: user._id
            });

            if (member) {
                // Determine roles based on input
                // If admin, add ADMIN role. If user, ensure NO ADMIN role.
                let newRoles = member.roles || [];

                // Remove legacy mixed case if needed, but let's just handle the target state
                // Clean up existing admin roles
                newRoles = newRoles.filter(r => !['admin', 'ADMIN', 'owner', 'OWNER'].includes(r));

                if (data.role === 'admin') {
                    newRoles.push('ADMIN');
                } else {
                    newRoles.push('PLAYER'); // Default role
                }

                // Deduplicate
                member.roles = [...new Set(newRoles)];
                await member.save();
            }
        }

        return this.toResponseDto(updated);
    }

    /**
     * Deleta um jogador
     */
    async deletePlayer(id: string): Promise<void> {
        const user = await this.userRepository.findById(id);
        if (!user) {
            throw new Error('Jogador não encontrado');
        }

        const debts = await this.transactionRepository.findByUserId(user._id.toString(), undefined, {
            status: TransactionStatus.PENDING,
            type: TransactionType.INCOME
        });
        const hasPendingDebts = debts.length > 0;

        if (hasPendingDebts) {
            throw new Error('Não é possível deletar jogador com débitos pendentes');
        }

        await this.userRepository.delete(id);
    }

    /**
     * Suspende um jogador (não implementado no User model)
     */
    async suspendPlayer(id: string): Promise<PlayerResponseDto> {
        const user = await this.userRepository.findById(id);
        if (!user) {
            throw new Error('Jogador não encontrado');
        }
        return this.toResponseDto(user);
    }

    /**
     * Ativa um jogador (não implementado no User model)
     */
    async activatePlayer(id: string): Promise<PlayerResponseDto> {
        const user = await this.userRepository.findById(id);
        if (!user) {
            throw new Error('Jogador não encontrado');
        }
        return this.toResponseDto(user);
    }

    /**
     * Obtém estatísticas de jogadores
     */
    async getStats(): Promise<PlayersStatsDto> {
        const stats = await this.userRepository.getStats();

        const debtStats = await this.transactionRepository['model'].aggregate([
            {
                $match: {
                    type: TransactionType.INCOME,
                    status: TransactionStatus.PENDING
                }
            },
            {
                $group: {
                    _id: '$userId',
                    totalDebt: { $sum: '$amount' }
                }
            },
            {
                $match: {
                    totalDebt: { $gt: 0 }
                }
            },
            {
                $group: {
                    _id: null,
                    withDebts: { $sum: 1 },
                    totalDebt: { $sum: '$totalDebt' }
                }
            }
        ]);

        const debtData = debtStats[0] || { withDebts: 0, totalDebt: 0 };

        return {
            total: stats.total,
            active: stats.active,
            inactive: stats.inactive,
            suspended: 0,
            withDebts: debtData.withDebts,
            totalDebt: debtData.totalDebt / 100,
        };
    }

    /**
     * Obtém débitos de um jogador
     */
    async getPlayerDebts(id: string) {
        const user = await this.userRepository.findById(id);
        if (!user) {
            throw new Error('Jogador não encontrado');
        }

        // Retorna Transactions pendentes
        return this.transactionRepository.findByUserId(user._id.toString(), undefined, {
            status: TransactionStatus.PENDING,
            type: TransactionType.INCOME
        });
    }

    /**
     * Obtém jogos de um jogador
     */
    async getPlayerGames(id: string) {
        const user = await this.userRepository.findById(id);
        if (!user) {
            throw new Error('Jogador não encontrado');
        }

        const games = await this.gameRepository.findOpenGamesForUser(user._id);

        return games.map((game: any) => ({
            id: game._id.toString(),
            title: game.title || 'Jogo',
            date: game.date.toISOString().split('T')[0],
            time: game.date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }),
            status: game.status,
            priceCents: game.priceCents || 0,
            chatId: game.chatId,
            workspaceId: game.workspaceId?.toString(),
            currentPlayers: game.roster?.players?.length || 0,
            maxPlayers: game.maxPlayers || 16,
            playerInfo: {
                slot: game.roster?.players?.find((p: any) =>
                    p.userId?.toString() === user._id.toString() ||
                    p.invitedByUserId?.toString() === user._id.toString()
                )?.slot,
                paid: game.roster?.players?.find((p: any) =>
                    p.userId?.toString() === user._id.toString() ||
                    p.invitedByUserId?.toString() === user._id.toString()
                )?.paid || false,
                isGuest: game.roster?.players?.find((p: any) =>
                    p.invitedByUserId?.toString() === user._id.toString()
                )?.guest || false
            }
        }));
    }

    /**
     * Obtém movimentações (transações) de um jogador com paginação
     */
    async getPlayerTransactions(id: string, page: number = 1, limit: number = 20) {
        const user = await this.userRepository.findById(id);
        if (!user) {
            throw new Error('Jogador não encontrado');
        }

        const transactions = await this.transactionRepository.findByUserId(user._id.toString());

        // Manual pagination
        const total = transactions.length;
        const start = (page - 1) * limit;
        const end = start + limit;
        const paged = transactions.slice(start, end);

        return {
            ledgers: paged,
            total,
            page,
            totalPages: Math.ceil(total / limit),
            limit
        };
    }

    /**
     * Adiciona crédito ao jogador
     */
    async addCredit(id: string, data: {
        workspaceId: string;
        amountCents: number;
        note?: string;
        method?: string;
        category?: string;
    }) {
        const user = await this.userRepository.findById(id);
        if (!user) {
            throw new Error('Jogador não encontrado');
        }

        await this.transactionRepository.createTransaction({
            workspaceId: data.workspaceId,
            userId: user._id.toString(),
            type: TransactionType.INCOME,
            category: (data.category as any) || TransactionCategory.OTHER,
            status: TransactionStatus.COMPLETED,
            amount: data.amountCents,
            dueDate: new Date(),
            paidAt: new Date(),
            description: data.note || 'Crédito adicionado',
            method: data.method as any
        });

        return this.toResponseDto(user);
    }
}

export const PLAYERS_SERVICE_TOKEN = 'PLAYERS_SERVICE_TOKEN';
