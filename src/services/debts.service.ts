import { injectable, inject } from 'tsyringe';
import { LedgerRepository, LEDGER_REPOSITORY_TOKEN } from '../core/repositories/ledger.repository';
import { USER_REPOSITORY_TOKEN, UserRepository } from '../core/repositories/user.repository';
import { GameRepository, GAME_REPOSITORY_TOKEN } from '../core/repositories/game.respository';
import { WhatsAppService } from './whatsapp.service';
import { GameService } from './game.service';
import { BBQService, BBQ_SERVICE_TOKEN } from './bbq.service';
import {
    CreateDebtDto,
    PayDebtDto,
    DebtResponseDto,
    ListDebtsDto,
    PaginatedDebtsResponseDto,
    DebtsStatsDto,
    SendRemindersDto,
} from '../api/dto/debt.dto';
import { Types, FlattenMaps } from 'mongoose';
import { LedgerDoc } from '../core/models/ledger.model';
import axios from 'axios';
import { EncryptionUtil } from '../utils/encryption.util';
import { WorkspaceRepository } from '../core/repositories/workspace.repository';

@injectable()
export class DebtsService {
    constructor(
        @inject(LEDGER_REPOSITORY_TOKEN) private readonly ledgerRepository: LedgerRepository,
        @inject(USER_REPOSITORY_TOKEN) private readonly userRepository: UserRepository,
        @inject(GAME_REPOSITORY_TOKEN) private readonly gameRepository: GameRepository,
        @inject(WhatsAppService) private readonly whatsappService: WhatsAppService,
        @inject(GameService) private readonly gameService: GameService,
        @inject(WorkspaceRepository) private readonly workspaceRepository: WorkspaceRepository,
        @inject(BBQ_SERVICE_TOKEN) private readonly bbqService: BBQService
    ) { }

