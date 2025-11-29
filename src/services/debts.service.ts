import { injectable, inject } from 'tsyringe';
import { LedgerRepository, LEDGER_REPOSITORY_TOKEN } from '../core/repositories/ledger.repository';
import { USER_REPOSITORY_TOKEN, UserRepository } from '../core/repositories/user.repository';
import { GameRepository, GAME_REPOSITORY_TOKEN } from '../core/repositories/game.respository';
import { WhatsAppService } from './whatsapp.service';
import { GameService } from './game.service';
import {
    CreateDebtDto,
    UpdateDebtDto,
    PayDebtDto,
    DebtResponseDto,
    ListDebtsDto,
    PaginatedDebtsResponseDto,
    DebtsStatsDto,
    SendRemindersDto,
} from '../api/dto/debt.dto';
import { Types, FlattenMaps } from 'mongoose';
import { LedgerDoc } from '../core/models/ledger.model';

@injectable()
export class DebtsService {
    constructor(
        @inject(LEDGER_REPOSITORY_TOKEN) private readonly ledgerRepository: LedgerRepository,
        @inject(USER_REPOSITORY_TOKEN) private readonly userRepository: UserRepository,
        @inject(GAME_REPOSITORY_TOKEN) private readonly gameRepository: GameRepository,
        @inject(WhatsAppService) private readonly whatsappService: WhatsAppService,
        @inject(GameService) private readonly gameService: GameService
    ) { }

    /**
     * Converte documento do ledger para DTO de resposta
     */
    private async toResponseDto(ledger: LedgerDoc | FlattenMaps<LedgerDoc>): Promise<DebtResponseDto> {
        let playerName = 'Desconhecido';
        let gameName: string | undefined;

        if (ledger.userId) {
            const player = await this.userRepository.findById(ledger.userId.toString());
            if (player) {
                playerName = player.name;
            }
        }

        if (ledger.gameId) {
            const game = await this.gameRepository.findById(ledger.gameId.toString());
            if (game) {
                gameName = game.title || `Jogo ${new Date(game.date).toLocaleDateString('pt-BR')}`;
            }
        }

        return {
            id: ledger._id.toString(),
            playerId: ledger.userId?.toString() || '',
            playerName,
            gameId: ledger.gameId?.toString(),
            gameName,
            workspaceId: ledger.workspaceId.toString(),
            amount: ledger.amountCents / 100,
            amountCents: ledger.amountCents,
            status: ledger.status,
            notes: ledger.note,
            category: ledger.category,
            createdAt: ledger.createdAt.toISOString(),
            paidAt: ledger.confirmedAt?.toISOString(),
            updatedAt: ledger.updatedAt?.toISOString() || ledger.createdAt.toISOString(),
        };
    }


    /**
     * Cria um novo débito
     */
    async createDebt(data: CreateDebtDto): Promise<DebtResponseDto> {
        if (!data.playerId || !data.workspaceId || !data.amount) {
            throw new Error('Jogador, workspace e valor são obrigatórios');
        }

        if (data.amount <= 0) {
            throw new Error('Valor deve ser maior que zero');
        }

        const player = await this.userRepository.findById(data.playerId);
        if (!player) {
            throw new Error('Jogador não encontrado');
        }

        await this.ledgerRepository.addDebit({
            workspaceId: data.workspaceId,
            userId: data.playerId,
            gameId: data.gameId,
            amountCents: Math.round(data.amount * 100),
            note: data.notes,
            status: 'pendente',
            category: data.category || 'player-debt',
            method: 'pix',
        });

        // Recalcula o saldo do jogador
        await this.ledgerRepository.recomputeUserBalance(data.workspaceId, data.playerId);

        const ledgers = await this.ledgerRepository.findByUserId(new Types.ObjectId(data.playerId));
        const lastDebit = ledgers.find(l => l.type === 'debit');

        if (!lastDebit) {
            throw new Error('Erro ao criar débito');
        }

        return this.toResponseDto(lastDebit);
    }

    /**
     * Lista débitos com filtros
     */
    async listDebts(filters: ListDebtsDto): Promise<PaginatedDebtsResponseDto> {
        const page = filters.page || 1;
        const limit = filters.limit || 20;

        const query: any = { type: 'debit' };

        if (filters.workspaceId) {
            query.workspaceId = new Types.ObjectId(filters.workspaceId);
        }

        if (filters.playerId) {
            query.userId = new Types.ObjectId(filters.playerId);
        }

        if (filters.gameId) {
            query.gameId = new Types.ObjectId(filters.gameId);
        }

        const allDebts = await this.ledgerRepository['model']
            .find(query)
            .sort({ createdAt: -1 })
            .lean();

        const debtsDto = await Promise.all(
            allDebts.map((debt) => this.toResponseDto(debt))
        );

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const overdue = debtsDto.filter(d => d.status === 'pendente' && new Date(d.createdAt) < sevenDaysAgo).length;
        const debtsMonth = debtsDto.filter(d => d.createdAt >= new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString()).length;
        const pendingAmount = debtsDto.filter(d => d.status === 'pendente').reduce((acc, debt) => acc + debt.amount, 0);
        const paidAmount = debtsDto.filter(d => d.status === 'confirmado').reduce((acc, debt) => acc + debt.amount, 0);

        let filteredDebts = debtsDto;
        if (filters.status && filters.status !== 'all') {
            filteredDebts = debtsDto.filter(d => d.status === filters.status);
        }

        const total = filteredDebts.length;
        const start = (page - 1) * limit;
        const paginatedDebts = filteredDebts.slice(start, start + limit);

        return {
            debts: paginatedDebts,
            overdue,
            debtsMonth,
            pendingAmount,
            paidAmount,
            total,
            page,
            totalPages: Math.ceil(total / limit),
            limit,
        };
    }

