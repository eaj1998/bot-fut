import { Request, Response } from 'express';
import { injectable, inject } from 'tsyringe';
import { BBQService, BBQ_SERVICE_TOKEN } from '../../services/bbq.service';
import { asyncHandler } from '../middleware/error.middleware';
import {
    CreateBBQDto,
    UpdateBBQDto,
    UpdateBBQStatusDto,
    BBQResponseDto,
    BBQFilterDto,
    BBQStatus,
    BBQStatsDto
} from '../dto/bbq.dto';
import { IBBQ } from '../../core/models/bbq.model';
import { BBQRepository, BBQ_REPOSITORY_TOKEN } from '../../core/repositories/bbq.repository';
import { LedgerRepository } from '../../core/repositories/ledger.repository';
import { WorkspaceRepository } from '../../core/repositories/workspace.repository';
import { LoggerService } from '../../logger/logger.service';
import axios from 'axios';

@injectable()
export class BBQController {
    constructor(
        @inject(BBQ_SERVICE_TOKEN) private bbqService: BBQService,
        @inject(BBQ_REPOSITORY_TOKEN) private bbqRepository: BBQRepository,
        @inject(LedgerRepository) private ledgerRepository: LedgerRepository,
        @inject(WorkspaceRepository) private workspaceRepository: WorkspaceRepository,
        @inject(LoggerService) private loggerService: LoggerService,
    ) { }

    private mapBBQToResponse(bbq: IBBQ): BBQResponseDto {
        return {
            id: bbq._id.toString(),
            chatId: bbq.chatId,
            workspaceId: bbq.workspaceId,
            status: bbq.status as BBQStatus,
            date: bbq.date.toISOString(),
            createdAt: bbq.createdAt.toISOString(),
            closedAt: bbq.closedAt?.toISOString(),
            finishedAt: bbq.finishedAt?.toISOString(),
            participants: bbq.participants.map(p => {
                const inviter = p.invitedBy
                    ? bbq.participants.find(participant => participant.userId === p.invitedBy)
                    : null;

                return {
                    userId: p.userId,
                    userName: p.userName,
                    invitedBy: p.invitedBy,
                    invitedByName: inviter?.userName || null,
                    isPaid: p.isPaid || false,
                    isGuest: p.isGuest || false,
                    debtId: p.debtId,
                };
            }),
            valuePerPerson: bbq.valuePerPerson,
            participantCount: bbq.participants.length,
        };
    }

    listBBQs = asyncHandler(async (req: Request, res: Response) => {
        const filters: BBQFilterDto = {
            status: req.query.status as BBQStatus,
            chatId: req.query.chatId as string,
            workspaceId: req.query.workspaceId as string,
            dateFrom: req.query.dateFrom as string,
            dateTo: req.query.dateTo as string,
            page: req.query.page ? parseInt(req.query.page as string) : 1,
            limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        };

        const query: any = {};

        if (filters.status) {
            query.status = filters.status;
        }

        if (filters.chatId) {
            query.chatId = filters.chatId;
        }

        if (filters.workspaceId) {
            query.workspaceId = filters.workspaceId;
        }

        if (filters.dateFrom || filters.dateTo) {
            query.date = {};
            if (filters.dateFrom) {
                query.date.$gte = new Date(filters.dateFrom);
            }
            if (filters.dateTo) {
                query.date.$lte = new Date(filters.dateTo);
            }
        }

        const page = filters.page || 1;
        const limit = filters.limit || 20;
        const skip = (page - 1) * limit;

        const [allBBQs, total] = await Promise.all([
            this.bbqRepository['model'].find(query).lean(),
            this.bbqRepository['model'].countDocuments(query),
        ]);

        const sortedBBQs = allBBQs.sort((a, b) => {
            const statusPriority: Record<string, number> = {
                'open': 0,
                'closed': 1,
                'finished': 2,
                'cancelled': 3
            };

            const priorityA = statusPriority[a.status] ?? 999;
            const priorityB = statusPriority[b.status] ?? 999;

            if (priorityA !== priorityB) {
                return priorityA - priorityB;
            }

            return new Date(b.date).getTime() - new Date(a.date).getTime();
        });

        const bbqs = sortedBBQs.slice(skip, skip + limit);

        const totalPages = Math.ceil(total / limit);

        res.json({
            success: true,
            data: {
                bbqs: bbqs.map(bbq => this.mapBBQToResponse(bbq as IBBQ)),
                total,
                page,
                totalPages,
                limit,
            },
        });
    });

