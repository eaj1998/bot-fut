import { injectable, inject } from 'tsyringe';
import { UserRepository } from '../core/repositories/user.repository';
import { LedgerRepository, LEDGER_REPOSITORY_TOKEN } from '../core/repositories/ledger.repository';
import { GameRepository, GAME_REPOSITORY_TOKEN } from '../core/repositories/game.respository';
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
        @inject(LEDGER_REPOSITORY_TOKEN) private readonly ledgerRepository: LedgerRepository,
        @inject(GAME_REPOSITORY_TOKEN) private readonly gameRepository: GameRepository
    ) { }

    /**
     * Converte documento do usuário para DTO de resposta
     */
    private async toResponseDto(user: any): Promise<PlayerResponseDto> {
        const balance = await this.ledgerRepository.getBalance(user._id);
        const debts = await this.ledgerRepository.findDebtsByUserId(user._id);
        const totalDebt = debts
            .filter(d => d.type === 'debit' && d.status === 'pendente')
            .reduce((sum, d) => sum + d.amountCents, 0);

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

        const activeCount = players.filter(p => p.status === 'active').length;
        const inactiveCount = players.filter(p => p.status === 'inactive').length;
        const withDebtsCount = players.filter(p => p.totalDebt > 0).length;

        return {
            players,
            total,
            page: filters.page || 1,
            totalPages: Math.ceil(total / (filters.limit || 20)),
            limit: filters.limit || 20,
            activeCount,
            withDebtsCount,
            inactiveCount,
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
     * Cria um novo jogador
     */
    async createPlayer(data: CreatePlayerDto): Promise<PlayerResponseDto> {
        if (!data.name || !data.phoneE164) {
            throw new Error('Nome e telefone são obrigatórios');
        }

        const exists = await this.userRepository.exists(data.phoneE164);
        if (exists) {
            throw new Error('Já existe um jogador com este telefone');
        }

        const user = await this.userRepository.create({
            name: data.name,
            phoneE164: data.phoneE164,
            nick: data.nick,
            isGoalie: data.isGoalie || false,
            role: data.role || 'user',
        });

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

        const updated = await this.userRepository.update(id, data);
        if (!updated) {
            throw new Error('Erro ao atualizar jogador');
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

        const debts = await this.ledgerRepository.findByUserId(user._id);
        const hasPendingDebts = debts.some(d => d.type === 'debit' && d.status === 'pendente');

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

        const allUsers = await this.userRepository.findAll({ limit: 10000 });
        let withDebts = 0;
        let totalDebt = 0;

        for (const user of allUsers.users) {
            const debts = await this.ledgerRepository.findByUserId(user._id);
            const userDebt = debts
                .filter(d => d.type === 'debit' && d.status === 'pendente')
                .reduce((sum, d) => sum + d.amountCents, 0);

            if (userDebt > 0) {
                withDebts++;
                totalDebt += userDebt;
            }
        }

        return {
            total: stats.total,
            active: stats.total,
            inactive: 0,
            suspended: 0,
            withDebts,
            totalDebt: totalDebt / 100,
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

        return this.ledgerRepository.findDebtsByUserId(user._id);
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
            date: game.date,
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

        return this.ledgerRepository.findByUserIdPaginated(user._id, page, limit);
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

        await this.ledgerRepository.addCredit({
            workspaceId: data.workspaceId,
            userId: user._id.toString(),
            amountCents: data.amountCents,
            note: data.note,
            method: data.method,
            category: data.category || 'player-payment'
        });

        return this.toResponseDto(user);
    }
}

export const PLAYERS_SERVICE_TOKEN = 'PLAYERS_SERVICE_TOKEN';