    /**
     * Obtém um débito por ID
     */
    async getDebtById(id: string): Promise<DebtResponseDto> {
        const ledger = await this.ledgerRepository['model'].findById(id).lean();
        if (!ledger) {
            throw new Error('Débito não encontrado');
        }
        return this.toResponseDto(ledger);
    }

    /**
     * Registra pagamento de débito
     */
    async payDebt(id: string, data: PayDebtDto): Promise<DebtResponseDto> {
        const ledger = await this.ledgerRepository['model'].findById(id);
        if (!ledger) {
            throw new Error('Débito não encontrado');
        }

        if (ledger.type !== 'debit') {
            throw new Error('Este registro não é um débito');
        }

        await this.ledgerRepository.addCredit({
            workspaceId: ledger.workspaceId.toString(),
            userId: ledger.userId!.toString(),
            gameId: ledger.gameId?.toString(),
            amountCents: data.amount ? Math.round(data.amount * 100) : ledger.amountCents,
            method: data.method || 'pix',
            note: data.notes || `Pagamento de débito ${id}`,
            category: 'player-payment',
        });

        await this.ledgerRepository['model'].findByIdAndUpdate(id, {
            status: 'confirmado',
            confirmedAt: new Date(),
        });

        await this.ledgerRepository.recomputeUserBalance(ledger.workspaceId.toString(), ledger.userId!.toString());

        return this.getDebtById(id);
    }

    /**
     * Cancela um débito
     */
    async cancelDebt(id: string): Promise<void> {
        const ledger = await this.ledgerRepository['model'].findById(id).lean();
        if (!ledger) {
            throw new Error('Débito não encontrado');
        }
        await this.ledgerRepository['model'].findByIdAndUpdate(id, {
            status: 'estornado',
        });
    }

    async getStats(workspaceId?: string): Promise<DebtsStatsDto> {
        const query: any = {};
        if (workspaceId) {
            query.workspaceId = new Types.ObjectId(workspaceId);
        }

        const allLedgers = await this.ledgerRepository['model'].find(query).lean();

        const debits = allLedgers.filter(l => l.type === 'debit');
        const credits = allLedgers.filter(l => l.type === 'credit' && l.status === 'confirmado');
        const debitsDto = await Promise.all(debits.map(d => this.toResponseDto(d)));

        const pending = debitsDto.filter(d => d.status === 'pendente');
        const paid = debitsDto.filter(d => d.status === 'confirmado');

        const fiveDaysAgo = new Date();
        fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
        const overdue = debitsDto.filter(d => {
            if (d.status !== 'pendente') return false;
            const createdDate = new Date(d.createdAt);
            return createdDate < fiveDaysAgo;
        });

        const thisMonth = debitsDto.filter(d => {
            const date = new Date(d.createdAt);
            const now = new Date();
            return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
        });

        const totalDebitsAmount = debits.reduce((sum, d) => sum + d.amountCents, 0);
        const totalCreditsAmount = credits.reduce((sum, c) => sum + c.amountCents, 0);

        return {
            totalPending: pending.length,
            totalPendingAmount: pending.reduce((sum, d) => sum + d.amountCents, 0),
            totalPaid: paid.length,
            totalPaidAmount: totalCreditsAmount,
            totalOverdue: overdue.length,
            totalOverdueAmount: overdue.reduce((sum, d) => sum + d.amountCents, 0),
            thisMonth: thisMonth.length,
            thisMonthAmount: thisMonth.reduce((sum, d) => sum + d.amountCents, 0),
            totalDebitsAmount,
        };
    }

    /**
     * Envia lembretes de pagamento
     */
    async sendReminders(data: SendRemindersDto): Promise<{ sent: number; failed: number }> {
        let debts: DebtResponseDto[] = [];

        if (data.debtIds && data.debtIds.length > 0) {
            debts = await Promise.all(
                data.debtIds.map(id => this.getDebtById(id))
            );
        } else if (data.workspaceId) {
            const result = await this.listDebts({
                workspaceId: data.workspaceId,
                status: data.onlyOverdue ? 'pendente' : 'pendente',
                limit: 1000,
            });
            debts = result.debts;
        }

        let sent = 0;
        let failed = 0;

        for (const debt of debts) {
            try {
                const player = await this.userRepository.findById(debt.playerId);
                if (player && player.phoneE164) {
                    const message = `🔔 Lembrete de Pagamento\n\nOlá ${player.name}!\n\nVocê possui um débito pendente de R$ ${debt.amount.toFixed(2)}.\n\n${debt.notes || ''}\n\nPor favor, realize o pagamento o quanto antes.`;

                    await this.whatsappService.sendMessage(player.phoneE164, message);
                    sent++;
                }
            } catch (error) {
                failed++;
            }
        }

        return { sent, failed };
    }
}

export const DEBTS_SERVICE_TOKEN = 'DEBTS_SERVICE_TOKEN';