    getBBQById = asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const bbq = await this.bbqRepository.findById(id);

        if (!bbq) {
            res.status(404).json({
                success: false,
                message: 'BBQ não encontrado',
            });
            return;
        }

        res.json({
            success: true,
            data: this.mapBBQToResponse(bbq),
        });
    });

    getStats = asyncHandler(async (req: Request, res: Response) => {
        const workspaceId = req.query.workspaceId as string;

        const query: any = {};
        if (workspaceId) {
            query.workspaceId = workspaceId;
        }

        const [total, open, closed, finished, cancelled] = await Promise.all([
            this.bbqRepository['model'].countDocuments(query),
            this.bbqRepository['model'].countDocuments({ ...query, status: 'open' }),
            this.bbqRepository['model'].countDocuments({ ...query, status: 'closed' }),
            this.bbqRepository['model'].countDocuments({ ...query, status: 'finished' }),
            this.bbqRepository['model'].countDocuments({ ...query, status: 'cancelled' }),
        ]);

        const stats: BBQStatsDto = {
            total,
            open,
            closed,
            finished,
            cancelled,
        };

        res.json({
            success: true,
            data: stats,
        });
    });

    createBBQ = asyncHandler(async (req: Request, res: Response) => {
        const dto: CreateBBQDto = req.body;


        let date: Date;
        if (dto.date) {
            const [year, month, day] = dto.date.split('-').map(Number);
            date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
        } else {
            date = new Date();
            date.setUTCHours(0, 0, 0, 0);
        }

        const bbq = await this.bbqRepository.create(
            dto.workspaceId,
            dto.chatId,
            date
        );

        if (dto.valuePerPerson) {
            await this.bbqRepository.setValue(bbq._id.toString(), dto.valuePerPerson);
        }

        const updatedBBQ = await this.bbqRepository.findById(bbq._id.toString());

        res.status(201).json({
            success: true,
            data: this.mapBBQToResponse(updatedBBQ!),
            message: 'BBQ criado com sucesso',
        });
    });

    updateBBQ = asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const dto: UpdateBBQDto = req.body;

        const bbq = await this.bbqRepository.findById(id);

        if (!bbq) {
            res.status(404).json({
                success: false,
                message: 'BBQ não encontrado',
            });
            return;
        }

        const updateData: any = {};

        if (dto.date) {
            const date = new Date(dto.date);
            date.setHours(0, 0, 0, 0);
            updateData.date = date;
        }

        if (dto.valuePerPerson !== undefined) {
            updateData.valuePerPerson = dto.valuePerPerson;
        }

        if (dto.status) {
            updateData.status = dto.status;

            if (dto.status === 'closed' && !bbq.closedAt) {
                updateData.closedAt = new Date();
            } else if (dto.status === 'finished' && !bbq.finishedAt) {
                updateData.finishedAt = new Date();
            }
        }

        const updatedBBQ = await this.bbqRepository['model'].findByIdAndUpdate(
            id,
            updateData,
            { new: true }
        ).lean();

        res.json({
            success: true,
            data: this.mapBBQToResponse(updatedBBQ as IBBQ),
            message: 'BBQ atualizado com sucesso',
        });
    });

    updateStatus = asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const { status }: UpdateBBQStatusDto = req.body;

        const bbq = await this.bbqRepository.findById(id);

        if (!bbq) {
            res.status(404).json({
                success: false,
                message: 'BBQ não encontrado',
            });
            return;
        }

        const updateData: any = { status };

        if (status === 'closed' && !bbq.closedAt) {
            updateData.closedAt = new Date();
        } else if (status === 'finished' && !bbq.finishedAt) {
            updateData.finishedAt = new Date();
        }

        const updatedBBQ = await this.bbqRepository['model'].findByIdAndUpdate(
            id,
            updateData,
            { new: true }
        ).lean();

        res.json({
            success: true,
            data: this.mapBBQToResponse(updatedBBQ as IBBQ),
            message: 'Status do BBQ atualizado com sucesso',
        });
    });

    closeBBQ = asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;

        const bbq = await this.bbqRepository.findById(id);

        if (!bbq) {
            res.status(404).json({
                success: false,
                message: 'BBQ não encontrado',
            });
            return;
        }

        if (bbq.status !== 'open') {
            res.status(400).json({
                success: false,
                message: 'BBQ já está fechado ou cancelado',
            });
            return;
        }

        if (!bbq.valuePerPerson || bbq.valuePerPerson === 0) {
            res.status(400).json({
                success: false,
                message: 'Defina o valor por pessoa antes de fechar o churrasco',
            });
            return;
        }

        if (bbq.participants.length === 0) {
            res.status(400).json({
                success: false,
                message: 'Não há participantes no churrasco',
            });
            return;
        }

        await this.bbqRepository.close(id);

        const updatedBBQ = await this.bbqRepository.findById(id);

        const totalParticipants = bbq.participants.length;
        const totalValue = (bbq.valuePerPerson / 100) * totalParticipants;

        res.json({
            success: true,
            data: this.mapBBQToResponse(updatedBBQ!),
            message: `Churrasco fechado! ${totalParticipants} participantes, total: R$ ${totalValue.toFixed(2)}`,
        });
    });

    cancelBBQ = asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;

        const bbq = await this.bbqRepository.findById(id);

        if (!bbq) {
            res.status(404).json({
                success: false,
                message: 'BBQ não encontrado',
            });
            return;
        }

        await this.bbqRepository.cancel(id);

        const updatedBBQ = await this.bbqRepository.findById(id);

        res.json({
            success: true,
            data: this.mapBBQToResponse(updatedBBQ!),
            message: 'BBQ cancelado com sucesso',
        });
    });

    addParticipant = asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const { userId, userName, invitedBy } = req.body;

        if (!userId || !userName) {
            res.status(400).json({
                success: false,
                message: 'userId e userName são obrigatórios',
            });
            return;
        }

        const bbq = await this.bbqRepository.findById(id);

        if (!bbq) {
            res.status(404).json({
                success: false,
                message: 'BBQ não encontrado',
            });
            return;
        }

        if (bbq.status === 'closed' || bbq.status === 'finished' || bbq.status === 'cancelled') {
            res.status(400).json({
                success: false,
                message: 'Não é possível adicionar participantes a um BBQ fechado, finalizado ou cancelado',
            });
            return;
        }

        const alreadyExists = bbq.participants.some(p => p.userId === userId);
        if (alreadyExists) {
            res.status(400).json({
                success: false,
                message: 'Participante já está na lista',
            });
            return;
        }

        const updatedBBQ = await this.bbqRepository.addParticipant(id, {
            userId,
            userName,
            invitedBy: invitedBy || null,
            isPaid: false,
            isGuest: !!invitedBy,
        });

        res.json({
            success: true,
            data: this.mapBBQToResponse(updatedBBQ!),
            message: invitedBy ? `Convidado ${userName} adicionado com sucesso` : `${userName} adicionado ao churrasco`,
        });
    });

    removeParticipant = asyncHandler(async (req: Request, res: Response) => {
        const { id, userId } = req.params;

        const bbq = await this.bbqRepository.findById(id);

        if (!bbq) {
            res.status(404).json({
                success: false,
                message: 'BBQ não encontrado',
            });
            return;
        }

        if (bbq.status === 'closed' || bbq.status === 'finished' || bbq.status === 'cancelled') {
            res.status(400).json({
                success: false,
                message: 'Não é possível remover participantes de um BBQ fechado, finalizado ou cancelado',
            });
            return;
        }

        const participant = bbq.participants.find(p => p.userId === userId);
        if (!participant) {
            res.status(404).json({
                success: false,
                message: 'Participante não encontrado',
            });
            return;
        }

        const updatedBBQ = await this.bbqRepository.removeParticipant(id, userId);

        res.json({
            success: true,
            data: this.mapBBQToResponse(updatedBBQ!),
            message: `${participant.userName} removido do churrasco`,
        });
    });

    toggleParticipantPayment = asyncHandler(async (req: Request, res: Response) => {
        const { id, userId } = req.params;
        const { isPaid } = req.body;

        if (typeof isPaid !== 'boolean') {
            res.status(400).json({
                success: false,
                message: 'isPaid deve ser um valor booleano',
            });
            return;
        }

        const bbq = await this.bbqRepository.findById(id);

        if (!bbq) {
            res.status(404).json({
                success: false,
                message: 'BBQ não encontrado',
            });
            return;
        }

        if (bbq.status !== 'closed') {
            res.status(400).json({
                success: false,
                message: 'Só é possível marcar pagamentos em churrascos fechados',
            });
            return;
        }

        const participantIndex = bbq.participants.findIndex(p => p.userId === userId);
        if (participantIndex === -1) {
            res.status(404).json({
                success: false,
                message: 'Participante não encontrado',
            });
            return;
        }

        const participant = bbq.participants[participantIndex];

        if (isPaid && !participant.isPaid) {
            try {
                let debt = null;

                if (participant.debtId) {
                    debt = await this.ledgerRepository.findById(participant.debtId);
                } else {
                    const debtorId = participant.invitedBy || participant.userId;
                    debt = await this.ledgerRepository.findPendingBBQDebtByBBQUserAndParticipant(
                        id,
                        debtorId,
                        participant.userName
                    );
                }

                if (debt && debt.status !== 'confirmado') {
                    await this.ledgerRepository.confirmDebit(debt._id.toString());

                    const debtorId = participant.invitedBy || participant.userId;
                    const dateStr = `${String(bbq.date.getDate()).padStart(2, '0')}/${String(bbq.date.getMonth() + 1).padStart(2, '0')}`;
                    await this.ledgerRepository.addCredit({
                        workspaceId: bbq.workspaceId,
                        userId: debtorId,
                        amountCents: debt.amountCents || 0,
                        method: 'pix',
                        note: `Pagamento de churrasco - ${participant.userName} - ${dateStr}`,
                        category: 'player-payment',
                    });

                    if (debt.organizzeId) {
                        const organizzeConfig = await this.workspaceRepository.getDecryptedOrganizzeConfig(bbq.workspaceId);

                        if (organizzeConfig?.email && organizzeConfig?.apiKey) {
                            try {
                                await axios.put(
                                    `https://api.organizze.com.br/rest/v2/transactions/${debt.organizzeId}`,
                                    { paid: true },
                                    {
                                        auth: {
                                            username: organizzeConfig.email,
                                            password: organizzeConfig.apiKey
                                        }
                                    }
                                );
                            } catch (error: any) {
                                this.loggerService.log(`[ORGANIZZE] Failed to update BBQ transaction: ${error?.message}`);
                            }
                        }
                    }
                }
            } catch (error: any) {
                this.loggerService.log(`[BBQ-PAYMENT] Error processing Ledger: ${error?.message}`);
            }
        }

        if (!isPaid && participant.isPaid) {
            try {
                let debt = null;

                if (participant.debtId) {
                    debt = await this.ledgerRepository.findById(participant.debtId);
                }

                if (debt && debt.status === 'confirmado') {
                    await this.ledgerRepository.unconfirmDebitById(debt._id.toString());

                    const debtorId = participant.invitedBy || participant.userId;
                    const dateStr = `${String(bbq.date.getDate()).padStart(2, '0')}/${String(bbq.date.getMonth() + 1).padStart(2, '0')}`;
                    await this.ledgerRepository.deleteCreditByNote(
                        bbq.workspaceId,
                        debtorId,
                        `Pagamento de churrasco - ${participant.userName} - ${dateStr}`
                    );

                    if (debt.organizzeId) {
                        const organizzeConfig = await this.workspaceRepository.getDecryptedOrganizzeConfig(bbq.workspaceId);

                        if (organizzeConfig?.email && organizzeConfig?.apiKey) {
                            try {
                                await axios.put(
                                    `https://api.organizze.com.br/rest/v2/transactions/${debt.organizzeId}`,
                                    { paid: false },
                                    {
                                        auth: {
                                            username: organizzeConfig.email,
                                            password: organizzeConfig.apiKey
                                        }
                                    }
                                );
                            } catch (error: any) {
                                this.loggerService.log(`[ORGANIZZE] Failed to update BBQ transaction: ${error?.message}`);
                            }
                        }
                    }
                }
            } catch (error: any) {
                this.loggerService.log(`[BBQ-UNPAYMENT] Error processing Ledger: ${error?.message}`);
            }
        }

        const updatedBBQ = await this.bbqRepository.updateParticipantPaymentStatus(id, userId, isPaid);

        if (!updatedBBQ) {
            res.status(500).json({
                success: false,
                message: 'Erro ao atualizar status de pagamento',
            });
            return;
        }

        const allPaid = updatedBBQ.participants.every(p => p.isPaid);
        if (allPaid && updatedBBQ.status === 'closed') {
            await this.bbqRepository.finish(id);
        }

        if (!isPaid && updatedBBQ.status === 'finished') {
            await this.bbqRepository.unfinish(id);
        }

        const finalBBQ = await this.bbqRepository.findById(id);

        res.json({
            success: true,
            data: this.mapBBQToResponse(finalBBQ!),
            message: `${participant.userName} marcado como ${isPaid ? 'pago' : 'pendente'}`,
        });
    });
}