    /**
     * Converte documento do ledger para DTO de resposta
     */
    private async toResponseDto(ledger: LedgerDoc | FlattenMaps<LedgerDoc>): Promise<DebtResponseDto> {
        let playerName = 'Desconhecido';
        let gameName: string | undefined;
        let slot: number | undefined;

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

                if (ledger.userId && game.roster?.players) {
                    const playerInGame = game.roster.players.find(p => p.userId?.toString() === ledger.userId?.toString());
                    if (playerInGame) {
                        slot = playerInGame.slot;
                    }
                }
            }
        }

        return {
            id: ledger._id.toString(),
            playerId: ledger.userId?.toString() || '',
            playerName,
            gameId: ledger.gameId?.toString(),
            gameName,
            slot,
            workspaceId: ledger.workspaceId.toString(),
            amount: ledger.amountCents / 100,
            amountCents: ledger.amountCents,
            status: ledger.status,
            notes: ledger.note,
            type: ledger.type,
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
        if (!data.workspaceId || !data.amount) {
            throw new Error('Workspace e valor são obrigatórios');
        }

        if (data.amount <= 0) {
            throw new Error('Valor deve ser maior que zero');
        }

        if (data.playerId) {
            const player = await this.userRepository.findById(data.playerId);
            if (!player) {
                throw new Error('Jogador não encontrado');
            }
        }

        let organizzeId: number | undefined;

        // Integração com Organizze
        try {
            const workspace = await this.workspaceRepository.findById(data.workspaceId);
            if (workspace?.organizzeConfig?.email && workspace.organizzeConfig.apiKey && workspace.organizzeConfig.accountId) {
                const config = workspace.organizzeConfig;
                const email = EncryptionUtil.decrypt(config.email);
                const apiKey = EncryptionUtil.decrypt(config.apiKey);

                let categoryId = config.categories.general;
                if (data.category === 'field-payment') categoryId = config.categories.fieldPayment;
                if (data.category === 'player-payment') categoryId = config.categories.playerPayment;
                if (data.category === 'player-debt') categoryId = config.categories.playerDebt;

                const payload = {
                    description: data.notes || (data.playerId ? `Débito Jogador` : `Débito Geral`),
                    amount_cents: -Math.round(data.amount * 100), // Negativo para despesas
                    date: new Date().toISOString().split('T')[0],
                    account_id: config.accountId,
                    category_id: categoryId,
                    paid: data.status === 'confirmado',
                    observation: data.playerId ? `PlayerID: ${data.playerId}` : undefined
                };

                const res = await axios.post(
                    "https://api.organizze.com.br/rest/v2/transactions",
                    payload,
                    {
                        auth: { username: email, password: apiKey },
                        headers: {
                            "Content-Type": "application/json",
                            "User-Agent": "BotFutebol"
                        }
                    }
                );

                if (res.status === 201 && res.data?.id) {
                    organizzeId = res.data.id;
                }
            }
        } catch (error) {
            console.error('Erro ao criar transação no Organizze:', error);
        }

        await this.ledgerRepository.addDebit({
            workspaceId: data.workspaceId,
            userId: data.playerId || undefined,
            gameId: data.gameId,
            amountCents: Math.round(data.amount * 100),
            note: data.notes,
            status: data.status || 'pendente',
            category: data.category || 'player-debt',
            method: 'pix',
            organizzeId,
        });

        if (data.playerId) {
            await this.ledgerRepository.recomputeUserBalance(data.workspaceId, data.playerId);
        }

        if (data.playerId) {
            const ledgers = await this.ledgerRepository.findByUserId(new Types.ObjectId(data.playerId));
            const lastDebit = ledgers.find(l => l.type === 'debit');
            if (lastDebit) {
                return this.toResponseDto(lastDebit);
            }
        }

        return {
            id: 'new',
            playerId: data.playerId || '',
            playerName: 'N/A',
            workspaceId: data.workspaceId,
            amount: data.amount,
            amountCents: Math.round(data.amount * 100),
            status: 'pendente',
            notes: data.notes,
            category: data.category || 'player-debt',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
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
     * Registra pagamento de débito (CENTRALIZADO)
     * Detecta automaticamente se é débito de jogo ou geral e executa a lógica apropriada
     */
    async payDebt(id: string, data: PayDebtDto): Promise<DebtResponseDto> {
        const ledger = await this.ledgerRepository['model'].findById(id);
        if (!ledger) {
            throw new Error('Débito não encontrado');
        }

        if (ledger.type !== 'debit') {
            throw new Error('Este registro não é um débito');
        }

        // DETECÇÃO: Débito de jogo vs débito geral
        const isGameDebt = !!ledger.gameId;

        if (isGameDebt) {
            // FLUXO DE JOGO: Usa GameService para marcar pagamento
            // Isso atualiza o roster do jogo, cria crédito, e atualiza Organizze
            const game = await this.gameRepository.findById(ledger.gameId!);
            if (!game) {
                throw new Error('Jogo não encontrado');
            }

            // Encontra o slot do jogador no jogo
            const player = game.roster.players.find(p =>
                p.userId?.toString() === ledger.userId?.toString()
            );

            if (!player || typeof player.slot !== 'number') {
                throw new Error('Jogador não encontrado no jogo');
            }

            // Marca como pago no jogo (isso já cria crédito e atualiza Organizze)
            await this.gameService.markAsPaid(
                game._id,
                player.slot,
                { method: data.method || 'pix' }
            );

            // Marca o débito como confirmado
            await this.ledgerRepository['model'].findByIdAndUpdate(id, {
                status: 'confirmado',
                confirmedAt: new Date(),
            });

        } else {
            // FLUXO GERAL: Cria crédito diretamente
            // Ajusta categoria se necessário
            let creditCategory = data.category || 'player-payment';
            if (data.category === 'player-debt') {
                creditCategory = 'player-payment';
            }

            await this.ledgerRepository.addCredit({
                workspaceId: ledger.workspaceId.toString(),
                userId: ledger.userId!.toString(),
                gameId: ledger.gameId?.toString(),
                amountCents: data.amount ? Math.round(data.amount * 100) : ledger.amountCents,
                method: data.method || 'pix',
                note: data.notes || `Pagamento de débito ${id}`,
                category: creditCategory,
            });

            await this.ledgerRepository['model'].findByIdAndUpdate(id, {
                status: 'confirmado',
                confirmedAt: new Date(),
            });

            // Atualiza Organizze se existir ID
            if (ledger.organizzeId) {
                try {
                    const workspace = await this.workspaceRepository.findById(ledger.workspaceId.toString());
                    if (workspace?.organizzeConfig?.email && workspace.organizzeConfig.apiKey) {
                        const email = EncryptionUtil.decrypt(workspace.organizzeConfig.email);
                        const apiKey = EncryptionUtil.decrypt(workspace.organizzeConfig.apiKey);

                        await axios.put(
                            `https://api.organizze.com.br/rest/v2/transactions/${ledger.organizzeId}`,
                            { paid: true },
                            {
                                auth: { username: email, password: apiKey },
                                headers: {
                                    "Content-Type": "application/json",
                                    "User-Agent": "BotFutebol"
                                }
                            }
                        );
                    }
                } catch (error) {
                    console.error('Erro ao atualizar transação no Organizze:', error);
                }
            }

            await this.ledgerRepository.recomputeUserBalance(ledger.workspaceId.toString(), ledger.userId!.toString());
        }

        // Check if this is a BBQ debt and if all BBQ debts are paid
        if (ledger.category === 'churrasco' && ledger.bbqId) {
            await this.bbqService.checkAndFinishBBQ(
                ledger.bbqId.toString(),
                ledger.workspaceId.toString()
            );
        }

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
            return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear() && d.type === 'credit';
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
