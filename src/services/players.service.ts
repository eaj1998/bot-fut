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
    PlayerProfileDto,
    UpdateProfileDto
} from '../api/dto/player.dto';
import { LoggerService } from '../logger/logger.service';
import { normalizePhone, isValidBrazilianPhone, removeExtraNine, validateAndFormatPhone } from '../utils/phone.util';

@injectable()
export class PlayersService {
    constructor(
        @inject('USER_REPOSITORY_TOKEN') private readonly userRepository: UserRepository,
        @inject(GAME_REPOSITORY_TOKEN) private readonly gameRepository: GameRepository,
        @inject(TRANSACTION_REPOSITORY_TOKEN) private readonly transactionRepository: TransactionRepository,
        @inject(MEMBERSHIP_REPOSITORY_TOKEN) private readonly membershipRepo: MembershipRepository,
        @inject(WORKSPACE_MEMBER_MODEL_TOKEN) private readonly workspaceMemberModel: Model<IWorkspaceMember>,
        @inject(LoggerService) private readonly loggerService: LoggerService
    ) { }

    /**
     * Converte documento do usuário para DTO de resposta
     */
    private async toResponseDto(user: any, workspaceId?: string): Promise<PlayerResponseDto> {
        const balance = 0;

        const debts = await this.transactionRepository.findByUserId(user._id.toString(), undefined, {
            status: TransactionStatus.PENDING,
            type: TransactionType.INCOME
        });
        const totalDebt = debts.reduce((sum, d) => sum + d.amount, 0);

        let role = user.role || 'user';
        if (workspaceId) {
            const member = await this.workspaceMemberModel.findOne({ workspaceId, userId: user._id });
            if (member && member.roles && member.roles.length > 0) {
                if (member.roles.includes('ADMIN') || member.roles.includes('admin') || member.roles.includes('owner')) {
                    role = 'admin';
                } else {
                    role = 'user';
                }
            }
        }

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
            role: role,
            joinDate: user.createdAt?.toISOString() || new Date().toISOString(),
            lastActivity: user.updatedAt?.toISOString() || user.createdAt?.toISOString() || new Date().toISOString(),
            createdAt: user.createdAt?.toISOString() || new Date().toISOString(),
            updatedAt: user.updatedAt?.toISOString() || new Date().toISOString(),
            profile: user.profile ? {
                mainPosition: user.profile.mainPosition,
                secondaryPositions: user.profile.secondaryPositions,
                dominantFoot: user.profile.dominantFoot,
                rating: user.profile.rating
            } : undefined
        };
    }

    /**
     * Lista jogadores com filtros e paginação
     */
    async listPlayers(filters: ListPlayersDto): Promise<PaginatedPlayersResponseDto> {
        const { users, total } = await this.userRepository.findAll(filters);

        const players = await Promise.all(
            users.map((user) => this.toResponseDto(user, filters.workspaceId))
        );

        const stats = await this.userRepository.getStats();

        const debtStats = await this.transactionRepository.getDebtStats();
        const withDebtsCount = debtStats.count;

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

        data.phoneE164 = validateAndFormatPhone(data.phoneE164);
        const normalizedPhone = normalizePhone(data.phoneE164);

        if (!normalizedPhone || !isValidBrazilianPhone(data.phoneE164)) {
            throw new Error('Formato de telefone inválido');
        }

        const existingUser = await this.userRepository['model'].findOne({ phoneE164: normalizedPhone });
        if (existingUser) {
            const existingMembership = await this.membershipRepo.findByUserId(
                existingUser._id.toString(),
                data.workspaceId
            );
            if (existingMembership) {
                throw new Error('Já existe um jogador com este telefone neste workspace');
            }
        }

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

            const memberExists = await this.workspaceMemberModel.exists({
                workspaceId: data.workspaceId,
                userId: user._id
            });

            if (!memberExists) {
                await this.workspaceMemberModel.create({
                    workspaceId: data.workspaceId,
                    userId: user._id,
                    roles: ['PLAYER'],
                    status: 'ACTIVE',
                    nickname: data.name
                });
            }

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

        return this.toResponseDto(user, data.workspaceId);
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


        const { workspaceId, ...userData } = data;

        if (userData.phoneE164) {
            userData.phoneE164 = validateAndFormatPhone(userData.phoneE164);
        }

        if (userData.phoneE164) {
            const normalized = normalizePhone(userData.phoneE164);
            if (normalized) userData.phoneE164 = normalized;
        }

        // Handle profile update
        if (data.profile) {
            // Ensure profile object exists
            if (!userData.profile) {
                // @ts-ignore
                userData.profile = {};
            }

            // Merge profile data
            // @ts-ignore
            userData.profile = {
                rating: 3.0,
                ratingCount: 0,
                // @ts-ignore
                ...(user.profile || {}),
                ...data.profile
            };

            // Sync legacy fields
            if (data.profile.mainPosition) {
                if (data.profile.mainPosition === 'GOL') {
                    userData.isGoalie = true;
                    // @ts-ignore
                    userData.position = 'GOALKEEPER';
                } else {
                    // Update legacy position based on mainPosition
                    switch (data.profile.mainPosition) {
                        case 'ZAG':
                        case 'LAT':
                            // @ts-ignore
                            userData.position = 'DEFENDER';
                            break;
                        case 'MEI':
                            // @ts-ignore
                            userData.position = 'MIDFIELDER';
                            break;
                        case 'ATA':
                            // @ts-ignore
                            userData.position = 'STRIKER';
                            break;
                    }
                }
            }
        }

        this.loggerService.info('UserData for update:', { id, userData });

        const updated = await this.userRepository.update(id, userData as any);
        if (!updated) {
            this.loggerService.error('Update returned null for player:', { id });
            throw new Error('Erro ao atualizar jogador');
        }

        if (workspaceId && data.role) {
            const member = await this.workspaceMemberModel.findOne({
                workspaceId: workspaceId,
                userId: user._id
            });

            if (member) {
                let newRoles = member.roles || [];

                newRoles = newRoles.filter(r => !['admin', 'ADMIN', 'owner', 'OWNER'].includes(r));

                if (data.role === 'admin') {
                    newRoles.push('ADMIN');
                } else {
                    newRoles.push('PLAYER');
                }

                member.roles = [...new Set(newRoles)];
                await member.save();
            } else {
                await this.workspaceMemberModel.create({
                    workspaceId: workspaceId,
                    userId: user._id,
                    roles: ['PLAYER']
                });
            }
        }

        return this.toResponseDto(updated, workspaceId);
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

        const debtStats = await this.transactionRepository.getDebtStats();
        const debtData = { withDebts: debtStats.count, totalDebt: debtStats.totalAmount };

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

    /**
     * Obtém o perfil do jogador
     */
    async getProfile(userId: string): Promise<PlayerProfileDto> {
        const user = await this.userRepository.findById(userId);
        if (!user) {
            throw new Error('Jogador não encontrado');
        }

        return {
            name: user.name,
            mainPosition: user.profile?.mainPosition || 'MEI',
            secondaryPositions: user.profile?.secondaryPositions || [],
            dominantFoot: user.profile?.dominantFoot || 'RIGHT',
            rating: user.profile?.rating || 3.0,
            ratingCount: user.profile?.ratingCount || 0
        };
    }

    /**
     * Atualiza o perfil do jogador
     */
    async updateProfile(userId: string, data: UpdateProfileDto): Promise<PlayerProfileDto> {
        const user = await this.userRepository.findById(userId);
        if (!user) {
            throw new Error('Jogador não encontrado');
        }

        if (!user.profile) {
            user.name = data.name;
            user.profile = {
                mainPosition: data.mainPosition as any,
                secondaryPositions: (data.secondaryPositions || []) as any,
                dominantFoot: data.dominantFoot,
                rating: 3.0,
                ratingCount: 0
            };
        } else {
            user.name = data.name;
            user.profile.mainPosition = data.mainPosition as any;
            user.profile.secondaryPositions = (data.secondaryPositions || []) as any;
            user.profile.dominantFoot = data.dominantFoot;
        }

        await user.save();

        return {
            name: user.name,
            mainPosition: user.profile.mainPosition || 'MEI',
            secondaryPositions: user.profile.secondaryPositions || [],
            dominantFoot: user.profile.dominantFoot || 'RIGHT',
            rating: user.profile.rating || 3.0,
            ratingCount: user.profile.ratingCount || 0
        };
    }
    /**
     * Obtém jogadores que podem ser avaliados
     */
    async getRateablePlayers(currentUserId: string): Promise<PlayerResponseDto[]> {
        const users = await this.userRepository.findActiveUsersExcluding(currentUserId);

        // Mapeia para DTO simplificado
        return users.map(user => ({
            id: user._id.toString(),
            name: user.name,
            phone: user.phoneE164,
            isGoalie: user.isGoalie || false,
            status: user.status || 'active',
            role: user.role || 'user',
            // Campos opcionais
            nick: user.nick,
            profile: {
                mainPosition: user.profile?.mainPosition || 'MEI',
                secondaryPositions: user.profile?.secondaryPositions || [],
                dominantFoot: user.profile?.dominantFoot || 'RIGHT',
                rating: user.profile?.rating || 3.0,
                ratingCount: user.profile?.ratingCount || 0
            }
        } as unknown as PlayerResponseDto));
    }
}

export const PLAYERS_SERVICE_TOKEN = 'PLAYERS_SERVICE_TOKEN';
