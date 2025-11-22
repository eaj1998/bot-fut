import { injectable, inject } from 'tsyringe';
import { UserRepository } from '../core/repositories/user.repository';
import { LedgerRepository, LEDGER_REPOSITORY_TOKEN } from '../core/repositories/ledger.repository';
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
        @inject(LEDGER_REPOSITORY_TOKEN) private readonly ledgerRepository: LedgerRepository
    ) { }

    /**
     * Converte documento do usuário para DTO de resposta
     */
    private async toResponseDto(user: any): Promise<PlayerResponseDto> {
        const balance = await this.ledgerRepository.getBalance(user._id);
        const debts = await this.ledgerRepository.findByUserId(user._id);
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
            status: 'active',
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

        return {
            players,
            total,
            page: filters.page || 1,
            totalPages: Math.ceil(total / (filters.limit || 20)),
            limit: filters.limit || 20,
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

        return this.ledgerRepository.findByUserId(user._id);
    }

    /**
     * Obtém jogos de um jogador
     */
    async getPlayerGames(id: string) {
        const user = await this.userRepository.findById(id);
        if (!user) {
            throw new Error('Jogador não encontrado');
        }

        return [];
    }
}

export const PLAYERS_SERVICE_TOKEN = 'PLAYERS_SERVICE_TOKEN';
